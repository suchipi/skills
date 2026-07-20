import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { PuppeteerNode } from "puppeteer";

import { WORK, SESSION, SOCKET, STATE } from "./paths.ts";
import { UserError } from "./errors.ts";

export type BrowserKind = "chrome" | "firefox";

export interface Session {
  wsEndpoint: string;
  pid: number;
  browserPid: number | null;
  browser: BrowserKind;
  profile: string;
  headless: boolean;
  size: string;
  startedAt: string;
  pageIndex: number;
}

/** What survives `down`, so `destroy` still knows which profile was in use. */
export interface State {
  profile: string;
}

/**
 * Resolve puppeteer from the work dir, where `setup` installs it. The copy in
 * `scripts/` is a devDependency for types only; this is the one that runs.
 */
export function loadPuppeteer(): PuppeteerNode {
  try {
    return createRequire(path.join(WORK, "noop.js"))("puppeteer");
  } catch (error) {
    // Only a missing package means "not set up yet"; anything else (a broken
    // install, a native module that will not load) needs its own message.
    if ((error as NodeJS.ErrnoException)?.code === "MODULE_NOT_FOUND") {
      throw new UserError(`puppeteer is not installed in ${WORK}. Run: drive-browser setup`);
    }
    throw error;
  }
}

export function readSession(): Session | null {
  let raw: string;
  try {
    raw = fs.readFileSync(SESSION, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw) as Session;
  } catch {
    // A truncated session file would otherwise read as "nothing is running", and
    // the next `up` would start a second browser behind the first one's back.
    throw new UserError(`${SESSION} is corrupt. Remove it (and check for a stray browser) before continuing.`);
  }
}

export function writeSession(session: Session): void {
  fs.writeFileSync(SESSION, JSON.stringify(session, null, 2));
}

export function readState(): State | null {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8")) as State;
  } catch {
    return null;
  }
}

export function writeState(state: State): void {
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * The live session, or null when no daemon owns a browser right now.
 *
 * The socket has to exist too: a recycled pid would otherwise make a stale
 * session file look alive, and every command would then fail at connect time.
 */
export function liveSession(): Session | null {
  const session = readSession();
  if (!session || !isRunning(session.pid) || !fs.existsSync(SOCKET)) return null;
  return session;
}

/** The live session, or a clean error telling the caller to start one. */
export function requireSession(): Session {
  const session = liveSession();
  if (!session) throw new UserError("no browser is running. Run: drive-browser up");
  return session;
}
