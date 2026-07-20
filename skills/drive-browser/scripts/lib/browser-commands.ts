// Commands that touch the page. These run inside the daemon (see rpc.ts), so they
// write through a responder instead of stdout.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  Browser,
  ElementHandle,
  KeyInput,
  Page,
  PuppeteerNode,
  ScreenshotOptions,
  WaitForSelectorOptions,
} from "puppeteer";

import { WORK, workPath } from "./paths.ts";
import { loadPuppeteer, readSession, writeSession } from "./session.ts";
import { parseFlags } from "./flags.ts";
import { UserError } from "./errors.ts";

export interface CommandContext {
  browser: Browser;
  /** Directory the CLI was invoked from, for resolving script paths. */
  cwd: string;
  out: (text: string) => void;
  err: (text: string) => void;
}

/** Context object handed to `run` scripts. */
export interface ScriptContext {
  browser: Browser;
  page: Page;
  pages: Page[];
  puppeteer: PuppeteerNode;
  args: string[];
  work: string;
  log: (...args: unknown[]) => void;
  screenshot: (name?: string, options?: ScreenshotOptions) => Promise<string>;
}

const INTERACTIVE =
  "a, button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=menuitem], [contenteditable=true], [onclick]";

export async function openPages(browser: Browser): Promise<Page[]> {
  const pages: Page[] = await browser.pages();
  return pages.filter((page) => !page.isClosed());
}

// The active tab is sticky across invocations so a multi-step interaction keeps
// talking to the same page even when the site opens others.
export async function activePage(browser: Browser): Promise<Page> {
  const pages = await openPages(browser);
  if (pages.length === 0) return browser.newPage();
  return pages[readSession()?.pageIndex ?? 0] || pages[0];
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new UserError(message);
  return value;
}

/**
 * Wait for an element, reporting a miss as a plain message.
 *
 * A selector that never matches is a normal outcome to be told about, not a
 * crash, so neither the null nor the TimeoutError should reach the user as a
 * stack trace. (`instanceof` is no use here: puppeteer is loaded from the work
 * dir, so its error classes are not the ones these types describe.)
 */
async function waitFor(
  page: Page,
  selector: string,
  options: WaitForSelectorOptions = {}
): Promise<ElementHandle<Element>> {
  const element = await page.waitForSelector(selector, { timeout: 10_000, ...options }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "TimeoutError") return null;
    throw error;
  });
  if (!element) throw new UserError(`no element matched ${selector}`);
  return element;
}

export type BrowserCommand = (argv: string[], context: CommandContext) => Promise<void>;

