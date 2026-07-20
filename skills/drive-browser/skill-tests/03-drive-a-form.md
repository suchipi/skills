# Test 03 - Drive a form

**Validates:** `type` (with replace), `click`, `wait`, `press`, and `scroll` actually
change page state, and observation confirms it.

**Prereqs:** [00-setup](00-setup.md).

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-03
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --size 1024x768 --url "$PAGE"
$DB type '#name' first
$DB type '#name' Lily            # must replace, not append
$DB eval 'document.getElementById("name").value'
$DB click '#greet'
$DB text '#out'
$DB wait '#later'                # appears ~1s after the click
$DB screenshot 03-after.png
$DB scroll 1500
$DB eval 'Math.round(window.scrollY)'
$DB press Home
sleep 1
$DB eval 'Math.round(window.scrollY)'   # must be 0: proves the key press landed
$DB scroll 0 40                         # horizontal
$DB type '#name' ' Skye' --append
$DB eval 'document.getElementById("name").value'
$DB screenshot 03-element.png --selector '#out'
```

## Verify

- Deterministic:
  - `eval` after the two `type` calls prints `Lily` (not `firstLily`).
  - `text '#out'` prints `Hello, Lily!`.
  - `wait '#later'` prints `#later visible` (it must not time out).
  - `eval 'Math.round(window.scrollY)'` prints a number > 1000.
  - After `press Home`, `window.scrollY` is `0`. (Asserting `wait '#greet'` instead
    would pass either way: puppeteer's `visible` means "has a box", not "in view".)
  - `type --append` leaves `Lily Skye`, so it added to the value instead of replacing it.
  - `screenshot --selector '#out'` writes a PNG much smaller than the viewport
    (`file .tmp/drive-browser-03/03-element.png` -> a few hundred px wide).
- Visual: **Read** `.tmp/drive-browser-03/03-after.png` - the input contains `Lily`
  and the bold text `Hello, Lily!` is below it.

## Cleanup

```sh
$DB down
```
