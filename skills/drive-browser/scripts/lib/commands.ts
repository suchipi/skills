import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { ChromeReleaseChannel } from "puppeteer";

import {
  WORK,
  SESSION,
  STATE,
  SOCKET,
  LOCK,
  CONSOLE_LOG,
  CONSOLE_LOG_MAX_BYTES,
  DAEMON_LOG,
  REC_PID,
  DEFAULT_PROFILE,
  workPath,
} from "./paths.ts";
import {
  readSession,
  readState,
  writeState,
  isRunning,
  liveSession,
  requireSession,
  type BrowserKind,
} from "./session.ts";
import { browserCommands } from "./browser-commands.ts";
import { requestCommand } from "./rpc.ts";
import { parseFlags } from "./flags.ts";
import { UserError, describeError } from "./errors.ts";
import type { DaemonOptions } from "./daemon.ts";

const CHANNELS: ChromeReleaseChannel[] = ["chrome", "chrome-beta", "chrome-canary", "chrome-dev"];

const DAEMON = path.join(import.meta.dirname, "daemon.ts");
const RECORDER = path.join(import.meta.dirname, "recorder.ts");

export interface Command {
  args: string;
  summary: string;
  run: (argv: string[]) => void | Promise<void>;
}

/** Background helpers inherit `--experimental-strip-types` via execArgv. */
function spawnDetached(script: string, args: string[]) {
  const logFd = fs.openSync(DAEMON_LOG, "a");
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    cwd: WORK,
    env: { ...process.env, DRIVE_BROWSER_WORK: WORK },
  });
  child.unref();
  fs.closeSync(logFd);
  return child;
}

function tailDaemonLog(lines = 15): string {
  if (!fs.existsSync(DAEMON_LOG)) return "";
  return fs.readFileSync(DAEMON_LOG, "utf8").split("\n").slice(-lines).join("\n");
}

/** Hand a page command to the daemon, which owns the browser connection. */
async function proxy(command: string, argv: string[], timeoutMs?: number): Promise<void> {
  requireSession();
  const code = await requestCommand({ command, argv, cwd: process.cwd() }, { timeoutMs }).catch((error: unknown) => {
    console.error(`drive-browser: could not reach the daemon (${describeError(error)}). Try: drive-browser down && up`);
    return 1;
  });
  if (code !== 0) process.exit(code);
}

/** Wait for a pid to disappear; returns false if it outlives the deadline. */
async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (isRunning(pid) && Date.now() < deadline) await delay(50);
  return !isRunning(pid);
}

function setup(): void {
  fs.mkdirSync(WORK, { recursive: true });
  const manifest = path.join(WORK, "package.json");
  if (!fs.existsSync(manifest)) {
    fs.writeFileSync(
      manifest,
      JSON.stringify({ name: "drive-browser-work", private: true, version: "0.0.0" }, null, 2) + "\n"
    );
  }
  console.log(`Installing puppeteer into ${WORK} (downloads a browser; this can take a few minutes)...`);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["install", "puppeteer"], { cwd: WORK, stdio: "inherit" });
  if (result.status !== 0) throw new UserError(`npm install puppeteer failed in ${WORK}`);
  const manifestPath = path.join(WORK, "node_modules", "puppeteer", "package.json");
  const { version } = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { version: string };
  console.log(`puppeteer ${version} ready in ${WORK}`);
}

/** Fetch a browser build into puppeteer's cache (a no-op once it is there). */
function installBrowser(kind: BrowserKind): void {
  const cli = path.join(WORK, "node_modules", ".bin", "puppeteer");
  const result = spawnSync(cli, ["browsers", "install", kind], { cwd: WORK, stdio: "inherit" });
  if (result.status !== 0) throw new UserError(`could not install ${kind} (tried: ${cli} browsers install ${kind})`);
}

/**
 * Claim the right to start a browser, so two `up`s cannot both spawn a daemon and
 * leave one of them orphaned. Returns a release function.
 */
