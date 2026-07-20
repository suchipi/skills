// Line-delimited JSON over a unix socket, between the CLI and the daemon.
//
// The daemon owns the only connection to the browser - Firefox permits a single
// WebDriver BiDi session - so commands that touch the page are executed there and
// their output is streamed back here.
//
// Nothing in the daemon half may throw asynchronously: an unhandled socket error
// or a malformed line would take down the browser along with the process.
import net from "node:net";
import readline from "node:readline";

import { SOCKET } from "./paths.ts";
import { UserError, describeError } from "./errors.ts";

export interface Request {
  command: string;
  argv: string[];
  cwd: string;
}

export type Message =
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "exit"; code: number };

export interface RequestOptions {
  /** Give up if the daemon has not answered in this long (it may be wedged). */
  timeoutMs?: number;
}

/** Run one command in the daemon, mirroring its output; resolves to its exit code. */
export function requestCommand(request: Request, options: RequestOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(SOCKET);
    let exitCode: number | null = null;
    let settled = false;

    const finish = (result: number | Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const timer = options.timeoutMs
      ? setTimeout(() => finish(new UserError("the daemon did not answer in time (a page may be wedged)")), options.timeoutMs)
      : null;
    timer?.unref();

    socket.on("connect", () => socket.write(JSON.stringify(request) + "\n"));
    socket.on("error", (error) => finish(error));

    readline.createInterface({ input: socket }).on("line", (line) => {
      if (!line) return;
      let message: Message;
      try {
        message = JSON.parse(line) as Message;
      } catch {
        console.error(`drive-browser: ignoring unreadable daemon output: ${line.slice(0, 200)}`);
        return;
      }
      if (message.type === "stdout") console.log(message.text);
      else if (message.type === "stderr") console.error(message.text);
      else exitCode = message.code;
    });

    socket.on("close", () => {
      if (timer) clearTimeout(timer);
      finish(exitCode ?? 1);
    });
  });
}

export interface Responder {
  out: (text: string) => void;
  err: (text: string) => void;
}

/**
 * Serve requests one at a time; `handler` writes through the responder.
 *
 * `onFatal` is called if the socket itself fails (a stale path, a permissions
 * problem): the caller owns the browser and has to take it down cleanly.
 */
export function serve(
  handler: (request: Request, responder: Responder) => Promise<number>,
  onFatal: (error: Error) => void
): net.Server {
  let queue: Promise<unknown> = Promise.resolve();

  const server = net.createServer((socket) => {
    // A client that disappears mid-command (interrupted shell, agent timeout)
    // delivers EPIPE/ECONNRESET here; unhandled, it would kill the daemon.
    socket.on("error", () => socket.destroy());

    readline.createInterface({ input: socket }).once("line", (line) => {
      const send = (message: Message) => {
        if (!socket.destroyed && socket.writable) socket.write(JSON.stringify(message) + "\n");
      };

      let request: Request;
      try {
        request = JSON.parse(line) as Request;
      } catch {
        send({ type: "stderr", text: "drive-browser: daemon received a malformed request" });
        send({ type: "exit", code: 1 });
        socket.end();
        return;
      }

      const responder: Responder = {
        out: (text) => send({ type: "stdout", text }),
        err: (text) => send({ type: "stderr", text }),
      };
      queue = queue.then(async () => {
        let code = 0;
        try {
          code = await handler(request, responder);
        } catch (error) {
          responder.err(`drive-browser: ${describeError(error)}`);
          code = 1;
        }
        send({ type: "exit", code });
        socket.end();
      });
    });
  });

  server.on("error", (error) => {
    console.error(`drive-browser daemon: socket server error: ${describeError(error)}`);
    onFatal(error);
  });
  server.listen(SOCKET);
  return server;
}
