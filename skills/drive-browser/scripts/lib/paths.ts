import path from "node:path";

import { UserError } from "./errors.ts";

export const WORK = path.resolve(process.env.DRIVE_BROWSER_WORK || ".tmp/drive-browser");
export const SESSION = path.join(WORK, "session.json");
export const STATE = path.join(WORK, "state.json");
export const LOCK = path.join(WORK, "up.lock");
export const SOCKET = path.join(WORK, "daemon.sock");
export const CONSOLE_LOG = path.join(WORK, "console.log");
export const DAEMON_LOG = path.join(WORK, "daemon.log");
export const REC_PID = path.join(WORK, "recorder.pid");
export const DEFAULT_PROFILE = path.join(WORK, "profile");

/** How long a single devtools/BiDi call may take before it is reported as stuck. */
export const PROTOCOL_TIMEOUT = 30_000;

/** Console capture is rotated past this, so one chatty page cannot fill the disk. */
export const CONSOLE_LOG_MAX_BYTES = 5_000_000;

/**
 * Reject an output name that would escape the work dir.
 *
 * Output names come from the command line and are joined onto the work dir, so
 * without this `screenshot ../../../.zshrc.png` would write wherever it liked.
 */
export function workPath(name: string): string {
  const resolved = path.resolve(WORK, name);
  const relative = path.relative(WORK, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new UserError(`'${name}' would write outside the work dir (${WORK})`);
  }
  return resolved;
}
