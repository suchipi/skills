# Test 02 - Observe commands

**Validates:** `elements`, `text`, `html`, and `eval` report the live DOM.

**Prereqs:** [00-setup](00-setup.md).

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-02
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --url "$PAGE"
$DB elements
$DB elements 'button'
$DB text h1
$DB html '#out'
$DB eval 'document.title'
$DB eval '({ buttons: document.querySelectorAll("button").length })'
```

## Verify

- Deterministic:
  - `elements` lists `#name`, `#greet`, `#link`, `#boom`, `#alert`, `#popup` - each on its own line as a usable CSS selector, with text and an `@x,y,w,h` box. The hidden `#later` div is not interactive and must not appear.
  - `elements 'button'` lists only the four buttons.
  - `text h1` prints exactly `Test Page`.
  - `html '#out'` prints `<div id="out"></div>`.
  - `eval 'document.title'` prints `drive-browser test page`.
  - The last `eval` prints JSON `{ "buttons": 4 }`.
- Sanity: paste one of the selectors from `elements` into `$DB click <selector>` and it should succeed (it is a real selector, not a description).

## Cleanup

```sh
$DB down
```
