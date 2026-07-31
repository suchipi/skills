# Test 01 — Basic lifecycle and screenshot

**Validates:** `up` starts the VNC desktop, `launch` runs an app inside it,
`shot` captures the screen to a PNG on the host, and `down` stops it.

**Prereqs:** [00-build-image](00-build-image.md).

## Steps

```sh
export DRIVE_UI_IN_DOCKER_NAME=drive-ui-in-docker-01
export DRIVE_UI_IN_DOCKER_NO_PORTS=1
export DRIVE_UI_IN_DOCKER_WORK=.tmp/drive-ui-in-docker
D=skills/drive-ui-in-docker/scripts/drive-ui-in-docker
$D up 1024x768
for i in $(seq 1 20); do $D exec xdpyinfo -display :0 >/dev/null 2>&1 && break; sleep 1; done
$D launch xterm -geometry 100x30+50+50
sleep 3
$D shot 01-shot.png
$D status
```

## Verify

- Deterministic:
  ```sh
  file .tmp/drive-ui-in-docker/01-shot.png     # -> PNG image data, 1024 x 768
  ```
  `status` should report `running`, `display: 1024x768`, view URL.
- Visual: **Read** `.tmp/drive-ui-in-docker/01-shot.png` — expect an **xterm
  window** with a shell prompt (`root@…:~#`) near the top-left.

## Cleanup

```sh
$D down          # stop (keeps the container for later tests)
```