function claimStartLock(): () => void {
  fs.mkdirSync(WORK, { recursive: true });
  try {
    fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
  } catch {
    const owner = Number(fs.readFileSync(LOCK, "utf8").trim());
    if (owner && isRunning(owner)) throw new UserError(`another 'up' is already starting (pid ${owner})`);
    fs.writeFileSync(LOCK, String(process.pid)); // the previous attempt died
  }
  return () => fs.rmSync(LOCK, { force: true });
}

async function up(argv: string[]): Promise<void> {
  const [flags] = parseFlags(argv, {
    browser: "value",
    headful: "bool",
    size: "value",
    url: "value",
    channel: "value",
    profile: "value",
  });
  const kind = (flags.browser ?? "chrome") as BrowserKind;
  if (kind !== "chrome" && kind !== "firefox") {
    throw new UserError(`--browser must be chrome or firefox (got '${kind}')`);
  }
  if (kind === "firefox" && flags.channel) {
    throw new UserError("--channel selects a Chrome build, so it cannot be combined with --browser firefox");
  }
  if (flags.channel && !CHANNELS.includes(flags.channel as ChromeReleaseChannel)) {
    throw new UserError(`--channel must be one of ${CHANNELS.join(", ")} (got '${flags.channel}')`);
  }
  const size = flags.size ?? "1280x800";
  if (!/^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(size)) {
    throw new UserError(`--size must look like 1280x800 (got '${size}')`);
  }
  if (liveSession()) {
    throw new UserError("a browser is already running (use 'down' to close it)");
  }

  const releaseLock = claimStartLock();
  try {
    fs.rmSync(SESSION, { force: true });
    if (!fs.existsSync(path.join(WORK, "node_modules", "puppeteer"))) setup();
    // puppeteer's own install only fetches Chrome builds.
    if (kind === "firefox") installBrowser("firefox");

    const options: DaemonOptions = {
      browser: kind,
      headless: !flags.headful,
      size,
      url: flags.url ?? null,
      channel: (flags.channel as ChromeReleaseChannel | undefined) ?? null,
      profile: path.resolve(flags.profile ?? DEFAULT_PROFILE),
    };
    // Recorded separately from the session so `destroy` still knows which profile
    // to remove after a `down` has taken session.json away.
    writeState({ profile: options.profile });

    const child = spawnDetached(DAEMON, [JSON.stringify(options)]);
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (readSession() && fs.existsSync(SOCKET)) {
        console.log(
          `${kind} up (${options.headless ? "headless" : "headful"}, ${options.size}). Profile: ${options.profile}`
        );
        console.log(`Work dir: ${WORK}`);
        return;
      }
      if (!isRunning(child.pid!)) break;
      await delay(250);
    }
    // Do not leave a half-started daemon behind holding a browser we have
    // already declared dead.
    if (isRunning(child.pid!)) {
      try {
        process.kill(child.pid!, "SIGKILL");
      } catch {}
    }
    throw new UserError(`browser failed to start.\n${tailDaemonLog()}`);
  } finally {
    releaseLock();
  }
}

function consoleLog(argv: string[]): void {
  const [flags] = parseFlags(argv, { clear: "bool", tail: "value" });
  if (flags.clear) {
    fs.rmSync(CONSOLE_LOG, { force: true });
    console.log("console log cleared");
    return;
  }
  if (!fs.existsSync(CONSOLE_LOG)) return console.log("(nothing captured)");
  // Read from the end rather than slurping the file: it is capped, not small.
  const size = fs.statSync(CONSOLE_LOG).size;
  const window = Math.min(size, CONSOLE_LOG_MAX_BYTES / 5);
  const handle = fs.openSync(CONSOLE_LOG, "r");
  const buffer = Buffer.alloc(window);
  fs.readSync(handle, buffer, 0, window, size - window);
  fs.closeSync(handle);
  const lines = buffer.toString("utf8").split("\n").filter(Boolean);
  if (window < size) lines.shift(); // the first line is probably cut in half
  for (const line of lines.slice(-Number(flags.tail || 100))) {
    let entry: { time: string; kind: string; level?: string; text: string };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    console.log(`[${entry.time.slice(11, 19)}] ${entry.kind}${entry.level ? `/${entry.level}` : ""}: ${entry.text}`);
  }
}

