# Test 07 — Change resolution via down/up, preserving state

**Validates:** `down` then `up WxH` changes the display resolution (applied live
via `xrandr` on resume) **without** destroying the container — for both a
TigerVNC preset size and an arbitrary custom size — while installed state
survives, and that an app launched **after** the resize renders on the new
geometry (the real-world reason to resize).

**Prereqs:** [00-build-image](00-build-image.md). Start clean.

## Steps

```sh
export DRIVE_UI_IN_DOCKER_NAME=drive-ui-in-docker-07
export DRIVE_UI_IN_DOCKER_NO_PORTS=1
D=skills/drive-ui-in-docker/scripts/drive-ui-in-docker
W=.tmp/drive-ui-in-docker
dims() { $D exec xdpyinfo -display :0 | awk '/dimensions/{print $2}'; }
$D destroy
$D up 1024x768
for i in $(seq 1 20); do $D exec xdpyinfo -display :0 >/dev/null 2>&1 && break; sleep 1; done
$D exec sh -c 'echo appdata > /persist-marker'
echo "created:  $(dims)"                         # 1024x768

$D down; $D up 1920x1080                          # preset resize on resume
echo "preset:   $(dims)  marker=$($D exec cat /persist-marker 2>/dev/null)"

$D down; $D up 1440x900                            # custom (non-preset) resize
echo "custom:   $(dims)  marker=$($D exec cat /persist-marker 2>/dev/null)"

# Real-world usage: launch an app onto the freshly-resized display. The sleep also
# lets the desktop settle — the fluxbox toolbar redraws for the new size, which a
# capture taken immediately after xrandr can otherwise race and miss.
$D launch xterm -geometry 100x30+80+80
sleep 3
$D shot 07-resized.png
```

## Verify

- Deterministic: dims report `1024x768` → `1920x1080` → `1440x900`; `marker=appdata`
  at each resized step (state preserved across resolution changes).
  ```sh
  file .tmp/drive-ui-in-docker/07-resized.png     # -> PNG image data, 1440 x 900
  ```
  The PNG being 1440x900 proves the framebuffer actually resized (not just the
  reported size).
- Visual: **Read** `.tmp/drive-ui-in-docker/07-resized.png` — an **xterm window**
  (launched *after* the resize) renders near the top-left of the 1440x900 frame,
  and the **fluxbox toolbar** runs along the bottom edge now listing the xterm.
  This confirms apps launched onto a resized display appear correctly, and that
  the toolbar follows the resize (given a moment to redraw).

## Cleanup

```sh
$D destroy
```
