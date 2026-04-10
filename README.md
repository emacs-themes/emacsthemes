# Emacs Themes

[emacsthemes.com](https://emacsthemes.com)

Catalogs Emacs themes from JSON recipes, generates screenshots, and builds a static site.

## Requirements

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/)

## Quick Start

```bash
bun ci
bun run build
bun run dev
```

## Main Directories

- `recipes/`: theme metadata
- `src/core/`: validation and screenshot logic
- `src/templates/`: static site generation
- `static/`: assets and local theme files
- `tests/`: validation and security tests

## Common Tasks

Add a theme by creating a JSON recipe in `recipes/` that matches the schema in `src/core/schema-checker.ts`.

Generate screenshots:

```bash
bun run screenshots
```

Validate recipes:

```bash
bun run validate
```

Run lint and format checks:

```bash
bun run check
```

Pinned homepage themes are configured in `src/templates/data/pinned-themes.json`.

## License

MIT
