---
name: drive-browser
description: >-
  Drive and observe a real web browser on the host (no Docker) with Node +
  puppeteer. A detached daemon owns a Chrome instance, so a helper CLI can
  navigate, click, type, screenshot, read the DOM, capture console output, run
  arbitrary puppeteer scripts, and record video across separate invocations. Use
  when the user wants to control, test, scrape, screenshot, or record a website
  or local web app - e.g. "click through my dev server", "screenshot this page",
  "log into this site and check X", "why is this page erroring", or "automate
  this web flow with puppeteer".
---

# Drive Browser

Automate and observe a web page on the host machine using an observe -> act -> observe loop:

1. **Observe** - `screenshot` a PNG and Read it, and/or `elements` / `text` to see the DOM.
2. **Act** - `click` / `type` / `goto`, or `run` a puppeteer script for anything richer.
3. **Repeat** - observe again to confirm the effect, then continue.

Everything goes through one helper CLI: `scripts/drive-browser.ts`. A **detached daemon process owns the browser and runs the page commands**, so the browser stays open between commands and keeps capturing console output the whole time; the CLI just sends each command to it over a unix socket. Screenshots, videos, and logs land in the work dir, a scratch directory you pick to suit the project (see below), where you can Read them.

This is the non-Docker sibling of `drive-ui-in-docker`: same loop, but it drives a browser via the DevTools protocol (selectors, DOM, console) instead of an X11 desktop via synthetic input.

## Quick start

Alias the CLI via `${CLAUDE_SKILL_DIR}` - the skill's own directory, which Claude Code sets whether this is a project skill or an installed plugin (the fallback covers the case where it isn't set). Point `DRIVE_BROWSER_WORK` at a scratch directory the project is happy to have written to, per **Choosing the work dir** below:

```sh
DB="${CLAUDE_SKILL_DIR:-.claude/skills/drive-browser}/scripts/drive-browser.ts"
export DRIVE_BROWSER_WORK=/tmp/drive-browser   # or a gitignored scratch dir in the repo

$DB up --url http://localhost:3000   # launch (first run installs puppeteer + Chrome)
$DB elements                         # see what's clickable, with selectors
$DB screenshot state.png             # capture -> $DRIVE_BROWSER_WORK/state.png (Read it)
$DB type '#email' me@example.com
$DB click 'button[type=submit]'
$DB wait --idle
$DB screenshot after.png             # confirm
$DB down                             # close the browser (profile preserved)
```

`up` is **Chrome, headless, by default**. Add `--headful` to open a real window, which lets the user watch (and take over) while you drive; `--size WxH` (default 1280x800); `--channel chrome` to use the system Chrome instead of puppeteer's download; `--browser firefox` to drive Firefox (see below).

