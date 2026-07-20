# Test 04 - Run a puppeteer script

**Validates:** `run` hands a script the live `page`, passes extra CLI args through,
writes screenshots via `screenshot()`, prints the return value, and exits cleanly (no
hang) - for both a JavaScript and a TypeScript script.

**Prereqs:** [00-setup](00-setup.md).

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-04
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --url "$PAGE"
$DB run skills/drive-browser/skill-tests/scripts/fill-and-report.js Suchi
echo "exit=$?"
$DB text '#out'
$DB run skills/drive-browser/examples/example.mts "$PAGE"
```

## Verify

- Deterministic:
  - The first `run` prints `filled in Suchi`, the screenshot path, then JSON with
    `"out": "Hello, Suchi!"` and `"buttons": ["greet","boom","alert","popup"]`.
  - `echo "exit=$?"` prints `exit=0`, and the command returned promptly (a hang here
    means the CLI is not disconnecting from the browser).
  - `text '#out'` still prints `Hello, Suchi!`, proving the script drove the same
    browser the CLI talks to.
  - The example script prints a heading line and JSON with `"heading": "Test Page"`.
  ```sh
  file .tmp/drive-browser-04/04-script.png    # -> PNG image data
  file .tmp/drive-browser-04/example.png      # -> PNG image data
  ```
- Visual: **Read** `.tmp/drive-browser-04/04-script.png` - shows `Hello, Suchi!`.

## Cleanup

```sh
$DB down
```
