# Matt Pocock Engineering Skills

Agents working in Marble Trace must use the relevant engineering skill from
[mattpocock/skills](https://github.com/mattpocock/skills) for the task. Skills
provide task workflows; this repository's `AGENTS.md`, `docs/rules/`, and
architecture decisions remain the source of truth for project constraints.

## Setup

Install the option for your agent. Pick one method per agent; installing both
the plugin and copied skill files can make every skill appear twice. These
commands follow the upstream
[installation instructions](https://github.com/mattpocock/skills#installation-30-second-setup).

### Codex

```sh
codex plugin marketplace add mattpocock/skills
codex plugin add mattpocock-skills@mattpocock
```

The plugin updates at startup.

### Claude Code

```sh
claude plugin install mattpocock-skills@claude-plugins-official
```

The plugin updates automatically.

### GitHub Copilot CLI

```sh
copilot plugin marketplace add mattpocock/skills
copilot plugin install mattpocock-skills@mattpocock
```

Then add this marketplace entry once to `~/.copilot/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "mattpocock": {
      "source": { "source": "github", "repo": "mattpocock/skills" },
      "autoUpdate": true
    }
  }
}
```

In VS Code, use **Chat: Install Plugin From Source** and enter
`https://github.com/mattpocock/skills`; it updates daily.

### Gemini CLI

```sh
gemini skills install https://github.com/mattpocock/skills.git --path skills/engineering
gemini skills install https://github.com/mattpocock/skills.git --path skills/productivity
```

Run both commands again to update.

### Other agents

For Cursor, OpenCode, Devin, Windsurf, Amp, Pi, or another supported agent:

```sh
npx skills@latest add mattpocock/skills -a <agent>
```

Omit `-a <agent>` to choose interactively. Include
`setup-matt-pocock-skills` when prompted. To update copied skills, run
`npx skills@latest update` and run the `add` command again to pick up new skills.

For all methods, run `/setup-matt-pocock-skills` once per repository before
using the other engineering skills. Installation is per developer environment;
do not add third-party skill files or agent-specific settings to this repository
unless a separate change explicitly calls for that.

## Use

Before starting a task, identify and invoke the skill that matches the work.
For example, use the grilling/documentation skills when requirements or domain
decisions need clarification, and the implementation or review skills for code
changes. Follow the skill's workflow where it applies, while also reading the
relevant project instructions listed in `AGENTS.md` before editing.

If no relevant skill is available, continue with the repository workflow and
mention the missing skill only when it materially limits the work. Do not install
or run a skill that changes project files as setup unless its instructions and
the task call for those changes.
