# Emacs Themes

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
bun src/core/generate-screenshots.ts
```

### Build the static site
```bash
bun run build
```
The output will be in the `build/` directory.

## Project Structure

- `recipies/`: JSON definitions for Emacs themes.
- `src/core/`: Logic for validation and screenshot generation.
- `src/templates/`: HTML templates and build script.
- `static/`: Static assets (screenshots, CSS, images, favicon).

## Development

- **Linting**: `bun run lint`
- **Validate Recipes**: `bun run validate:pr`
- **Local Docker**: `bun run docker:local`

## License

MIT
