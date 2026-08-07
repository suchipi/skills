// Owns the browser and executes every page command. Spawned detached by
// `drive-browser up` with its options as one JSON argument.
//
// It holds the only connection to the browser, which is what Firefox requires
// (WebDriver BiDi allows a single session), and it is also what lets console
// output, page errors and dialogs be captured continuously for both browsers.
// The CLI reaches it over a unix socket; see rpc.ts.
import fs from "node:fs";
import type net from "node:net";
import type { Browser, ChromeReleaseChannel, ConsoleMessage, Dialog, HTTPRequest, Page, Target } from "puppeteer";

import { CONSOLE_LOG, CONSOLE_LOG_MAX_BYTES, PROTOCOL_TIMEOUT, SESSION, SOCKET } from "./paths.ts";
import { isRunning, loadPuppeteer, readSession, writeSession, type BrowserKind } from "./session.ts";
import { browserCommands } from "./browser-commands.ts";
import { describeError } from "./errors.ts";
import { serve } from "./rpc.ts";

export interface DaemonOptions {
  browser: BrowserKind;
  headless: boolean;
  size: string;
  url: string | null;
  channel: ChromeReleaseChannel | null;
  profile: string;
}

interface LogEntry {
  kind: "console" | "pageerror" | "requestfailed" | "dialog" | "error";
  text: string;
  level?: string;
  url?: string;
}

/**
 * Append one captured event.
 *
 * Called from page event handlers, so it must never throw: the work dir can be
 * deleted underneath a running daemon, and an exception here would be an uncaught
 * one. The log is rotated so a page that logs in a loop cannot fill the disk.
 */
function logEvent(entry: LogEntry): void {
  try {
    if ((fs.statSync(CONSOLE_LOG, { throwIfNoEntry: false })?.size ?? 0) > CONSOLE_LOG_MAX_BYTES) {
      fs.renameSync(CONSOLE_LOG, `${CONSOLE_LOG}.1`);
    }
    fs.appendFileSync(CONSOLE_LOG, JSON.stringify({ time: new Date().toISOString(), ...entry }) + "\n");
  } catch {
    // Nothing useful to do: the log is a convenience, not the job.
  }
}

function watchPage(page: Page): void {
  const where = () => page.url();
  page.on("console", (message: ConsoleMessage) =>
    logEvent({ kind: "console", level: message.type(), text: message.text(), url: where() })
  );
  page.on("pageerror", (error) => logEvent({ kind: "pageerror", text: String(error), url: where() }));
  page.on("requestfailed", (request: HTTPRequest) =>
    logEvent({ kind: "requestfailed", text: `${request.failure()?.errorText} ${request.url()}`, url: where() })
  );
  // An unanswered dialog blocks every later command, so answer it here and leave
  // the evidence in the log.
  page.on("dialog", async (dialog: Dialog) => {
    logEvent({ kind: "dialog", level: dialog.type(), text: dialog.message(), url: where() });
    await dialog.dismiss().catch(() => {});
  });
}

/** True while session.json still describes *this* daemon. */
function ownsSession(): boolean {
  try {
    return readSession()?.pid === process.pid;
  } catch {
    return false; // corrupt: assume someone else's problem, leave it alone
  }
}

let server: net.Server | null = null;

/**
 * Exit, cleaning up only what still belongs to this daemon.
 *
 * A daemon that is shutting down can outlive the CLI that asked it to, and the
 * user may have started a replacement in the meantime - deleting the session file
 * or socket unconditionally would pull the rug out from under that new daemon.
 */
function shutdown(code = 0): never {
  if (ownsSession()) {
    fs.rmSync(SESSION, { force: true });
    fs.rmSync(SOCKET, { force: true });
  }
  server?.close();
  process.exit(code);
}

/**
 * Close the browser and wait for its process to be gone before exiting.
 *
 * Exiting as soon as the connection drops kills the browser mid-shutdown, and
 * Firefox writes localStorage at shutdown - doing that loses it (Chrome persists
 * eagerly, so it never noticed).
 */
