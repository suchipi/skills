---
name: eval-and-hillclimb
description: >-
  Build an eval for Claude Code instructions (a skill, rule, CLAUDE.md, or
  output style), then hillclimb them against it. Use when the user asks to
  eval, evaluate, test, benchmark, measure, or score a rule or skill; to check
  whether a skill triggers reliably or a rule actually changes behavior; to
  compare two versions of one; or to iteratively improve one against
  measurements.
---

# Eval and Hillclimb

Follow [Automating eval design and hillclimbing](https://claude.dev/blog/automating-eval-design-and-hillclimbing/) by running both of these, in order:

1. `/claude-api build-eval`
2. `/claude-api hillclimb`

Those guides assume "the app" is code that calls the Claude API. Here, the app is Claude Code with the instruction installed. When the guide asks for the app's entry point, use the runner below.

## Runner

Before the first trial:

1. Create `/tmp/claude-eval/<run-id>/` with `mkdir -p /tmp/claude-eval && mktemp -d /tmp/claude-eval/XXXXXX`, and record the printed path in `_state.json` so every later round reuses it. Keep it out of the repo or user's home directory, because Claude Code also reads instructions from parent directories.
2. Run one sanity trial per arm to confirm the `without` arm can't see the instruction.

For each trial (case × arm (`with`, `without`) × rep):

1. Make a fresh trial dir inside `/tmp/claude-eval/<run-id>/` and copy in the case's fixture.
2. In the `with` arm only, install the instruction where it lives in production: `.claude/rules/<rule>.md`, `CLAUDE.md`, or `--plugin-dir <plugin>` for a skill.
3. Run `claude -p "<prompt>" --output-format stream-json --verbose --no-session-persistence`, using the same `--model`, `--effort`, and permission flags in both arms. Save the stream as the trace, outside `/tmp/claude-eval/<run-id>/`.

A skill fired if the trace has a `Skill` tool call naming it.

After the whole eval run (build-eval and hillclimb) is done, delete `/tmp/claude-eval/<run-id>/`.
