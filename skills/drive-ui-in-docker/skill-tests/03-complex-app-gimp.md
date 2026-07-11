# Test 03 — Drive a complex real-world app (GIMP)

**Validates:** the skill can drive a heavyweight, multi-panel GUI app end to end —
opening a menu dialog, clicking a precise button, switching tools via a keyboard
shortcut, and click-dragging on a canvas. This is the "does it really work on a
real app, not just xterm" test.

**Prereqs:** [00-build-image](00-build-image.md). Heavy: installs GIMP at runtime
(~250 MB, needs network). Uses
[scripts/gimp-new-image.js](scripts/gimp-new-image.js) and
[scripts/gimp-draw.js](scripts/gimp-draw.js) (coordinates assume **1280x800**).

## Steps

```sh
export DRIVE_UI_IN_DOCKER_NAME=drive-ui-in-docker-03
export DRIVE_UI_IN_DOCKER_NO_PORTS=1
D=skills/drive-ui-in-docker/scripts/drive-ui-in-docker
T=skills/drive-ui-in-docker/skill-tests/scripts
$D up 1280x800
for i in $(seq 1 20); do $D exec xdpyinfo -display :0 >/dev/null 2>&1 && break; sleep 1; done

# Install + launch GIMP (state persists in the container until `destroy`).
$D exec apt-get update
$D exec apt-get install -y gimp
$D launch gimp
sleep 25                                  # heavyweight cold start
$D shot 03-gimp-open.png

$D run $T/gimp-new-image.js
$D shot 03-gimp-dialog.png

$D run $T/gimp-draw.js
$D shot 03-gimp-drawn.png
```

## Verify (all visual — Read each PNG)

- `03-gimp-open.png` — GIMP's single-window UI: menu bar (File…Help), toolbox,
  tool options, and brushes/layers dockables. Canvas area empty.
- `03-gimp-dialog.png` — a **"Create a New Image"** dialog is open (Width/Height
  fields, Cancel/OK buttons).
- `03-gimp-drawn.png` — a new white canvas exists (title bar shows
  `*[Untitled]… 1920x1080`), the tool options read **Pencil**, and a black
  **zig-zag "W" stroke** is painted across the canvas.

## Cleanup

```sh
$D destroy       # removes the container (and the runtime-installed GIMP)
```