async function recordStart(argv: string[]): Promise<void> {
  const name = argv[0] || "rec.webm";
  if (!/\.(webm|mp4|gif)$/.test(name)) {
    throw new UserError(`recordings must end in .webm, .mp4 or .gif (got '${name}')`);
  }
  const output = workPath(name);
  const session = requireSession();
  if (session.browser === "firefox") {
    throw new UserError(
      "recording uses puppeteer's screencast, which needs CDP; Firefox speaks WebDriver BiDi only. Take screenshots, or run Chrome for this."
    );
  }
  if (fs.existsSync(REC_PID) && isRunning(Number(fs.readFileSync(REC_PID, "utf8")))) {
    throw new UserError("already recording");
  }
  // puppeteer's screencast pipes frames to an external ffmpeg, so a missing binary
  // would otherwise only surface as a dead recorder in daemon.log.
  if (spawnSync("ffmpeg", ["-version"]).error) {
    throw new UserError("ffmpeg is not on PATH, and recording needs it (puppeteer's screencast encodes via ffmpeg)");
  }

  const child = spawnDetached(RECORDER, [output]);
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(REC_PID)) {
      console.log(`Recording -> ${output} (stop with: drive-browser record-stop)`);
      return;
    }
    if (!isRunning(child.pid!)) break;
    await delay(100);
  }
  const stillAlive = isRunning(child.pid!);
  try {
    process.kill(child.pid!, "SIGKILL");
  } catch {}
  throw new UserError(
    `the recorder failed to start (it was ${stillAlive ? "still starting" : "already gone"}).\n${tailDaemonLog(10)}`
  );
}

async function recordStop(): Promise<void> {
  if (!fs.existsSync(REC_PID)) throw new UserError("no active recording");
  const pid = Number(fs.readFileSync(REC_PID, "utf8"));
  if (isRunning(pid)) process.kill(pid, "SIGTERM");
  // The recorder finalizes the container on its way out, and it needs the browser
  // to still be there while it does - so wait for it rather than racing 'down'.
  const finished = await waitForExit(pid, 20_000);
  fs.rmSync(REC_PID, { force: true });
  console.log(finished ? "Recording stopped." : "Recording stopped, but the recorder is still exiting; the file may be truncated.");
}

function workDirListing(): void {
  console.log(`work dir: ${WORK}`);
  for (const entry of fs.existsSync(WORK) ? fs.readdirSync(WORK) : []) {
    if (entry !== "node_modules" && entry !== "profile") console.log(`  - ${entry}`);
  }
}

async function status(): Promise<void> {
  const session = liveSession();
  if (session) {
    // Deliberately impatient: status is what you reach for when a page is stuck,
    // so it must answer even when the daemon's queue is blocked behind one.
    await proxy("status", [], 5_000).catch((error: unknown) => {
      console.log(
        `browser:  ${session.browser} running (${session.headless ? "headless" : "headful"} ${session.size}, since ${session.startedAt})`
      );
      console.log(`profile:  ${session.profile}`);
      console.log(`tabs:     unavailable - ${describeError(error)}`);
    });
  } else {
    console.log("browser:  not running ('up' to start)");
    if (fs.existsSync(DEFAULT_PROFILE)) console.log(`profile:  ${DEFAULT_PROFILE} (preserved)`);
  }
  workDirListing();
}

async function down(): Promise<void> {
  const session = liveSession();
  if (!session) {
    console.log("not running");
    return;
  }
  if (fs.existsSync(REC_PID)) await recordStop();
  await proxy("down", []);
  // The daemon closes the browser and exits after answering; wait it out so a
  // following 'up' does not race the old session file.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline && isRunning(session.pid)) await delay(100);
  if (isRunning(session.pid)) {
    process.kill(session.pid, "SIGTERM");
    await waitForExit(session.pid, 5_000);
  }
  // Only clear the files if they still describe the daemon we just stopped: a
  // replacement may already have written its own.
  if (readSession()?.pid === session.pid) {
    fs.rmSync(SESSION, { force: true });
    fs.rmSync(SOCKET, { force: true });
  }
}

