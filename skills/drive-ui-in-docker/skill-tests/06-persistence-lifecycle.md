# Test 06 - Persistent lifecycle: down preserves, destroy removes

**Validates:** `down` *stops* the container (state preserved), `up` *resumes* it, and only `destroy` deletes it. This is what lets a user install an app once (e.g. a browser) and reuse it across sessions without reinstalling.

**Prereqs:** [00-build-image](00-build-image.md). Start from a clean slate (`$D destroy` first if a container already exists).

## Steps

```sh
export DRIVE_UI_IN_DOCKER_NAME=drive-ui-in-docker-06
export DRIVE_UI_IN_DOCKER_NO_PORTS=1
export DRIVE_UI_IN_DOCKER_WORK=.tmp/drive-ui-in-docker
D=skills/drive-ui-in-docker/scripts/drive-ui-in-docker
$D destroy                                   # ensure clean start
$D up 1024x768
$D exec sh -c 'echo appdata > /persist-marker'   # simulate an installed app / state

$D down                                      # STOP (must preserve)
$D status                                    # expect: stopped - 'up' to resume
docker ps -a --filter name=^drive-ui-in-docker$ --format '{{.Status}}'   # expect: Exited (...)

$D up                                        # RESUME (no WxH)
echo "after resume: $($D exec cat /persist-marker 2>/dev/null || echo MISSING)"

$D destroy                                   # REMOVE
$D status                                    # expect: not created
$D up 1024x768                               # fresh container
echo "after destroy+fresh: $($D exec cat /persist-marker 2>/dev/null || echo ABSENT)"
```

## Verify (deterministic)

- After `down`: `status` shows **stopped**; `docker ps -a` shows **Exited**, not gone.
- After `up` resume: marker prints **`appdata`** (state survived stop/start).
- After `destroy`: `status` shows **not created**.
- After destroy + fresh `up`: marker is **`ABSENT`** (destroy cleared the state).

## Cleanup

```sh
$D destroy
```
