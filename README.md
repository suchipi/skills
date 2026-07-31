# suchipi-skills

suchipi's personal [Claude Code](https://claude.com/claude-code) plugin marketplace, distributed from [github.com/suchipi/skills](https://github.com/suchipi/skills).

It provides a single plugin - **`suchipi-skills`** - that bundles the skills below. More may be added over time.

## Skills

### `drive-ui-in-docker`

Drive and observe any GUI application running inside a Docker container. It spins up a noVNC desktop (Xvnc + fluxbox + noVNC) with [suchibot](https://github.com/suchipi/suchibot) for mouse/keyboard input and ffmpeg/vncsnapshot for screen capture, so Claude can automate, test, or explore arbitrary desktop UI apps headlessly - clicking through a UI, screenshotting an app, or recording a demo. A human can watch (and take over) the desktop live at `http://localhost:8080/` while Claude drives.

Requires **Docker** on the machine running Claude Code.

### `drive-browser`

Drive and observe a real web browser on the host, no Docker involved. A detached daemon owns a [puppeteer](https://pptr.dev/)-launched browser and runs the page commands, so a helper CLI can navigate, click, type, screenshot, read the DOM, capture console output, run arbitrary puppeteer scripts, and record video across separate invocations. It runs headless by default, and `--headful` opens a real window a human can watch (and take over) while Claude drives. **Chrome or Firefox** - `up --browser firefox` uses puppeteer's WebDriver BiDi support (everything works there except video recording, which is CDP-only).

Requires **Node >= 22.12** on the machine running Claude Code (plus `ffmpeg` if you want video recording). The browser itself is downloaded by puppeteer on first use. The CLI is TypeScript run directly by Node's built-in type stripping, so there is no build step.

## Installation

Run these inside Claude Code:

```
/plugin marketplace add suchipi/skills
/plugin install suchipi-skills@suchipi-skills
/reload-plugins
```

- The first line registers this repo as a plugin marketplace (it reads `.claude-plugin/marketplace.json`).
- The second installs the `suchipi-skills` plugin from that marketplace (the syntax is `<plugin>@<marketplace>`).
- `/reload-plugins` activates it without restarting Claude Code.

Prefer the shell? The same steps, non-interactively:

```sh
claude plugin marketplace add suchipi/skills
claude plugin install suchipi-skills@suchipi-skills
```

> These commands need a version of Claude Code with plugin support (the `/plugin` command). If you don't have it, update Claude Code first.

## Usage

Skills are model-invoked: once the plugin is installed, Claude automatically uses a skill when your request matches its description (e.g. "automate this app running in Docker"). You can also invoke one explicitly by its namespaced name:

```
/suchipi-skills:drive-ui-in-docker
```

## Updating and removing

Updates are not automatic by default. Claude Code auto-updates Anthropic's own marketplaces, but third-party ones like this start with auto-update disabled, so pull the latest version by hand:

```
/plugin marketplace update suchipi-skills        # refresh the catalog from GitHub
/plugin update suchipi-skills@suchipi-skills     # update the installed plugin
/reload-plugins                                  # activate it in this session
```

The first line alone isn't enough: installed plugins are copied into their own cache, so refreshing the catalog doesn't move them. There is no release to wait for, though. The plugin pins no `version`, so its version is the git commit, and whatever is on `main` is what you get.

To let Claude Code handle it instead, run `/plugin`, open the **Marketplaces** tab, select **suchipi-skills**, and choose **Enable auto-update**. It then refreshes in the background shortly after each session starts (with a random delay of up to ten minutes, so a running session keeps whatever it launched with), and notifies you to run `/reload-plugins` when something changed. See [Configure auto-updates](https://code.claude.com/docs/en/discover-plugins#configure-auto-updates) for the details, including how to turn auto-updates off globally.

Remove the plugin with:

```
/plugin uninstall suchipi-skills@suchipi-skills
```

The non-interactive `claude plugin marketplace update`, `claude plugin update`, and `claude plugin uninstall` shell commands do the same things.
