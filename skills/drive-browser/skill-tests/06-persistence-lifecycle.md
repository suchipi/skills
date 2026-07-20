# Test 06 - Persistence lifecycle

**Validates:** `down` closes the browser but preserves the profile (so cookies /
localStorage survive a restart), while `destroy` deletes it. Also checks the guards:
commands fail cleanly with no browser, and `up` refuses to start a second one.

**Prereqs:** [00-setup](00-setup.md).

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-06
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --url "$PAGE"
$DB eval 'localStorage.setItem("persisted", "yes"), "set"'
$DB up                              # expect: refuses, already running
$DB down
$DB screenshot nope.png; echo "exit=$?"              # expect: clean error, not a stack trace
$DB up --url "$PAGE"
$DB eval 'localStorage.getItem("persisted")'   # expect: yes
$DB destroy
test -d .tmp/drive-browser-06/profile && echo "BUG: profile still there"
$DB up --url "$PAGE"
$DB eval 'localStorage.getItem("persisted")'   # expect: null
$DB down

# a profile outside the work dir is preserved unless you insist
mkdir -p .tmp/drive-browser-06-profile
$DB up --profile "$PWD/.tmp/drive-browser-06-profile" --url "$PAGE"
$DB down
$DB destroy; echo "exit=$?"                    # expect: refuses, exit=1
test -d .tmp/drive-browser-06-profile && echo "outside profile kept"
$DB destroy --force                            # expect: removes it
```

## Verify

- Deterministic:
  - The second `up` prints `drive-browser: a browser is already running (use 'down' to close it)`.
  - `screenshot` with nothing running prints `drive-browser: no browser is running. Run: drive-browser up`
    and `exit=1`.
  - After the restart, `eval` prints `yes`.
  - `destroy` prints the removed-profile line; the `test -d` line prints nothing.
  - After `destroy`, `eval` prints `null`.
  - `destroy` on the outside profile refuses with `refusing to delete ...` and `exit=1`,
    the directory is still there, and `destroy --force` then removes it. This is the
    guard against deleting a real browser profile someone pointed `--profile` at.
  - The second `up` after `destroy` did **not** reinstall puppeteer (no npm output) -
    only the profile was removed, not the work dir's `node_modules`.

## Cleanup

```sh
$DB destroy
```
