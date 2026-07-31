# Test 00 - Image builds with all tooling

**Validates:** the multi-stage Dockerfile builds, and the image has the Node runtime (copied from the official `node:20` image), suchibot, and the capture/resize tools. Run this first.

**Prereqs:** Docker running.

## Steps

```sh
D=skills/drive-ui-in-docker/scripts/drive-ui-in-docker
$D build          # slow the first time (pulls node:20 + suchipi/novnc, npm install)
```

## Verify (deterministic)

```sh
docker run --rm --entrypoint node     drive-ui-in-docker:latest --version      # -> v20.x
docker run --rm --entrypoint npm      drive-ui-in-docker:latest --version      # -> 10.x
docker run --rm --entrypoint printenv drive-ui-in-docker:latest NODE_PATH      # -> /usr/local/lib/node_modules
docker run --rm --entrypoint sh drive-ui-in-docker:latest -c \
  'for b in node npm suchibot ffmpeg vncsnapshot xrandr xdpyinfo; do command -v "$b" || echo "MISSING: $b"; done'
```

Expected: node reports v20, npm v10, `NODE_PATH=/usr/local/lib/node_modules`, and every binary resolves to a path (no "command not found"). suchibot itself is proven end-to-end in [02-drive-with-suchibot](02-drive-with-suchibot.md).

## Cleanup

None - no container is started.
