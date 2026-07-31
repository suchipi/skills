# Test 08 - Tabs and headful mode

**Validates:** `pages` lists tabs, `use` switches the active one and the choice sticks across invocations, and `--headful` opens a real window that renders and screenshots correctly.

**Prereqs:** [00-setup](00-setup.md). This test **opens a browser window on your screen**.

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-08
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --headful --size 900x700 --url "$PAGE"
$DB click '#popup'
sleep 1
$DB pages                                 # note which index is about:blank; call it N
$DB use N                                 # substitute the real number
$DB pages
$DB eval 'location.href'                  # about:blank - the tab you just selected
$DB goto example.com
$DB text h1
$DB use <the fixture's index>
$DB screenshot 08-headful.png
```

## Verify

- Deterministic:
  - The first `pages` lists two tabs (the fixture and `about:blank`) with `*` on the active one. Tab order is the browser's own, **not** creation order, so pick the index by URL rather than assuming.
  - After `use N` the `*` moves to N and stays there for the following commands: `eval 'location.href'` reports that tab's URL, and `goto` navigates that tab.
  - `text h1` on example.com prints `Example Domain`.
  - ```sh file .tmp/drive-browser-08/08-headful.png    # -> PNG image data
    ```
    On a Retina display the pixel size is 2x the CSS viewport - that is expected and
    is why actions use selectors, not image coordinates.
- Visual: a real Chrome window appeared on screen showing the test page, and **Read**
  `.tmp/drive-browser-08/08-headful.png` shows the "Test Page" heading and buttons.

## Cleanup

```sh
$DB destroy
```
