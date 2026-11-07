# aurora-chat

An editor-style theme for the **Claude Code desktop app**. It is a Claude Code mod (a plugin with a hooks module) that redraws Claude's replies with its own markdown renderer, puts a calm IDE-like background behind the app, and adds a status bar above the prompt.

## Features

- **Custom markdown renderer** for Claude's replies
  - Headings in bright colors, one color and size per level
  - Bold text in soft gold, inline code as orange chips, cyan links
  - Tables drawn by the app's own table renderer
  - GitHub-style alerts: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`
  - Task lists (`- [x]` / `- [ ]`), colored bullets and numbered lists
  - Code blocks with a header bar and the app's own syntax highlighting
- **Message headers**: `◆ claude · <model>` above replies, `λ you ~/<folder>` above your prompts
- **Background**: a dark dotted editor canvas, with frosted-glass panels over it
- **Status bar** above the prompt: status, folder, model, turns, tool calls, tokens and the last turn's time
  - Three styles: `minimal` (default), `labels` and `pills`
  - Switch styles with the `/statusbar` command

The theme draws only on the desktop app; the terminal, VS Code and mobile keep their normal look.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install aurora-chat --marketplace Fanaperana/aurora-chat
```

From a shell:

```bash
claude plugin install aurora-chat --marketplace Fanaperana/aurora-chat
```

Answer `y` to add the marketplace, then choose the **user** scope so the mod loads in every session, including the sessions the desktop app starts.

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `Fanaperana/aurora-chat`, then **Add plugin**.

## Usage

| Command | What it does |
| --- | --- |
| `/statusbar` | Switches the status bar to the next style: minimal → labels → pills |

The status bar counts turns, tool calls and tokens from the moment the mod loads in a session.

## Project layout

| Path | Purpose |
| --- | --- |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `.claude-plugin/marketplace.json` | Makes this repository installable as a marketplace |
| `hooks/register.tsx` | Hooks: background, message headers, status bar, `/statusbar` |
| `hooks/markdown.tsx` | The markdown parser and renderer |
| `types/index.d.ts` | Types of the values the mod keeps in session state |
| `tests/render.test.tsx` | Render tests: the app must accept every drawing |

## Development

Load the mod from this folder while you work on it:

```bash
claude --plugin-dir .
```

Check it before you commit:

```bash
claude plugin validate .
claude plugin test .
```

`claude plugin test` matters most: if the app refuses a drawing (for example a `Box` width that is not a whole percentage), it silently falls back to its default look. The tests fail in that case.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first. To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Fanaperana
