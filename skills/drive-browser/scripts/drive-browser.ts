#!/usr/bin/env -S node --experimental-strip-types --disable-warning=ExperimentalWarning
// drive-browser - drive and observe a real web browser on the host with puppeteer.
//
// Node runs this TypeScript directly by erasing the types (no build step), which
// is what the shebang flags are for. This file only dispatches: the commands live
// in lib/commands.ts, the browser-owning daemon in lib/daemon.ts, and the video
// recorder in lib/recorder.ts. Run `drive-browser.ts help` for the full usage.
import { commands, usage } from "./lib/commands.ts";
import { describeError } from "./lib/errors.ts";

const [, , name, ...argv] = process.argv;

if (!name || name === "help" || name === "-h" || name === "--help") {
  usage();
  process.exit(0);
}

const command = commands[name];
if (!command) {
  const names = Object.keys(commands).join(", ");
  console.error(`drive-browser: unknown command '${name}'. Commands: ${names}`);
  process.exit(1);
}

try {
  await command.run(argv);
} catch (error) {
  console.error(`drive-browser: ${describeError(error)}`);
  process.exit(1);
}
