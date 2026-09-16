# AGENTS.md

Pac-Man clone in vanilla JS/HTML/CSS. No build system, no bundler, no package manager, no tests, no lint config. The repo is also a learning project for spec-driven development (see Workflow).

## Running / verifying

Open `src/index.html` directly in a browser (`file://` works — plain script tags, no modules, no dev server). There are no automated checks; verify changes by playing and keeping the console error-free. Canvas is 560x620 = 28 cols × 31 rows at `TILE = 20`.

## Architecture

Four plain scripts loaded in this exact order via `<script>` tags in `src/index.html`. They share globals — there are no ES module imports, and adding `import`/`export` or reordering the tags breaks everything:

1. `src/js/maze.js` — maze data and globals (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`)
2. `src/js/game.js` — state and rules (`createGame`, `update`); reads maze.js globals
3. `src/js/render.js` — canvas drawing (`draw`); renders from `game.grid`, never `MAZE`
4. `src/js/main.js` — game loop, keyboard, overlay screens

Invariants:

- Maze is 31 strings of 28 chars, parsed to numbers: `#`=wall(1), `.`=dot(2), ` `=walkable(0), `-`=pen door(3). Symmetric about the vertical axis between cols 13/14.
- `createGame()` copies `MAZE` into `game.grid` so dots can be eaten while `MAZE` stays pristine for restarts.

## Conventions

- Repo language is Spanish: comments, UI text, README. Reply to the user in the language they prompt in (specs must match too).
- Code style: spaces inside parens/brackets — `( row )`, `grid[ y ][ x ]` — keep it consistent.

## Spec-driven workflow

Features are built with the `/spec` and `/spec-impl` skills (installed in `.agents/skills/`, locked in `skills-lock.json`):

- `/spec <description>` — clarifies requirements, then writes `specs/NN-slug.md`. Never writes code. The user manually flips `**Status:**` from `Draft` to `Approved`.
- `/spec-impl NN-slug` — refuses any spec whose state does not mean "Approved" (any language). Creates branch `spec-NN-slug` (auto unless `AutoCreateBranch: false` in `specs/.spec-config.yml`), implements one plan step at a time with pauses for diff review, and never commits on its own.
- Valid spec states: `Draft`, `In review`, `Approved`, `Implemented`, `Obsolete` (Spanish equivalents accepted).
- Out-of-scope requests during implementation go into a future spec, not into the current branch.
- Default branch is `master`.