const goto: BrowserCommand = async (argv, { browser, out }) => {
  const url = required(argv[0], "goto needs a url");
  const page = await activePage(browser);
  await page.goto(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`, { waitUntil: "domcontentloaded" });
  out(`${page.url()}  ${await page.title()}`);
};

const screenshot: BrowserCommand = async (argv, { browser, out }) => {
  const [flags, positionals] = parseFlags(argv, { full: "bool", selector: "value" });
  const output = workPath(positionals[0] || "screenshot.png");
  const page = await activePage(browser);
  if (flags.selector) {
    const element = await waitFor(page, flags.selector);
    try {
      await element.screenshot({ path: output });
    } finally {
      await element.dispose();
    }
  } else {
    await page.screenshot({ path: output, fullPage: !!flags.full });
  }
  out(output);
};

const text: BrowserCommand = async (argv, { browser, out }) => {
  const page = await activePage(browser);
  const element = await waitFor(page, argv[0] || "body");
  try {
    const value = await element.evaluate((node) => (node as HTMLElement).innerText);
    out(value.replace(/\n{3,}/g, "\n\n"));
  } finally {
    await element.dispose();
  }
};

const html: BrowserCommand = async (argv, { browser, out }) => {
  const page = await activePage(browser);
  if (!argv[0]) return out(await page.content());
  const element = await waitFor(page, argv[0]);
  try {
    out(await element.evaluate((node) => node.outerHTML));
  } finally {
    await element.dispose();
  }
};

interface ElementRow {
  tag: string;
  type?: string;
  text: string;
  href?: string;
  selector: string;
  box: [number, number, number, number];
}

const elements: BrowserCommand = async (argv, { browser, out }) => {
  const page = await activePage(browser);
  const rows: ElementRow[] = await page.evaluate((selector: string) => {
    const cssPath = (element: Element): string => {
      const parts: string[] = [];
      for (let node: Element | null = element; node && parts.length < 5; node = node.parentElement) {
        if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
          parts.unshift(`#${CSS.escape(node.id)}`);
          break;
        }
        let part = node.tagName.toLowerCase();
        const siblings = node.parentElement
          ? [...node.parentElement.children].filter((child) => child.tagName === node!.tagName)
          : [node];
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        parts.unshift(part);
      }
      return parts.join(" > ");
    };
    return [...document.querySelectorAll(selector)]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label =
          (element as HTMLElement).innerText ||
          (element as HTMLInputElement).value ||
          element.getAttribute("aria-label") ||
          element.getAttribute("placeholder") ||
          "";
        return {
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute("type") || undefined,
          text: label.trim().slice(0, 80),
          href: element.getAttribute("href") || undefined,
          selector: cssPath(element),
          box: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)] as [
            number,
            number,
            number,
            number,
          ],
        };
      });
  }, argv[0] || INTERACTIVE);

  for (const row of rows) {
    const bits = [
      row.tag + (row.type ? `[${row.type}]` : ""),
      JSON.stringify(row.text),
      row.href ? `-> ${row.href}` : "",
      `@${row.box.join(",")}`,
    ];
    out(`${row.selector}\n    ${bits.filter(Boolean).join("  ")}`);
  }
  if (rows.length === 0) out("(no visible matches)");
};

const click: BrowserCommand = async (argv, { browser, out }) => {
  const selector = required(argv[0], "click needs a selector");
  const page = await activePage(browser);
  await (await waitFor(page, selector, { visible: true, timeout: 15_000 })).dispose();
  await page.click(selector);
  out(`clicked ${selector}`);
};

