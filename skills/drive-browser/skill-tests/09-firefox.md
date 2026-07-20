# Test 09 - Firefox

**Validates:** `up --browser firefox` drives Firefox through puppeteer's WebDriver BiDi
support, with the same commands and the same console capture as Chrome, and that the
two documented differences behave as documented: no video recording, and `--channel`
being rejected.

**Prereqs:** [00-setup](00-setup.md). The first run downloads a Firefox build into
`~/.cache/puppeteer` (~100 MB), so allow a few minutes.

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-09
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --browser firefox --size 1024x768 --url "$PAGE"
$DB status
$DB elements | head -4
$DB type '#name' Firefox
$DB click '#greet'
$DB text '#out'
$DB wait '#later'
$DB screenshot 09-firefox.png
$DB eval 'navigator.userAgent'
$DB click '#boom'
$DB click '#alert'
$DB eval '1 + 1'
$DB console --tail 4
$DB run skills/drive-browser/examples/example.mts "$PAGE"
$DB record-start 09.webm; echo "record-exit=$?"
$DB up --browser firefox --channel chrome; echo "channel-exit=$?"
```

## Verify

- Deterministic:
  - `status` prints `browser:  firefox running (headless 1024x768 ...)`.
  - `elements` lists the same selectors as [02](02-observe-commands.md) (boxes differ
    slightly - Firefox lays the widgets out a few pixels wider).
  - `text '#out'` prints `Hello, Firefox!`, and `wait '#later'` succeeds.
  - `eval 'navigator.userAgent'` contains `Firefox/`.
  - `console --tail 4` shows `console/log: page loaded`, `console/warn: greeted`,
    `pageerror: Error: kaboom` and `dialog/alert: hi there` - console capture works the
    same as in Chrome, and `eval '1 + 1'` printing `2` proves the dialog did not block.
  - `run` prints the example script's JSON with `"heading": "Test Page"`.
  - `record-start` fails with `recording uses puppeteer's screencast, which needs CDP`
    and `record-exit=1`.
  - `up --browser firefox --channel chrome` fails with the `--channel` message and
    `channel-exit=1`.
  ```sh
  file .tmp/drive-browser-09/09-firefox.png   # -> PNG image data, 1024 x 768
  ```
- Visual: **Read** `.tmp/drive-browser-09/09-firefox.png` - the test page rendered by
  Firefox, showing `Hello, Firefox!`.

## Cleanup

```sh
$DB destroy
```
