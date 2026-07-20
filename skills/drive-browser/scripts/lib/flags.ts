import { UserError } from "./errors.ts";

export type FlagKind = "bool" | "value";
export type FlagSpec = Record<string, FlagKind>;

/** `--foo` yields `true`, `--foo bar` yields `"bar"`, absent yields `undefined`. */
export type Flags<S extends FlagSpec> = {
  [K in keyof S]?: S[K] extends "bool" ? true : string;
};

/**
 * Split `argv` into declared options and positional arguments.
 *
 * Everything after a bare `--` is positional, so text that starts with dashes can
 * still be typed into a page. Bad input throws rather than exiting: these run
 * inside the daemon, where exiting would take the browser down with it.
 *
 * @param argv arguments after the command name
 * @param spec option name -> whether it takes a value
 * @returns `[flags, positionals]`
 */
export function parseFlags<S extends FlagSpec>(argv: string[], spec: S): [Flags<S>, string[]] {
  const flags: Record<string, string | true> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (!(name in spec)) {
      const known = Object.keys(spec).map((flag) => `--${flag}`);
      throw new UserError(`unknown option --${name}${known.length ? ` (accepts ${known.join(", ")})` : ""}`);
    }
    if (spec[name] === "bool") {
      flags[name] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) {
      throw new UserError(`--${name} needs a value`);
    }
    flags[name] = value;
  }

  return [flags as Flags<S>, positionals];
}
