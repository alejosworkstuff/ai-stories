# Contributing

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for clear, consistent commit messages.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type       | Description                                                |
| ---------- | ---------------------------------------------------------- |
| `feat`     | New feature or capability                                  |
| `fix`      | Bug fix                                                    |
| `refactor` | Code change that neither fixes a bug nor adds a feature    |
| `docs`     | Documentation only (README, comments, etc.)                |
| `style`    | Formatting, whitespace, missing semicolons (no code logic) |
| `test`     | Adding or updating tests                                   |
| `chore`    | Maintenance (deps, config, tooling)                        |

### Scope (optional)

Scope narrows the change. Examples:

- `feat(api):` — API route changes
- `fix(ui):` — Frontend bug
- `refactor(history):` — History/storage logic
- `docs(readme):` — README update

Omit scope when the change spans multiple areas or is obvious from the subject.

### Subject rules

- **Imperative mood** — "add feature" not "added feature"
- **No period** at the end
- **~50 chars** — keep it short and clear
- **Lowercase** after the type/scope

### Examples

```
feat: add dark mode toggle
feat(api): return 402 when Replicate credits exhausted
fix: show fallback popup only once per session
fix(ui): correct copy button visibility
refactor: split logic into separate modules
docs: document commit conventions
test: add fallback generator tests
chore: add type module to package.json
```

### Multi-line commits

For larger changes, add a body after a blank line:

```
refactor: separate styles into logical CSS files

- variables.css: design tokens and themes
- base.css: reset and typography
- layout.css: app structure
- history.css, footer.css, modal.css: components
```

### What to avoid

- Vague subjects: ~~"updates"~~, ~~"fix stuff"~~
- Past tense: ~~"fixed bug"~~ → `fix: resolve bug`
- Mixed concerns: one logical change per commit
