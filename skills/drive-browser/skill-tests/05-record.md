# Test 05 - Screen recording

**Validates:** `record-start` records the active page in a process that outlives the CLI, and `record-stop` finalizes a playable video.

**Prereqs:** [00-setup](00-setup.md), `ffmpeg` and `ffprobe` on PATH.

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-05
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --size 1024x768 --url "$PAGE"
$DB record-start 05-demo.webm
sleep 1
$DB type '#name' Recorded
$DB click '#greet'
sleep 2
$DB record-stop
sleep 3                      # the recorder finalizes the file as it exits
```

## Verify

- Deterministic:
  ```sh
  ffprobe -v error -select_streams v:0 -count_frames \
    -show_entries stream=codec_name,width,height,nb_read_frames \
    -of default=nw=1 .tmp/drive-browser-05/05-demo.webm
  ```
  Expect `codec_name=vp9`, `width=1024`, `height=768`, and `nb_read_frames` well above zero (dozens of frames for a ~4s capture).
  ```sh
  test -f .tmp/drive-browser-05/recorder.pid && echo "BUG: pid file left behind"
  ```
  Should print nothing.
- Guards:
  - running `record-start` twice without a `record-stop` must fail with `already recording`.
  - with ffmpeg hidden, `record-start` must fail immediately (exit 1) instead of reporting success and dying in the background:
    ```sh
    env PATH="$(dirname "$(which node)"):/usr/bin:/bin" $DB record-start x.webm; echo "exit=$?"
    ```
    Expect `drive-browser: ffmpeg is not on PATH, ...`, `exit=1`, and no `x.webm` in the work dir.
- Visual (optional): play the file (`ffplay .tmp/drive-browser-05/05-demo.webm`) and confirm the text appears in the input and the greeting shows up.

## Cleanup

```sh
$DB down
```
