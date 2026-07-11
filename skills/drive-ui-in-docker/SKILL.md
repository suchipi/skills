---
name: drive-ui-in-docker
description: >-
  Drive and observe any GUI application running inside a Docker container.
  Runs suchipi/docker-novnc (Xvnc + fluxbox + noVNC) with suchibot for
  mouse/keyboard input and ffmpeg/vncsnapshot for screen capture, so you can
  automate, test, or explore arbitrary desktop UI apps headlessly. Use when the
  user wants to control, script, screenshot, or record a GUI app in a container
  — e.g. "automate this Electron/GTK/Qt/X11 app", "click through this UI",
  "screenshot the app running in Docker", or "record a demo of the UI".
---

# Drive UI in Docker

Automate and observe any X11 GUI application inside a container using an
observe → act → observe loop:

1. **Observe** — capture the screen to a PNG and Read it to see the current state.
2. **Act** — write a suchibot script (mouse/keyboard) and run it inside the container.
3. **Repeat** — capture again to confirm the effect, then continue.

Everything is coordinated by one helper CLI: `scripts/drive-ui-in-docker`. All
commands share one container (`drive-ui-in-docker`) and one host↔container work
dir (`.tmp/drive-ui-in-docker` ↔ `/work`), so screenshots land on the host where
you can Read them, and scripts you write into the work dir are runnable inside.

## Architecture

- **Base image `suchipi/novnc`**: runs `Xvnc :0` (VNC on port **5900**, no auth),
  `fluxbox`, and `noVNC` (web on port **8080**). `DISPLAY=:0`.
- **This skill's Dockerfile** extends it with Node + **suchibot** (input) and
  **ffmpeg / vncsnapshot / imagemagick** (capture). suchibot uses nut.js +
  uiohook-napi, so it **must run inside the container** where the X server is.
- The human can watch live at **http://localhost:8080/** while you drive.

## Quick start

