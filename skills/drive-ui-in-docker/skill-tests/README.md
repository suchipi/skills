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
- Each test 01–07 uses its **own** container (`drive-ui-in-docker-NN`) via the
  env prelude at the top of its block (`DRIVE_UI_IN_DOCKER_NAME` +
  `DRIVE_UI_IN_DOCKER_NO_PORTS=1`, which skips host-port publishing so the
  containers don't fight over ports 8080/5900). That means **all tests can run
  in parallel** — one per shell/agent. They share only the image and the host
  work dir `.tmp/drive-ui-in-docker/` (screenshots/videos land there; filenames
  are test-prefixed so they don't collide). Run
  **[00-build-image.md](00-build-image.md) first** to build the shared image.
  (Trade-off: with ports unpublished you can't open the desktop in a browser
  during a run — capture still works over the in-container VNC/X server.)
- Each test ends with a **Cleanup** block, but several (01, 02, 04, 05) clean up
  with `down`, which *preserves* the stopped container. So **after you've finished
  all the tests, destroy the leftovers** (this also serves as a hard-reset at any
  point):
  ```sh
  for n in 01 02 03 04 05 06 07; do
    DRIVE_UI_IN_DOCKER_NAME=drive-ui-in-docker-$n \
      skills/drive-ui-in-docker/scripts/drive-ui-in-docker destroy
  done
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
