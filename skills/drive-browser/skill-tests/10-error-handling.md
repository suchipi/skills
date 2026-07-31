# Test 10 - Error handling and survival

**Validates:** bad input is reported as a plain message and never takes the browser down with it. The daemon holds the only browser connection, so anything that can kill it costs the user their session - these are the cases that used to.

**Prereqs:** [00-setup](00-setup.md).

## Steps

```sh
export DRIVE_BROWSER_WORK=.tmp/drive-browser-10
DB=skills/drive-browser/scripts/drive-browser.ts
PAGE="file://$PWD/skills/drive-browser/skill-tests/fixtures/test-page.html"
$DB up --url "$PAGE"
PID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.DRIVE_BROWSER_WORK + "/session.json","utf8")).pid)')

# 1. a mistyped option
$DB screenshot --fullpage; echo "exit=$?"
$DB text h1                                    # the browser must still be there

# 2. an option missing its value
$DB screenshot shot.png --selector; echo "exit=$?"

# 3. an output name that tries to leave the work dir
$DB screenshot ../../escaped.png; echo "exit=$?"

# 4. a selector that never matches
$DB click '#nope'; echo "exit=$?"

# 5. a run script that throws, and one that exports nothing
echo 'export default async () => { throw new Error("boom from a script") }' > /tmp/db-throws.mts
echo 'export const notDefault = 1' > /tmp/db-nofn.mts
$DB run /tmp/db-throws.mts; echo "exit=$?"
$DB run /tmp/db-nofn.mts; echo "exit=$?"
$DB run /tmp/does-not-exist.mts; echo "exit=$?"

# 6. a client that disappears mid-command
timeout 1 $DB wait '#nope' --timeout 20000; echo "client exit=$?"
sleep 2

# 7. malformed input straight to the socket
node -e 'const s=require("net").createConnection(process.env.DRIVE_BROWSER_WORK+"/daemon.sock",()=>s.write("not json\n"));s.on("data",d=>process.stdout.write(d.toString()));s.on("close",()=>process.exit(0))'

# 8. bad `up` arguments
$DB up --size 1280by800; echo "exit=$?"
$DB up --browser safari; echo "exit=$?"
$DB up --channel bogus; echo "exit=$?"
$DB record-start clip.mov; echo "exit=$?"

ps -p $PID >/dev/null && echo "daemon survived everything" || echo "DAEMON DIED"
$DB eval '1 + 1'
```

## Verify

- Every numbered case prints one `drive-browser: ...` line - no stack trace - and `exit=1`:
  - `unknown option --fullpage (accepts --full, --selector)`
  - `--selector needs a value`
  - `'../../escaped.png' would write outside the work dir (...)`
  - `no element matched #nope`
  - `boom from a script` (a script's own error keeps its stack: it is your code)
  - `/tmp/db-nofn.mts must 'module.exports = async ({ page, browser }) => { ... }'`
  - `no such script: /tmp/does-not-exist.mts`
  - `--size must look like 1280x800`, `--browser must be chrome or firefox`, `--channel must be one of chrome, chrome-beta, chrome-canary, chrome-dev`, `recordings must end in .webm, .mp4 or .gif`
- Case 6 exits 124 (killed by `timeout`), case 7 answers `daemon received a malformed request`.
- **`daemon survived everything`**, and `eval '1 + 1'` still prints `2`. A failure here is the important one: a bad flag or a dropped client must never cost a session.
- The three `up` failures leave the *original* browser running - they are rejected before anything is spawned.

## Cleanup

```sh
$DB destroy
rm -f /tmp/db-throws.mts /tmp/db-nofn.mts
```
