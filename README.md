# suchipi-skills

suchipi's personal [Claude Code](https://claude.com/claude-code) plugin marketplace,
distributed from [github.com/suchipi/skills](https://github.com/suchipi/skills).

It provides a single plugin — **`suchipi-skills`** — that bundles the skills below.
More may be added over time.

## Skills

### `drive-ui-in-docker`

Drive and observe any GUI application running inside a Docker container. It spins up
a noVNC desktop (Xvnc + fluxbox + noVNC) with [suchibot](https://github.com/suchipi/suchibot)
for mouse/keyboard input and ffmpeg/vncsnapshot for screen capture, so Claude can
automate, test, or explore arbitrary desktop UI apps headlessly — clicking through a
UI, screenshotting an app, or recording a demo. A human can watch (and take over) the
desktop live at `http://localhost:8080/` while Claude drives.

Requires **Docker** on the machine running Claude Code.

## Installation

Run these inside Claude Code:

```
/plugin marketplace add suchipi/skills
/plugin install suchipi-skills@suchipi-skills
/reload-plugins
```

- The first line registers this repo as a plugin marketplace (it reads
  `.claude-plugin/marketplace.json`).
- The second installs the `suchipi-skills` plugin from that marketplace
  (the syntax is `<plugin>@<marketplace>`).
- `/reload-plugins` activates it without restarting Claude Code.

Prefer the shell? The same steps, non-interactively:

```sh
claude plugin marketplace add suchipi/skills
claude plugin install suchipi-skills@suchipi-skills
```

> These commands need a version of Claude Code with plugin support (the `/plugin`
> command). If you don't have it, update Claude Code first.

## Usage

Skills are model-invoked: once the plugin is installed, Claude automatically uses a
skill when your request matches its description (e.g. "automate this app running in
Docker"). You can also invoke one explicitly by its namespaced name:

```
/suchipi-skills:drive-ui-in-docker
```

## Updating and removing

```
/plugin marketplace update suchipi-skills          # pull the latest version
/plugin uninstall suchipi-skills@suchipi-skills     # remove the plugin
```