async function destroy(argv: string[]): Promise<void> {
  const [flags] = parseFlags(argv, { force: "bool" });
  // The session file goes away with `down`, so the profile is remembered
  // separately - otherwise this would fall back to the default and delete the
  // wrong directory while reporting success.
  const profile = liveSession()?.profile ?? readState()?.profile ?? DEFAULT_PROFILE;
  const inWorkDir = !path.relative(WORK, profile).startsWith("..");

  if (!inWorkDir && !flags.force) {
    await down();
    throw new UserError(
      `refusing to delete ${profile}: it is outside the work dir (${WORK}), so it may be a profile you use elsewhere.\n` +
        `Delete it yourself, or re-run with --force if you are sure.`
    );
  }

  await down();
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(STATE, { force: true });
  console.log(`Removed profile ${profile} (cookies, logins, and history are gone).`);
}

/** Page commands are declared here but executed by the daemon. */
function page(args: string, summary: string, name: string): Command {
  if (!(name in browserCommands)) throw new Error(`no daemon implementation for page command '${name}'`);
  return { args, summary, run: (argv) => proxy(name, argv) };
}

export const commands: Record<string, Command> = {
  setup: { args: "", summary: "Install puppeteer + its browser into the work dir", run: setup },
  up: { args: "[opts]", summary: "Launch the browser (Chrome, headless, by default)", run: up },
  goto: page("<url>", "Navigate the active page", "goto"),
  screenshot: page("[name.png] [opts]", "Screenshot -> $WORK/name.png", "screenshot"),
  text: page("[selector]", "Visible text of the page (or one element)", "text"),
  html: page("[selector]", "Outer HTML of the page (or one element)", "html"),
  elements: page("[selector]", "List interactive elements: selector, text, box", "elements"),
  click: page("<selector>", "Click an element (waits for it)", "click"),
  type: page("<selector> <text>", "Replace an input's value by typing (--append to keep it)", "type"),
  press: page("<key>", "Press a key on the active page (e.g. Enter)", "press"),
  scroll: page("<dy> [dx]", "Scroll the page by pixels", "scroll"),
  wait: page("<selector> | --idle", "Wait for an element or for network idle", "wait"),
  eval: page("<js>", "Evaluate an expression in the page, print JSON", "eval"),
  run: page("<script> [args...]", "Run a TS/JS puppeteer script with {browser, page, ...}", "run"),
  pages: page("", "List the open tabs", "pages"),
  use: page("<n>", "Choose the active tab", "use"),
  console: { args: "[--tail N] [--clear]", summary: "Show console/page errors captured by the daemon", run: consoleLog },
  "record-start": { args: "[name.webm]", summary: "Start recording the active page (Chrome + ffmpeg)", run: recordStart },
  "record-stop": { args: "", summary: "Stop recording (finalizes the video)", run: recordStop },
  status: { args: "", summary: "Show session + work-dir state", run: status },
  down: { args: "", summary: "Close the browser (profile preserved)", run: down },
  destroy: { args: "[--force]", summary: "Close it and delete the profile", run: destroy },
};

export function usage(): void {
  const width = Math.max(
    ...Object.entries(commands).map(([name, command]) => `${name} ${command.args}`.trim().length)
  );
  const lines = Object.entries(commands).map(
    ([name, command]) => `  drive-browser ${`${name} ${command.args}`.trim().padEnd(width)}  ${command.summary}`
  );
  console.log(
    [
      "drive-browser - drive and observe a real web browser on the host with puppeteer.",
      "",
      "A detached daemon owns the browser and runs the page commands, so the browser",
      "outlives each CLI invocation:",
      `  work dir      ${WORK}  (puppeteer install, profile, screenshots, logs)`,
      "  session.json  what is running ; daemon.sock  where commands are sent",
      "",
      "Usage:",
      ...lines,
      "",
      "up options:         --browser chrome|firefox  --headful (visible window)",
      "                    --size WxH (default 1280x800)  --url URL",
      `                    --channel ${CHANNELS.join("|")} (Chrome only)  --profile DIR`,
      "screenshot options: --full (full page)  --selector S (just that element)",
      "destroy options:    --force (delete a profile outside the work dir)",
      "",
      "Env overrides: DRIVE_BROWSER_WORK (default /tmp/drive-browser)",
    ].join("\n")
  );
}
