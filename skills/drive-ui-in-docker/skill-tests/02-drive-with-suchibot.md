# Test 02 - Drive mouse/keyboard with suchibot

**Validates:** `run` executes a suchibot script that moves the mouse, clicks, and types into a real app - and that it **exits on its own** (suchibot used as a Node library; the old `process.exit(0)` workaround is gone). A hang here is a regression.

**Prereqs:** [00-build-image](00-build-image.md). Uses [scripts/type-marker.js](scripts/type-marker.js).

## Steps

```sh
export DRIVE_UI_IN_DOCKER_NAME=drive-ui-in-docker-02
export DRIVE_UI_IN_DOCKER_NO_PORTS=1
export DRIVE_UI_IN_DOCKER_WORK=.tmp/drive-ui-in-docker
D=skills/drive-ui-in-docker/scripts/drive-ui-in-docker
$D up 1024x768
for i in $(seq 1 20); do $D exec xdpyinfo -display :0 >/dev/null 2>&1 && break; sleep 1; done
$D launch xterm -geometry 100x30+50+50
sleep 3

# Time it and cap it - must finish in a couple of seconds, not time out.
start=$(date +%s)
timeout 25 $D run skills/drive-ui-in-docker/skill-tests/scripts/type-marker.js
echo "run exit=$?  elapsed=$(( $(date +%s) - start ))s"
$D shot 02-after.png
```

## Verify

- Deterministic: `run exit=0` and `elapsed` is a few seconds (**not** ~25 - that would mean `timeout` killed a hung process → regression).
- Visual: **Read** `.tmp/drive-ui-in-docker/02-after.png` - expect the terminal to show the typed command and its output line **`SKILLTEST_DRIVE_OK`**.

## Cleanup

```sh
$D down
```
