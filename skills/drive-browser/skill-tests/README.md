# Skill regression tests (manual)

Hand-runnable regression tests for the `drive-browser` skill - **not** an automated
suite. Each `NN-*.md` is one test case: a short list of commands to run and what to
verify. Shared fixtures live in `fixtures/`, reusable scripts in `scripts/`.

## Why manual

Some of what this skill does can only be judged by *looking* at a screenshot (did the
page render? did the click land?). So verification is a mix of:

- **deterministic** checks - exact command output, exit codes, or file properties;
  the test states the expected result.
- **visual** checks - "Read `.tmp/drive-browser-NN/<file>.png` and confirm X".
  A human, or an agent via the Read tool, eyeballs the image.

## Running

- Run every command from the **repo root**. Each block defines `DB=` for the CLI and
  `PAGE=` for the fixture URL.
- Node >= 22.12 must be on PATH; test 05 also needs `ffmpeg`.
- Each test uses its **own** work dir (`.tmp/drive-browser-NN`) via the
  `DRIVE_BROWSER_WORK` prelude at the top of its block, so **all tests can run in
  parallel** - one per shell/agent. They each get their own browser, profile, and
  screenshots. Run **[00-setup.md](00-setup.md) first**; it warms puppeteer's shared
  browser download cache (`~/.cache/puppeteer`) so the rest only install the npm
  package.
- Tests 01-07 run headless (the default). [08](08-tabs-and-headful.md) passes
  `--headful`, so it opens a real window on your screen.
- Each test ends with a **Cleanup** block. After finishing everything, remove the
  leftovers (this also serves as a hard reset at any point):
  ```sh
  for n in 00 01 02 03 04 05 06 07 08 09 10; do
    DRIVE_BROWSER_WORK=.tmp/drive-browser-$n \
      skills/drive-browser/scripts/drive-browser.ts destroy
  done
  rm -rf .tmp/drive-browser-*
  ```

## Index

| Test | Validates |
|---|---|
| [00-setup](00-setup.md) | `setup` installs puppeteer + a browser into the work dir |
| [01-lifecycle-and-screenshot](01-lifecycle-and-screenshot.md) | `up` -> `screenshot` -> `status` -> `down`; the page renders |
| [02-observe-commands](02-observe-commands.md) | `elements`, `text`, `html`, `eval` describe the page |
| [03-drive-a-form](03-drive-a-form.md) | `type`, `click`, `wait`, `press`, `scroll` change the page |
| [04-run-script](04-run-script.md) | `run` gets a live `page`, `screenshot()` works, return value prints |
| [05-record](05-record.md) | `record-start` / `record-stop` produce a valid video |
| [06-persistence-lifecycle](06-persistence-lifecycle.md) | `down` preserves the profile; `destroy` deletes it |
| [07-console-and-dialogs](07-console-and-dialogs.md) | Console, page errors and auto-dismissed dialogs are captured |
| [08-tabs-and-headful](08-tabs-and-headful.md) | `pages` / `use` tab switching; headful mode renders |
| [09-firefox](09-firefox.md) | `up --browser firefox` drives Firefox; documented differences hold |
| [10-error-handling](10-error-handling.md) | Bad input is reported cleanly and never kills the daemon |
