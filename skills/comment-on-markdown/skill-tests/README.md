# Skill regression tests (manual)

Hand-runnable regression tests for the `comment-on-markdown` skill's helper script - **not** an automated suite. Each `NN-*.md` is one test case: a short list of commands to run and what to verify. The shared fixture lives in `fixtures/`.

Comments are posted with `curl` against the server's API instead of through the browser, so every check is deterministic.

## Running

- Run every command from the **repo root**. Each block defines `MC=` for the script and `DOC=` for the fixture.
- Node >= 20.11, git, npm, and curl must be on PATH. Test 00 needs network access to clone from GitHub.
- Each test uses its **own** work dir (`.tmp/comment-on-markdown-NN`), so they can run in parallel, but run [00-install.md](00-install.md) first if you want to see a clean install in isolation.
- Every `start` passes `--no-open` so no browser tabs open.
- Each test ends with a **Cleanup** block. To reset everything at once:
  ```sh
  for n in 00 01 02 03; do
    MARKDOWN_COMMENTER_WORK=.tmp/comment-on-markdown-$n \
      node skills/comment-on-markdown/scripts/markdown-commenter.mjs stop
  done
  rm -rf .tmp/comment-on-markdown-*
  ```

## Index

| Test | Validates |
|---|---|
| [00-install](00-install.md) | First `start` clones and installs the app; the next one reuses it |
| [01-lifecycle](01-lifecycle.md) | `start` serves the document, comments reach the file, `stop` kills the server and keeps the file |
| [02-comments-files](02-comments-files.md) | Every run gets a new comments file; `--comments` reuses one; unsafe paths are refused |
| [03-stop-all-and-stale](03-stop-all-and-stale.md) | `stop` with no port stops everything, and never kills a pid that isn't its server |
