# Test 05 — Recording is a live-watchable FLV

**Validates:** `record-start` produces an `.flv` that is a **valid, growing video
while still recording** (not just after stopping), and `record-stop` merely
terminates the recorder. Two regressions this guards against: recording to a
format that's only valid once finalized (old MP4 behavior), and output buffering
that leaves the file empty until stop (fixed with `-flush_packets 1`).

**Prereqs:** [00-build-image](00-build-image.md). Uses
[scripts/type-marker.js](scripts/type-marker.js) as on-screen activity.

## Steps

```sh
export DRIVE_UI_IN_DOCKER_NAME=drive-ui-in-docker-05
export DRIVE_UI_IN_DOCKER_NO_PORTS=1
D=skills/drive-ui-in-docker/scripts/drive-ui-in-docker
W=.tmp/drive-ui-in-docker
T=skills/drive-ui-in-docker/skill-tests/scripts
$D up 1024x768
for i in $(seq 1 20); do $D exec xdpyinfo -display :0 >/dev/null 2>&1 && break; sleep 1; done
$D launch xterm -geometry 100x30+50+50
sleep 3

$D record-start 05-demo.flv
$D run $T/type-marker.js >/dev/null 2>&1            # ~1.5s of activity while recording
s1=$(stat -c%s $W/05-demo.flv)

# --- MID-RECORDING (recorder still running): the file must already be valid ---
ffprobe -v error -show_entries 'format=format_name : stream=codec_name,width,height' \
  -of default=noprint_wrappers=1 $W/05-demo.flv
ffmpeg -v error -y -i $W/05-demo.flv -frames:v 1 $W/05-midframe.png    # decode a frame from the live file

$D run $T/type-marker.js >/dev/null 2>&1           # more activity
s2=$(stat -c%s $W/05-demo.flv)
echo "grew during recording: ${s1}B -> ${s2}B"

$D record-stop
echo "final frames:"; ffprobe -v error -count_frames -select_streams v \
  -show_entries stream=nb_read_frames -of default=noprint_wrappers=1 $W/05-demo.flv
```

## Verify

- Mid-recording ffprobe prints `format_name=flv`, `codec_name=h264`, `1024x768`
  **before** `record-stop` — proves live validity.
- `.tmp/drive-ui-in-docker/05-midframe.png` exists and is a valid PNG (`file` it,
  or **Read** it) — the still-growing file decodes.
- `s2 > s1` — the file grows while recording (flushing works).
- Final `nb_read_frames` is a positive number.

## Cleanup

```sh
$D down
```
