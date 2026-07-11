# Test 04 — Screen capture paths

**Validates:** both capture commands produce valid images: `shot` (ffmpeg
`x11grab`, PNG, auto-detected geometry) and `vncshot` (vncsnapshot over VNC :5900,
JPEG — forces the `hextile` encoding and bounds itself with `timeout`).

**Prereqs:** [00-build-image](00-build-image.md).

## Steps

```sh
export DRIVE_UI_IN_DOCKER_NAME=drive-ui-in-docker-04
export DRIVE_UI_IN_DOCKER_NO_PORTS=1
D=skills/drive-ui-in-docker/scripts/drive-ui-in-docker
$D up 1024x768
for i in $(seq 1 20); do $D exec xdpyinfo -display :0 >/dev/null 2>&1 && break; sleep 1; done
$D launch xterm -geometry 100x30+50+50
sleep 3
$D shot    04-shot.png
$D vncshot 04-vncshot.jpg
```

## Verify (deterministic)

```sh
file .tmp/drive-ui-in-docker/04-shot.png       # -> PNG image data, 1024 x 768
file .tmp/drive-ui-in-docker/04-vncshot.jpg    # -> JPEG image data, 1024x768
```

Both must be valid images at 1024x768. Optionally **Read** either and confirm the
xterm window is visible. `vncshot` returning within its 15s bound (not hanging) is
itself part of the check.

## Cleanup

```sh
$D down
```
