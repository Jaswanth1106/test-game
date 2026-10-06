# Skyfall Arena

An original, single-player third-person browser arena built with Three.js and Vite. Source is on `feature/browser-arena`; `main` remains unchanged.

This is a stylized prototype, not Fortnite, not affiliated with Epic Games, and not AAA photorealism. All 3D meshes are generated in code. No copied game assets, accounts, payments, analytics, or multiplayer servers.

**Verification status:** source committed; lint, type-check, tests, build, and browser playtesting have NOT been executed in this chat environment. The GitHub Actions workflow write failed and `.github/workflows/ci.yml` is not present. Do not treat this as a verified release.

## Run in VS Code

Requires Git, Node.js **22.12 or newer**, npm, and a desktop browser with WebGL 2 and hardware acceleration. Get a supported Node.js LTS release from https://nodejs.org/ and VS Code from https://code.visualstudio.com/ if needed.

```bash
git clone --branch feature/browser-arena https://github.com/Jaswanth1106/test-game.git
cd test-game
npm install
code .
npm run dev
```

Open the address printed by Vite, normally **http://127.0.0.1:5173**. If the port is occupied, Vite prints another port. Keep the terminal running; Ctrl+C stops it. If `code .` is unavailable, use VS Code → File → Open Folder and select `test-game`.

For an existing clone, save or commit local changes first:

```bash
git fetch origin
git switch feature/browser-arena
npm install
npm run dev
```

Do not open `index.html` directly or use VS Code Live Server: Vite resolves the npm modules. Cloning connects your local project to GitHub as `origin`. Local edits are not uploaded automatically.

## Play

Click **Drop into Arena** to capture the mouse. Survive against twelve bots while the safe zone shrinks. Eliminate all bots or outlive them to win. Escape pauses and releases the mouse; losing focus pauses too. No saved progress. Play Again reloads the page.

| Control | Action |
|---|---|
| W / A / S / D | Move |
| Mouse | Look |
| Shift | Sprint |
| Space | Jump; holding repeats when grounded |
| Left mouse button | Fire rifle or place selected build |
| Right mouse button | Aim |
| R | Reload |
| Q | Toggle wall build mode |
| E | Toggle ramp build mode |
| F | Rotate build ninety degrees |
| Esc | Pause and release mouse |

Toggle the selected build key again to return to the rifle. Pieces cost ten materials, with a sixty-piece limit. Green previews are valid; red previews are blocked. Placement is ground-level only: no stacking/editing. Ramps are walkable from their low side. Walls and ramps take rifle and bot damage.

## Features and limits

| Area | Implemented in source |
|---|---|
| Visuals | Procedural island, sky, ocean rings, textured ground, trees, grass, rocks, buildings, soft shadows, bloom, tone mapping |
| Combat | Rifle, aiming, reload, shields, headshots, hit markers, tracers, synthesized audio |
| Enemies | Twelve bots with line-of-sight attacks, basic obstacle avoidance, and safe-zone movement |
| Survival | Shrinking circle after twenty seconds, storm damage, four pickup types, win/loss screens |
| Building | Destructible ground-level walls and ramps, placement previews, grid snapping, rotation, slope support |
| HUD | Minimap, storm indicator, health/shields, ammunition, materials, alive count, eliminations |
| Performance | High mode includes shadows, bloom, and grass; Performance lowers pixel ratio and disables those effects |
| Not included | Multiplayer, mobile controls, enterable interiors, professional animations, inventory system, navigation mesh |

The ground is flat for predictable movement; decoration adds depth. Buildings are solid obstacles. Bots use simple steering and can get caught on obstacles. The minimap exposes bot positions. Camera placement and gameplay need browser testing across GPUs. Pointer lock may be blocked in embedded previews; use a standalone localhost tab. Audio starts only after clicking Play. Google Fonts is optional; system fonts work offline.

## Run verification locally

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

`typecheck` validates only the pure gameplay module using JSDoc, not the complete renderer. Tests cover damage/shields, zone progression, collision, ramp support, and grid snapping. A passing build does not substitute for a visual smoke test.

Manually verify menu rendering, mouse capture, movement/jumping, collision, rifle hits, reload, walls blocking shots, ramp climbing, pickups, storm damage, pause/resume, both graphics modes, and restart. Check the browser console for errors.

To enable automated checks, save the following as `.github/workflows/ci.yml` on the feature branch and commit it yourself. This workflow was prepared but could not be uploaded through the connector.

```yaml
name: Arena checks
on:
  push:
    branches: [feature/browser-arena]
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install --no-fund --no-audit
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

Development tools use dependency ranges. Your first `npm install` generates `package-lock.json`; retain and commit it for reproducible installs, then switch CI to `npm ci`. Review dependency audit output before public deployment.

## Local-only deployment

Vite binds to **127.0.0.1 only**. No public deployment is configured. Do not expose the development server to the internet. `npm run build` creates `dist/` for a future static host. Installing dependencies requires internet access; geometry and audio are generated locally.

There is no existing application to migrate: the original repository contained only a title README. Keep changes on the feature branch until tested. No pull request or merge has been performed.