async function closeAndExit(browser: Browser): Promise<never> {
  const child = browser.process();
  await browser.close().catch(() => {});
  const deadline = Date.now() + 15_000;
  while (child?.pid && isRunning(child.pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  shutdown();
}

async function main(options: DaemonOptions): Promise<void> {
  const puppeteer = loadPuppeteer();
  const firefox = options.browser === "firefox";
  const [width, height] = options.size.split("x").map(Number);

  const browser: Browser = await puppeteer.launch({
    browser: options.browser,
    headless: options.headless,
    userDataDir: options.profile,
    defaultViewport: options.headless && !firefox ? { width, height } : null,
    args: firefox ? [`--width=${width}`, `--height=${height}`] : [`--window-size=${width},${height}`],
    // Default is 180s: long enough that a wedged page looks like a hang.
    protocolTimeout: PROTOCOL_TIMEOUT,
    ...(options.channel ? { channel: options.channel } : {}),
  });

  // The profile persists across `down`, and the browser restores its tabs from it
  // on the next launch - so without this, every `up` would stack another run's
  // leftovers behind the fresh tab, and `pages()[0]` could be any of them.
  const existing = await browser.pages();
  const page = existing[0] ?? (await browser.newPage());
  for (const stale of existing.slice(1)) await stale.close().catch(() => {});

  for (const tab of await browser.pages()) watchPage(tab);
  browser.on("targetcreated", async (target: Target) => {
    const created = await target.page().catch(() => null);
    if (created) watchPage(created);
  });

  // Firefox ignores the launch viewport, so set it explicitly.
  if (firefox) await page.setViewport({ width, height }).catch(() => {});
  // The surviving tab may itself be a restored one, so land it somewhere known.
  await page
    .goto(options.url ?? "about:blank", { waitUntil: "domcontentloaded" })
    .catch((error: unknown) => logEvent({ kind: "error", text: String(error) }));

  let closing = false;

  fs.rmSync(SOCKET, { force: true });
  server = serve(async (request, responder) => {
    if (request.command === "down") {
      responder.out("Browser closed; profile preserved. Start again with 'up'.");
      closing = true;
      setTimeout(() => closeAndExit(browser), 10);
      return 0;
    }
    const command = browserCommands[request.command];
    if (!command) {
      responder.err(`drive-browser: '${request.command}' is not a page command`);
      return 1;
    }
    try {
      await command(request.argv, { browser, cwd: request.cwd, out: responder.out, err: responder.err });
      return 0;
    } catch (error) {
      responder.err(`drive-browser: ${describeError(error)}`);
      return 1;
    }
  }, () => {
    closing = true;
    void closeAndExit(browser);
  });

  writeSession({
    wsEndpoint: browser.wsEndpoint(),
    pid: process.pid,
    browserPid: browser.process()?.pid ?? null,
    browser: options.browser,
    profile: options.profile,
    headless: options.headless,
    size: options.size,
    startedAt: new Date().toISOString(),
    pageIndex: 0,
  });

  // Only react to the browser going away on its own; our own close is awaited above.
  browser.on("disconnected", () => {
    if (!closing) shutdown();
  });

  // Wiping the work dir (or the session file) is how a person says "that's over",
  // and a session file naming a different pid means a replacement daemon took
  // over. Either way this browser is unreachable, so let it go rather than linger
  // holding memory.
  setInterval(() => {
    if (closing) return;
    if (!fs.existsSync(SESSION) || !ownsSession()) {
      closing = true;
      void closeAndExit(browser);
    }
  }, 5_000).unref();

  process.on("SIGTERM", () => {
    closing = true;
    void closeAndExit(browser);
  });
}

try {
  await main(JSON.parse(process.argv[2]) as DaemonOptions);
} catch (error) {
  console.error(`drive-browser daemon: ${describeError(error)}`);
  process.exit(1);
}
