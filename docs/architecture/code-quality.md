---
status: active
audience: both
created: 2026-04-06
---

# Code Quality

## ESLint

### Rule Sets

- `@typescript-eslint/recommended` — TypeScript-specific rules, catches real bugs. Officially recommended by the TypeScript team.
- `eslint-plugin-react` — React best practices. De facto standard, referenced in React and ESLint documentation.
- `eslint-plugin-react-hooks` — Official React team plugin (Meta). Enforces Rules of Hooks.

### Rejected

- `eslint-config-airbnb` — overlaps with Prettier on stylistic rules, creates conflicts and noise
- `eslint-plugin-import` + `eslint-import-resolver-typescript` — performance issues with TypeScript projects; TypeScript compiler already catches broken imports. Use `madge` if circular dependency detection is needed later.

### When ESLint Runs

| Stage                   | Lint                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| Dev build               | No — fast iteration                                                |
| File save (VSCode)      | Yes — auto-fix via ESLint extension                                |
| git commit (pre-commit) | Yes — via husky + lint-staged                                      |
| CI/CD                   | Yes — fails pipeline on lint errors                                |
| Installer build         | Yes — lint → tests → build installer. Fails at first failing step. |

## Prettier

### Config

```json
{
  "singleQuote": true,
  "semi": false,
  "printWidth": 100,
  "trailingComma": "all",
  "tabWidth": 2
}
```

- Single quotes — JS/TS community standard
- No semicolons — Prettier v3 handles ASI safely
- Print width 100 — 80 is too narrow for TypeScript with types
- Trailing commas `all` — Prettier v3 default
- 2 space indent — universal JS/TS standard

### When Prettier Runs

- On file save in VSCode (via Prettier extension + `editor.formatOnSave`)
- On git commit via husky + lint-staged (catches any files saved outside VSCode)

## Pre-commit Hooks

### Tools

- **husky** — manages git hooks
- **lint-staged** — runs checks on staged files only (not whole codebase), keeps commits fast (~1-2 seconds)

### What runs on commit

- Prettier format check
- ESLint lint check

## VSCode Integration

### `.vscode/settings.json` (committed to repo)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### `.vscode/extensions.json` (committed to repo)

```json
{
  "recommendations": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint"]
}
```

VSCode prompts team members to install recommended extensions automatically when opening the project.

## Layered Quality Gates

```
Save file   → Prettier formats + ESLint auto-fixes (VSCode)
git commit  → lint-staged checks remaining issues (husky)
CI/CD       → full lint + tests
Installer   → lint → tests → build
```
