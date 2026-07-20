# Test 07 - Console capture and dialogs

**Validates:** the daemon records console messages, uncaught page errors, and failed
requests from the moment the browser starts, and auto-dismisses dialogs so they cannot
block later commands.

**Prereqs:** [00-setup](00-setup.md).

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-07
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --url "$PAGE"
$DB click '#greet'
$DB click '#boom'
$DB click '#alert'          # an unhandled alert would block everything after this
$DB eval '1 + 1'            # proves the page is not blocked
$DB eval 'fetch("http://127.0.0.1:9/nope").catch(() => "failed")'
$DB console
$DB console --tail 2
$DB console --clear
$DB console
```

## Verify

- Deterministic, in `console` output:
  - `console/log: page loaded` (captured before any command ran).
  - `console/warn: greeted`.
  - `pageerror: Error: kaboom`.
  - `dialog/alert: hi there`.
  - a `requestfailed` line mentioning `127.0.0.1:9`.
  - `eval '1 + 1'` prints `2` - if it hangs or times out, dialog dismissal is broken.
  - `console --tail 2` prints only the last two lines.
  - After `--clear`, `console` prints `(nothing captured)`.

## Cleanup

```sh
$DB down
```