Requires **Node >= 22.12** (puppeteer 25's floor) on PATH. The CLI is TypeScript that Node runs directly via type stripping - the shebang passes `--experimental-strip-types`, so there is no build step and nothing to install for the CLI itself. `ffmpeg` is only needed for `record-start`.

## Choosing the work dir

Screenshots, videos, logs, the puppeteer install, and the browser profile all land in one work dir, so it has to be somewhere scratch files are welcome. Pick it at the start of the session and export `DRIVE_BROWSER_WORK`; every command reads it, so exporting it once in the shell you drive from covers the whole session.

1. Get the repo root with `git rev-parse --show-toplevel`. If that fails, the project isn't a git repo: go to step 3.
2. Read `<root>/.gitignore` and look for an ignored **general-purpose scratch directory** - `.tmp/`, `tmp/`, `temp/`, `.temp/`, `scratch/`, or similar. If there is one, use it: `DRIVE_BROWSER_WORK=<root>/<that dir>/drive-browser`. Skip any entry that is ignored for a *specific* purpose, however tmp-ish its name sounds: build output (`dist/`, `build/`, `out/`, `target/`, `.next/`), tool caches (`.cache/`, `.parcel-cache/`, `.pytest_cache/`, `node_modules/.cache/`), coverage, logs, or anything scoped to one tool (`.gradle/tmp/`). Those belong to something else, which will either be confused by a browser profile appearing inside them or delete it out from under you. If the only candidates look like that, treat the repo as having no scratch dir and go to step 3.
3. No repo, or no general-purpose scratch dir: use the system temp dir - `DRIVE_BROWSER_WORK=/tmp/drive-browser` (`/private/tmp/drive-browser` for macOS's real path).

Don't edit `.gitignore` or invent a new ignored directory just to have somewhere to write. The point of reading `.gitignore` is to use what the project already sanctions, and `/tmp` is a perfectly good answer when nothing does. An explicit project instruction naming a scratch dir outranks all of this.

## The observe -> act loop (how you should work)

1. **Observe the DOM first, pixels second.** `$DB elements` prints every visible interactive element as a ready-to-use CSS selector plus its text and box; `$DB text` dumps visible text. Selectors are far more robust than coordinates - prefer them. Screenshot when you need to judge *layout or styling*, or when the DOM is opaque.
2. **Act with one command per step** (`click`, `type`, `goto`, `press`, `scroll`), or `run` a script when a step needs conditionals, loops, or multiple waits.
3. **Wait explicitly**, don't sleep-and-hope: `$DB wait '<selector>'` or `$DB wait --idle`. Most flaky automation is a missing wait.
4. **Verify**: `screenshot` + Read, or `text` / `eval`. If something looks wrong, check `$DB console` - the daemon has been recording console messages, page errors, failed requests, and dialogs the whole time.

## Commands

| Command | Purpose |
|---|---|
| `setup` | Install puppeteer + its browser into the work dir (implied by `up`) |
| `up [opts]` | Launch the browser. `--browser chrome\|firefox` `--headful` `--size WxH` `--url URL` `--channel NAME` `--profile DIR` |
| `goto <url>` | Navigate the active tab (scheme optional) |
| `screenshot [name.png]` | Screenshot -> work dir (names cannot escape it). `--full` for full page, `--selector S` for one element |
| `text [selector]` | Visible text (`innerText`) of the page or an element |
| `html [selector]` | Full HTML, or one element's `outerHTML` |
| `elements [selector]` | Visible interactive elements: CSS selector, text, href, box |
| `click <selector>` | Wait for the element to be visible, then click it |
| `type <selector> <text>` | Focus, clear, and type (`--append` keeps the existing value; quote the text, and put `--` before it if it starts with dashes) |
| `press <key>` | Key press on the page, e.g. `Enter` `Tab` `ArrowDown` `Escape` |
| `scroll <dy> [dx]` | `window.scrollBy` in pixels |
| `wait <selector>` / `wait --idle` | Wait for visibility (`--hidden` to invert) or network idle. `--timeout ms` |
| `eval <js>` | Evaluate an expression in the page; result printed as JSON |
| `run <script> [args]` | Run a puppeteer script (`.mts`/`.ts`/`.js`) against the live browser |
| `pages` / `use <n>` | List tabs / set the active tab (sticky across commands) |
| `console [--tail N] [--clear]` | Console output, page errors, failed requests, dialogs (rotated past 5 MB) |
| `record-start [name.webm]` / `record-stop` | Record the active page to video (needs `ffmpeg`) |
| `status` | Session state, open tabs, work-dir contents |
| `down` | Close the browser; the profile (cookies, logins) is preserved |
| `destroy [--force]` | Close it and delete the profile. Refuses a profile outside the work dir unless `--force` |

`DRIVE_BROWSER_WORK` sets the work dir (see **Choosing the work dir**); left unset it falls back to `/tmp/drive-browser`. Distinct values also let you run several independent browsers side by side.

## Writing scripts (`run`)

Use `run` whenever a step is more than one action: multi-step forms, retry loops, scraping a list, intercepting requests, anything needing real control flow. The script exports one async function - `module.exports = fn` (CommonJS) or `export default fn` (ESM); its return value is printed as JSON, so a script can double as a query.

**TypeScript or JavaScript**, either way: Node strips the types, so a TS script runs as-is with no build step and nothing to configure. `.mts` (TS) and `.mjs` (JS) are the safe choices for a standalone script - they are ESM wherever they sit, so they need no `package.json` next to them; `.ts` and `.js` follow the module type of the project they live in, and `.cts` / `.cjs` (or `module.exports`) are CommonJS. Import `ScriptContext` for a typed context.

```ts
// scrape.mts  ->  drive-browser.ts run scrape.mts https://example.com
import type { ScriptContext } from "<skill dir>/scripts/lib/browser-commands.ts";

export default async function scrape({ page, args, screenshot }: ScriptContext) {
  await page.goto(args[0], { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { visible: true });
  await screenshot("scraped.png");           // writes into the work dir, returns the path
  return page.$$eval("a", (anchors) => anchors.map((a) => a.href));
}
```

Context: `page` (active tab), `browser`, `pages`, `puppeteer` (the module), `args` (extra CLI args), `work` (work dir path), `log`, `screenshot(name, opts?)`. The full puppeteer API is available on `page` / `browser`: https://pptr.dev/api

Useful pieces: `page.waitForSelector`, `page.$eval` / `$$eval`, `page.evaluate`, `page.locator(sel).click()`, `page.waitForNavigation`, `page.setRequestInterception`, `page.keyboard` / `page.mouse` (for drags and hovers), `page.setCookie`, `page.emulate(puppeteer.KnownDevices["iPhone 15"])`.

See `examples/example.mts`.

## Using Firefox instead of Chrome

```sh
$DB up --browser firefox --url http://localhost:3000
```

Puppeteer drives Firefox through **WebDriver BiDi** rather than CDP ([background](https://hacks.mozilla.org/2024/08/puppeteer-support-for-firefox/)). The first `up --browser firefox` downloads a Firefox build into puppeteer's cache (`~/.cache/puppeteer`); after that it starts as fast as Chrome. Everything else about the workflow is identical - same commands, same work dir, same `run` scripts - so use it to check cross-browser behaviour, or when a site treats Chrome differently.

What differs in Firefox mode:

- **No `record-start`.** Puppeteer's screencast is CDP-only, so recording refuses with a message. Take screenshots, or run the same flow in Chrome for a video.
- **No `--channel`.** That flag selects a Chrome build; pass `--browser firefox` alone, or point `--profile` at a profile dir you want reused.

Everything else matches Chrome, because the daemon holds the session and runs the commands inside it: console output, page errors, dialogs, `elements`, `run` scripts, tab switching, and profile persistence (cookies *and* `localStorage` survive `down` + `up`).

## Notes & troubleshooting

- **Lifecycle - prefer `down`, not `destroy`**: `down` closes the browser but keeps the profile dir, so cookies and logins survive and the next `up` resumes signed in. `destroy` deletes that profile - and refuses if you pointed `--profile` at a directory outside the work dir, since that is probably a profile you use elsewhere; `--force` overrides. The puppeteer install in the work dir survives both.
- **Screenshot pixels vs CSS pixels**: on a Retina display a headful screenshot is 2x the CSS size, so image coordinates are *not* the numbers `elements` prints. This is another reason to act on selectors; if you truly need pixel input, use `page.mouse` inside a `run` script (CSS pixels) rather than reading off the image.
- **The daemon is the owner**: it holds the only browser connection and runs every page command (this is required for Firefox, which allows one WebDriver BiDi session, and it is what keeps console capture running between commands). If it dies, the browser goes with it. `status` reports what's live; `down` then `up` is the reset. Daemon errors are appended to `daemon.log` in the work dir.
- **Dialogs are auto-dismissed** and logged, so an `alert`/`confirm` can't block later commands. If a flow needs "OK" rather than "Cancel", handle it inside a `run` script with your own `page.on("dialog", ...)`.
- **A tab that opens a dialog while it is still loading can wedge Chrome.** A modal dialog blocks its renderer, and puppeteer cannot attach to a blocked renderer, so commands that touch pages fail with `ProtocolError: ... timed out` after 30s. This is an upstream puppeteer/Chrome issue ([puppeteer#9729](https://github.com/puppeteer/puppeteer/issues/9729)), not something this skill works around - every puppeteer user hits it. Recover with `down` then `up` (`status` keeps working meanwhile), or use `--browser firefox`, which is unaffected.
- **New tabs**: popups and `target=_blank` links create tabs. `pages` lists them and `use <n>` switches; the choice sticks until you change it or restart the browser. The listed order is the browser's own, not creation order, so pick the index by the URL `pages` prints.
- **Headless differences**: some sites behave differently headless (bot checks, media, fonts). If a page misbehaves, retry with `up --headful`. Headful is also the mode to use when the user should see what you are doing.
- **Recording** captures the *page* viewport (not the whole window) as VP9 webm, and is **Chrome-only** (see the Firefox section). Puppeteer's screencast encodes through an external `ffmpeg`, so it must be on PATH; `record-start` checks that up front and only reports success once the recorder is actually running. The file is finalized when `record-stop`'s recorder exits, so give it a second before reading it (`down` waits for it too, so stopping that way is safe). Frames are only produced when the page repaints, so recording a static page (or `about:blank`) yields an empty, unplayable file - drive the page while recording. The recording follows the tab that was active when it started, even if you `use` another.
- **If `up` cannot find a browser**, puppeteer's postinstall may have been skipped: newer npm gates install scripts. Run `npm approve-scripts --allow-scripts-pending` (or `npx puppeteer browsers install chrome`) inside the work dir, or point `up --channel chrome` at a system Chrome instead.
- **Editing the CLI**: sources are TypeScript under `scripts/` (entry `drive-browser.ts`, the rest in `scripts/lib/`). Running them needs nothing installed; to typecheck or get editor types, `npm install` in `scripts/` and run `npx tsc --project scripts`.
- **Don't automate sites you're not authorized to**, and remember the profile holds real cookies - `destroy` when a session should not persist.
