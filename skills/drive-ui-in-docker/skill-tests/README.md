# Skill regression tests (manual)

Hand-runnable regression tests for the `drive-ui-in-docker` skill — **not** an
automated suite. Each `NN-*.md` is one test case: a short list of commands to run
and what to verify. Reusable suchibot scripts live in `scripts/`.

## Why manual

Most of what this skill does can only be judged by *looking* at a screenshot (did
the app render? did the click land where intended?). So verification is a mix of:

- **deterministic** checks — exact command output, exit codes, or file properties;
  the test states the expected result.
- **visual** checks — "Read `.tmp/drive-ui-in-docker/<file>.png` and confirm X".
  A human, or an agent via the Read tool, eyeballs the image.

## Running

- Run every command from the **repo root**. Each block defines `D=` for the CLI.
- Docker must be running.
- Tests share one container (`drive-ui-in-docker`) and the host work dir
  `.tmp/drive-ui-in-docker/` (where screenshots/videos land). Run
  **[00-build-image.md](00-build-image.md) first**; the rest assume the image
  exists and are otherwise independent.
- Each test ends with a **Cleanup** block. To hard-reset at any point:
  ```sh
  skills/drive-ui-in-docker/scripts/drive-ui-in-docker destroy
  rm -rf .tmp/drive-ui-in-docker
  ```
- A snippet several tests use to wait for the X server after `up`:
  ```sh
  for i in $(seq 1 20); do $D exec xdpyinfo -display :0 >/dev/null 2>&1 && break; sleep 1; done
  ```

## Index

| Test | Validates |
|---|---|
| [00-build-image](00-build-image.md) | Image builds; node/npm/suchibot/xrandr/ffmpeg/vncsnapshot present |
| [01-lifecycle-and-screenshot](01-lifecycle-and-screenshot.md) | `up` → `launch` → `shot` → `down`; app renders |
| [02-drive-with-suchibot](02-drive-with-suchibot.md) | `run` drives mouse/keyboard and exits cleanly (no hang) |
| [03-complex-app-gimp](03-complex-app-gimp.md) | Drives a real multi-panel app (GIMP): menu, dialog, draw |
| [04-screen-capture](04-screen-capture.md) | `shot` (PNG) and `vncshot` (JPEG) produce valid images |
| [05-record-live-flv](05-record-live-flv.md) | `record-start` FLV is valid & growing *mid*-recording |
| [06-persistence-lifecycle](06-persistence-lifecycle.md) | `down` preserves state; `destroy` removes it |
| [07-resolution-resize](07-resolution-resize.md) | `down`+`up WxH` changes resolution, preserves state |
| [08-suchibot-key-enum](08-suchibot-key-enum.md) | SKILL.md key list stays complete vs the installed `Key` enum (drift check) |
