# Contributing to aurora-chat

Thank you for your interest in this project. This guide explains how to report problems and send changes.

## Report a bug

1. Search the [open issues](https://github.com/Fanaperana/aurora-chat/issues) first.
2. If the bug is new, open an issue with the **Bug report** template.
3. Include a screenshot, your Claude Code version (`claude --version`) and the markdown that draws wrong.
4. If the transcript shows a dim `aurora-chat` line (for example `ui.render hook skipped`), copy that line into the issue.

## Suggest a feature

Open an issue with the **Feature request** template. Describe what you want to see and why.

## Send a pull request

1. Fork the repository and make a branch from `main`.
2. Make your change. Keep each pull request to one subject.
3. Run the checks:

   ```bash
   claude plugin validate .
   claude plugin test .
   ```

4. If you change how something draws, add a case to `tests/render.test.tsx`.
5. Add a screenshot of the change to the pull request.
6. Open the pull request with the template and fill in each section.

## Style rules

- Keep the palette calm: one body text size, accents only where they help reading.
- Do not draw long unwrapped lines of text. They make the reply wider than the window.
- `Box` widths must be whole numbers or whole percentages.
- Draw only for the `desktop` surface, and call `next(e)` everywhere else.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By taking part, you agree to follow it.