const type: BrowserCommand = async (argv, { browser, out }) => {
  const [flags, positionals] = parseFlags(argv, { append: "bool" });
  const selector = required(positionals[0], "type needs a selector");
  const value = positionals.slice(1).join(" ");
  const page = await activePage(browser);
  await (await waitFor(page, selector, { visible: true, timeout: 15_000 })).dispose();
  await page.focus(selector);
  if (!flags.append) {
    // Clear through the native value setter, not `element.value = ""`: frameworks
    // that patch the property (React's value tracker) otherwise never see the change.
    await page.$eval(selector, (node) => {
      const element = node as HTMLElement;
      if (element.isContentEditable) return void (element.textContent = "");
      const prototype = Object.getPrototypeOf(element);
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, "");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await page.type(selector, value, { delay: 15 });
  out(`typed into ${selector}`);
};

const press: BrowserCommand = async (argv, { browser, out }) => {
  const key = required(argv[0], "press needs a key (e.g. Enter, Tab, ArrowDown)");
  const page = await activePage(browser);
  // The key name comes from the command line; puppeteer rejects unknown ones.
  await page.keyboard.press(key as KeyInput);
  out(`pressed ${key}`);
};

const scroll: BrowserCommand = async (argv, { browser, out }) => {
  const dy = Number(argv[0] ?? 500);
  const dx = Number(argv[1] ?? 0);
  const page = await activePage(browser);
  await page.evaluate((x: number, y: number) => window.scrollBy(x, y), dx, dy);
  out(`scrolled ${dx},${dy}`);
};

const wait: BrowserCommand = async (argv, { browser, out }) => {
  const [flags, positionals] = parseFlags(argv, { idle: "bool", timeout: "value", hidden: "bool" });
  const timeout = Number(flags.timeout || 30_000);
  const page = await activePage(browser);
  if (flags.idle) {
    await page.waitForNetworkIdle({ timeout });
    return out("network idle");
  }
  const selector = required(positionals[0], "wait needs a selector, or --idle");
  const element = await waitFor(page, selector, { timeout, visible: !flags.hidden, hidden: !!flags.hidden });
  await element?.dispose();
  out(`${selector} ${flags.hidden ? "hidden" : "visible"}`);
};

const evaluate: BrowserCommand = async (argv, { browser, out }) => {
  const source = required(argv.join(" "), "eval needs an expression");
  const page = await activePage(browser);
  const value = await page.evaluate(`(async () => (${source}))()`);
  out(typeof value === "string" ? value : JSON.stringify(value, null, 2));
};

const runScript: BrowserCommand = async (argv, { browser, cwd, out }) => {
  const script = path.resolve(cwd, required(argv[0], "run needs a script path"));
  if (!fs.existsSync(script)) throw new UserError(`no such script: ${script}`);
  // The daemon is long-lived and module caches are keyed by URL, so without a
  // per-version query an edited script would keep running its old code.
  const version = fs.statSync(script, { throwIfNoEntry: false })?.mtimeMs ?? 0;
  const module_ = await import(`${pathToFileURL(script).href}?v=${version}`).catch((error: Error) => {
    throw new UserError(`could not load ${script}: ${error.message}`);
  });
  const fn: ((context: ScriptContext) => unknown) | undefined = module_.default;
  if (typeof fn !== "function") {
    throw new UserError(`${script} must 'module.exports = async ({ page, browser }) => { ... }'`);
  }

  const page = await activePage(browser);
  const result = await fn({
    browser,
    page,
    pages: await openPages(browser),
    puppeteer: loadPuppeteer(),
    args: argv.slice(1),
    work: WORK,
    log: (...args) => out(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")),
    screenshot: async (name = "screenshot.png", options = {}) => {
      const output = path.join(WORK, name);
      await page.screenshot({ path: output, ...options });
      out(output);
      return output;
    },
  });
  if (result !== undefined) out(typeof result === "string" ? result : JSON.stringify(result, null, 2));
};

const pages: BrowserCommand = async (_argv, { browser, out }) => {
  const session = readSession();
  for (const [index, page] of (await openPages(browser)).entries()) {
    out(`${index === (session?.pageIndex ?? 0) ? "*" : " "} ${index}  ${await page.title()}  ${page.url()}`);
  }
};

const use: BrowserCommand = async (argv, { browser, out }) => {
  const index = Number(argv[0]);
  if (!Number.isInteger(index) || index < 0) {
    throw new UserError("use needs a tab index (see: drive-browser pages)");
  }
  const tabs = await openPages(browser);
  if (!tabs[index]) throw new UserError(`no tab ${index} (there are ${tabs.length})`);
  writeSession({ ...readSession()!, pageIndex: index });
  await tabs[index].bringToFront();
  out(`active tab: ${index}  ${tabs[index].url()}`);
};

const status: BrowserCommand = async (_argv, { browser, out }) => {
  const session = readSession()!;
  out(
    `browser:  ${session.browser} running (${session.headless ? "headless" : "headful"} ${session.size}, since ${session.startedAt})`
  );
  out(`profile:  ${session.profile}`);
  // Listing tabs is a protocol round trip, and status is exactly what someone runs
  // when a page has stopped answering - so report that rather than failing.
  try {
    for (const [index, page] of (await openPages(browser)).entries()) {
      out(`${index === session.pageIndex ? "*" : " "} tab ${index}: ${page.url()}`);
    }
  } catch (error) {
    out(`tabs:     unavailable - ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    out("          a page is wedged; 'down' then 'up' clears it");
  }
};

export const browserCommands: Record<string, BrowserCommand> = {
  goto,
  screenshot,
  text,
  html,
  elements,
  click,
  type,
  press,
  scroll,
  wait,
  eval: evaluate,
  run: runScript,
  pages,
  use,
  status,
};
