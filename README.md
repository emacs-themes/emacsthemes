# Emacs Themes

[![CircleCI](https://dl.circleci.com/status-badge/img/circleci/K5nUbnRBNmjytjcnq2CaLy/Wex5hZdoAwQvLJM5Rz9XvT/tree/main.svg?style=svg&circle-token=CCIPRJ_UMgK9Vdh9tiCpsqBfKxp5x_9d16a0836b49a4d676fb692970fdd45a29c5c45b)](https://dl.circleci.com/status-badge/redirect/circleci/K5nUbnRBNmjytjcnq2CaLy/Wex5hZdoAwQvLJM5Rz9XvT/tree/main)

[emacsthemes.com](https://emacsthemes.com)

A system for cataloging Emacs themes from JSON recipes, generating screenshots, and building a static site.

## Prerequisites

- [Bun](https://bun.sh/) for scripts, tests, and builds
- [Docker](https://www.docker.com/) for screenshot generation

## Quick Start

Install dependencies:

```bash
bun ci
```

Build the static site:

```bash
bun run build
```

Start local Pages dev server:

```bash
bun run dev
```

Note: run `bun run build` at least once before `bun run dev` so the `build/` directory exists.


## Project Layout

- `recipes/`: theme metadata definitions
- `src/core/`: validation, security checks, and screenshot generation
- `src/templates/`: static site generation and HTML/CSS templates
- `src/cloudflare/` & `src/functions/`: deployment tooling
- `src/docker/`: Docker image and entrypoint for screenshot generation
- `static/`: source assets and local theme files
- `tests/`: validation and security-focused tests
- `build/`: generated site output


## Contributing

### Adding metadata

To add a new entry you have to add a *recipe* file to `recipes`. Must be valid JSON and follow the schema enforced in `src/core/schema-checker.ts`.

Required fields:

- `name` - The name of the theme - it will generate the headline of the theme;
- `id`: The unique slug (`kebab-case`) - it will generate the path of the theme;
- `description`: Theme description - small or large paragraph describing the theme;
- `repoUrl`: The base repository of the theme. It can also be the string `local` if there is no repository.
             In this case a folder with the actual theme file must be created in `static/themes`;
- `rawUrls`: The actual theme URL(s) and dependencies.
             If the theme is `local` it must be `static/themes/[theme-folder]/[theme-name].el`;
- `type`: `light` or `dark`;
- `authors`: An array with the name of the authors;
- `tags`: An array of tags - used also to help with theme searching;

Optional fields:

- `elispBefore` - The elisp code to run before executing the `rawUrls` files when taking a screenshot;
                  Usually you want to install theme dependencies here, if any;
- `elispAfter` - The elisp code to run after executing the `rawUrls` files when taking a screenshot;
                 This can be used to load the theme if the screenshot script cannot correctly infer it from the `rawUrls`;

Examples:
- simple recipe: [zenburn](recipes/zenburn.json);
- recipe with local source: [minimal](recipes/minimal.json);

- recipe with `elispBefore` [gruvbox](recipes/gruvbox.json);
- recipe with `elispAfter` [doric oak](recipes/doric-oak.json);
- recipe with both `elispBefore` & `elispAfter` [ef reverie](recipes/ef-reverie.json)

*To validate it run*:

```bash
bun run validate
```


### Adding screenshots

After the recipe was added, new screenshots can be generated using Docker:

```bash
bun run screenshots
```


To update screenshots for an existing recipe, delete the screenshots folder or run:

```bash
bun run screenshots --file=FILE
```

where `FILE` should be the file name of the recipe without the `json` extension:

Example:

```bash
bun run screenshots --file=kaolin-dark
```

## License

MIT
