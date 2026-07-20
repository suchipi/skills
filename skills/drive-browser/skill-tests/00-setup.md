# Test 00 - Setup

**Validates:** `setup` creates the work dir, installs puppeteer there, and downloads a
browser. Run this first: it warms `~/.cache/puppeteer`, which every other test reuses.

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-00
DB=skills/drive-browser/scripts/drive-browser.ts
node --version
$DB setup
```

## Verify

- Deterministic:
  ```sh
  test -f .tmp/drive-browser-00/package.json && echo ok
  node -e 'console.log(require("./.tmp/drive-browser-00/node_modules/puppeteer/package.json").version)'
  ls ~/.cache/puppeteer            # -> chrome (or chrome-headless-shell)
  ```
  `node --version` must be >= v22.12. The last line of `setup` prints
  `puppeteer <version> ready in <work dir>`.

## Cleanup

None (leave the install; it is reused only within this work dir, but the browser
download cache is shared).