The helper CLI is bundled with this skill. Alias it via `${CLAUDE_SKILL_DIR}` —
the skill's own directory, which Claude Code sets whether this is a project skill
or an installed plugin (the fallback covers the case where it isn't set). Run the
commands from your project root so the `.tmp/drive-ui-in-docker` work dir lands
there (the alias `$DUID` is just shorthand for the long command):

```sh
DUID="${CLAUDE_SKILL_DIR:-.claude/skills/drive-ui-in-docker}/scripts/drive-ui-in-docker"

$DUID build                 # one-time: build drive-ui-in-docker:latest (slow — pulls Node, native deps)
$DUID up 1280x800           # start the desktop at a given resolution
$DUID launch xterm          # launch the target app inside it (detached)
$DUID shot                  # capture -> .tmp/drive-ui-in-docker/shot.png  (Read it to see the screen)
$DUID run examples/example.suchibot.js   # drive it
$DUID shot after.png        # confirm the result
$DUID down                  # stop it (keeps the container + anything installed in it)
```

To drive a real app, replace `launch xterm` with your app's launch command
(e.g. `$DUID launch /opt/myapp/myapp`), or bake the app into a Dockerfile that
uses `FROM drive-ui-in-docker:latest` and installs it.

## The observe → act loop (how you should work)

1. `$DUID shot state.png` then **Read** `.tmp/drive-ui-in-docker/state.png`.
   Identify the pixel coordinates of the element you need to interact with. The
   display size is fixed and known (whatever you passed to `up`, default
   1280×800), so image coordinates map 1:1 to suchibot coordinates.
2. Write a small suchibot script into `.tmp/drive-ui-in-docker/` (or anywhere —
   `run` stages it in) that performs ONE coherent step. Keep steps small so you
   can verify each one.
3. `$DUID run <script.js>`.
4. `$DUID shot result.png`, Read it, confirm the UI changed as expected.
   If not, adjust coordinates/timing and retry — do not guess blindly.

Prefer `sleep.sync(ms)` between actions inside a script so the UI can settle,
and take a fresh screenshot whenever the layout may have changed (coordinates
from a stale screenshot are the most common failure).

## suchibot cheatsheet

Scripts use suchibot's API via `require("suchibot")` and are run with `node`.
Use `sleep.sync` (not `sleep.async`) to pace actions between steps. A script that
registers `on*` event handlers must call `suchibot.startListening()` to receive
them and `suchibot.stopListening()` when finished. Reference:
https://github.com/suchipi/suchibot

```js
const { Mouse, Keyboard, Key, MouseButton, Screen, sleep } = require("suchibot");

Mouse.moveTo(x, y);            // instant; add `true` for smooth: moveTo(x, y, true)
Mouse.click(MouseButton.LEFT); // .RIGHT / .MIDDLE
Mouse.doubleClick();
Mouse.hold(MouseButton.LEFT);  Mouse.release(MouseButton.LEFT);   // drag: hold, moveTo, release
Mouse.scroll({ y: 100 });      // +down / -up ; { x } for horizontal
Mouse.getPosition();           // -> {x, y}

Keyboard.tap(Key.ENTER);       // single key
Keyboard.hold(Key.LEFT_CONTROL); Keyboard.tap(Key.A); Keyboard.release(Key.LEFT_CONTROL); // Ctrl+A
Keyboard.type("some text", 20);// optional per-char delay ms

Screen.getSize();              // -> {width, height}
sleep.sync(200);               // blocking pause (use between actions)
```

**`Key` names (verified against the installed enum — the npm README is
inaccurate for modifiers).** Modifiers are SIDE-SPECIFIC: use
`LEFT_CONTROL`/`RIGHT_CONTROL`, `LEFT_SHIFT`, `LEFT_ALT`, `LEFT_SUPER`/`LEFT_META`
— there is **no** bare `CONTROL`/`SHIFT`/`ALT` (referencing one yields
`undefined` → "Pressing/releasing key is not yet supported: undefined").
Other keys: `ENTER TAB ESCAPE BACKSPACE DELETE SPACE INSERT`, arrows
`UP DOWN LEFT RIGHT`, `HOME END PAGE_UP PAGE_DOWN`, `F1`–`F24`, `PRINT_SCREEN
PAUSE_BREAK CAPS_LOCK NUM_LOCK SCROLL_LOCK`, letters `A`–`Z`, numbers
`ZERO`–`NINE`, `NUMPAD_0`–`NUMPAD_9` (+ `NUMPAD_ENTER/ADD/SUBTRACT/...`),
symbols `SEMICOLON EQUAL COMMA MINUS PERIOD SLASH BACKTICK LEFT_BRACKET
RIGHT_BRACKET BACKSLASH QUOTE`. `MouseButton`: `LEFT RIGHT MIDDLE MOUSE4 MOUSE5`.
To dump the full list from a running container:
`$DUID exec node -e 'console.log(Object.keys(require("/usr/local/lib/node_modules/suchibot").Key).join(" "))'`.
See `examples/example.suchibot.js`.

## Capturing the screen

- **`$DUID shot [name.png]`** — default. ffmpeg `x11grab` of `:0`, includes
  the cursor. Auto-detects the display geometry. Prints the host path.
- **`$DUID vncshot [name.jpg]`** — alternative via `vncsnapshot` over VNC
  (:5900). Useful if x11grab misbehaves.
- **`$DUID record-start [name.mp4]` / `record-stop`** — record a video of a
  whole interaction (e.g. to show the user a demo). Stop finalizes the mp4.

Read the resulting file from `.tmp/drive-ui-in-docker/` to analyze it.

## All commands

| Command | Purpose |
|---|---|
| `build` | Build `drive-ui-in-docker:latest` from this skill's Dockerfile |
| `up [WxH]` | Start the VNC desktop (default 1280x800) |
| `launch <cmd...>` | Launch a UI app inside the desktop (detached) |
| `shot [name.png]` | Screenshot via ffmpeg → `$DRIVE_UI_IN_DOCKER_WORK/name` |
| `vncshot [name.jpg]` | Screenshot via vncsnapshot |
| `record-start [name.mp4]` / `record-stop` | Screen recording |
| `run <script.js>` | Run a suchibot script inside the container |
| `exec <cmd...>` | Run any command inside (DISPLAY=:0) |
| `shell` | Interactive shell inside the container |
| `status` | Show container + work-dir state |
| `down` | Stop the container, preserving it (fast resume with `up`) |
| `destroy` | Remove the container entirely (cleanup when done with the skill) |

Env overrides: `DRIVE_UI_IN_DOCKER_NAME` (container), `DRIVE_UI_IN_DOCKER_IMAGE`,
`DRIVE_UI_IN_DOCKER_WORK` (host work dir).

## Notes & troubleshooting

- **Lifecycle — prefer `down`, not `destroy`**: `down` *stops* the container but
  keeps it, so anything installed at runtime (e.g. `exec apt-get install -y
  chromium`) survives and `up` resumes it in seconds. Only `destroy` deletes the
  container and that state — use it when you're done with the skill for a while,
  not between routine uses.
- **Coordinates** are in display pixels, origin top-left, matching your
  screenshots 1:1. Re-screenshot after any layout change.
- **App won't appear**: some apps need env or a bigger `--shm-size` (Chromium/
  Electron). `up` sets `--shm-size=512m`; raise it in `scripts/drive-ui-in-docker`
  if a browser crashes. Check `$DUID exec <app>` output (run non-detached) for errors.
- **Script hangs**: `run` uses `node` (library mode), so pure-action scripts exit
  on their own. A script only stays alive if it calls `suchibot.startListening()`
  (needed for `on*` handlers) — call `suchibot.stopListening()` to let it exit.
  The `suchibot` CLI (`exec suchibot ...`) always starts listening and won't exit,
  so prefer `run`.
- **Watch live**: open http://localhost:8080/ in a browser to see (and even
  take over) the desktop while automating.
- **Resolution**: `up WxH` sets it. To change it later, `down` then `up WxH` —
  the container (and everything installed in it) is preserved and the new size is
  applied live via `xrandr` on resume. Any WxH works, not just common presets.
- **Persisting an app**: for a repeatable target, create a Dockerfile with
  `FROM drive-ui-in-docker:latest`, install the app, and set `DRIVE_UI_IN_DOCKER_IMAGE` to your tag.
