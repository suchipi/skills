# Test 01 - Lifecycle and screenshot

**Validates:** `up` launches a browser that outlives the CLI invocation, `screenshot` writes a
PNG to the work dir, `status` reports the session, and `down` closes it.

**Prereqs:** [00-setup](00-setup.md).

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-01
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --size 1024x768 --url "$PAGE"
$DB status
$DB screenshot 01-shot.png
$DB screenshot 01-full.png --full
$DB down
$DB status
```

## Verify

- Deterministic:
  ```sh
  file .tmp/drive-browser-01/01-shot.png    # -> PNG image data, 1024 x 768
  file .tmp/drive-browser-01/01-full.png    # -> PNG, taller than 768 (page is 2000px tall)
  ```
  The first `status` prints `browser: running (headless 1024x768 ...)` and one tab
  whose URL is the fixture. After `down`, `status` prints `browser: not running` and
  `profile: ... (preserved)`.
- Visual: **Read** `.tmp/drive-browser-01/01-shot.png` - expect the "Test Page"
  heading, a text input, and the Greet / Throw / Alert / Open tab buttons.

## Cleanup

```sh
$DB down      # already down; harmless
```
