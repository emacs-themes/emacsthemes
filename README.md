# Emacs Themes

[emacsthemes.com](https://emacsthemes.com)

A system for cataloging Emacs themes via JSON recipes and automatically generating a static website with screenshots.

## Prerequisites

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/)

## Getting Started

### Install dependencies
```bash
bun ci
```

### Generate screenshots
```bash
bun run screenshots
```

### Build the static site
```bash
bun run build
```
The output will be in the `build/` directory.

### Local Development
```bash
bun run dev
```
**Note:** You must run `bun run build` at least once before starting the development server to populate the `build/` directory.

## Project Structure

- `recipes/`: JSON definitions for Emacs themes.
- `src/core/`: Logic for validation and screenshot generation.
- `src/templates/`: HTML templates and build script.
- `static/`: Static assets (screenshots, CSS, images, favicon).

## Development

- **Linting**: `bun run lint`
- **Validate Recipes**: `bun run validate`
- **Screenshots**: `bun run screenshots`

## License

MIT
