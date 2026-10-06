# Skyfall Arena

An original, single-player third-person browser arena built with Three.js and Vite. Developed on `feature/browser-arena`; `main` is not changed by this prototype work.

This is a stylized playable prototype, not Fortnite, not affiliated with Epic Games, and not AAA photorealism. All 3D environment and character meshes are generated in code. There are no copied game assets, accounts, payments, analytics, or multiplayer servers.

## Run in VS Code

Requires Git, Node.js **22.12 or newer**, npm, and a desktop browser with WebGL 2 and hardware acceleration enabled. Install a supported Node.js LTS release from https://nodejs.org/ and VS Code from https://code.visualstudio.com/ if needed.

```bash
git clone --branch feature/browser-arena https://github.com/Jaswanth1106/test-game.git
cd test-game
npm install
code .
npm run dev
```

Open the localhost address printed in the terminal, normally **http://127.0.0.1:5173**. If that port is occupied, Vite prints another port. Keep the terminal running. Stop it with Ctrl+C. If `code .` is unavailable, use VS Code → File → Open Folder and choose `test-game`.

If you already cloned the repository, save or commit any local changes first, then:

```bash
git fetch origin
git switch feature/browser-arena
npm install
npm run dev
```

Do not open `index.html` directly or use VS Code Live Server: this project needs Vite to resolve npm modules. The clone already connects your local project to the GitHub repository as `origin`. Local edits are not uploaded automatically.

## Play

Click **Drop into Arena** to capture the mouse. Survive against twelve bots while the safe zone shrinks. Eliminate all bots or outlive them to win. Escape pauses and releases the mouse; losing focus also pauses. There is no saved progress. Play Again reloads the page.

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
| F | Rotate the build by 90 degrees |
| Esc | Pause and release mouse |

Toggle the selected build key again to return to the rifle. Buildings cost ten materials each; there is a limit of sixty placed pieces. Green previews are valid; red previews are blocked. Placement is ground-level only, without stacking or editing. Ramps are walkable from their low side. Walls and ramps take rifle and bot damage.

## Prototype features and limits

| Area | Included |
|---|---|
| Visuals | Procedural island, sky, ocean rings, textured ground, trees, grass, rocks, buildings, soft shadows, subtle bloom, tone mapping |
| Combat | Third-person rifle, aiming, reloading, shield absorption, headshots, hit markers, tracers, simple synthesized audio |
| Enemies | Twelve bots with line-of-sight attacks, basic obstacle avoidance, and safe-zone movement |
| Survival | Shrinking circle after twenty seconds, storm damage, health/shield/ammo/material pickups, win/loss screens |
| Building | Destructible ground-level walls and ramps, previews, grid snapping, rotation, slope support |
| HUD | Minimap, safe-zone indicator, health/shield bars, ammunition, materials, alive count, eliminations |
| Performance | High mode includes shadows, bloom, and grass; Performance mode lowers pixel ratio and disables those effects |
| Current limitations | No multiplayer, mobile controls, terrain deformation, building interiors, inventory system, professional animations, or robust navigation mesh |

The ground is deliberately flat for predictable movement; decorative scenery adds depth. Buildings are solid obstacles, not enterable interiors. Bots use simple steering and can get caught on obstacles. The minimap deliberately exposes bot positions. Camera placement and gameplay need manual browser playtesting across GPUs. Pointer lock may be blocked in embedded previews; use a standalone localhost tab. Sounds start only after clicking Play and are optional if browser audio is unavailable.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

`typecheck` validates the pure gameplay module through JSDoc; it does **not** type-check the full Three.js renderer. Tests cover damage/shields, storm progression, collision, ramp support, and grid snapping. GitHub Actions runs these commands on the development branch and pull requests. A green build does not substitute for a visual/browser smoke test.

Before considering the prototype verified, check that the menu renders without console errors, Play captures the mouse, movement/jumping and collision work, bots can be hit, reload works, walls block shots, ramps are walkable, pickups update the HUD, the storm deals damage, Escape resumes correctly, both graphics modes work, and win/loss allows restarting.

Dependency ranges are used for development tools. The first `npm install` creates `package-lock.json`; retain and commit that lockfile when you begin local development. CI currently uses `npm install` because this initial scaffold has no generated lockfile. Review dependency audit output before publishing anything publicly.

## Privacy and deployment

Vite binds to **127.0.0.1 only**. No public deployment is configured. Do not expose the dev server to the internet. `npm run build` produces `dist/` for a future static host. Google Fonts is an optional stylesheet request; system-font fallbacks are used when offline. All game geometry and sounds are generated locally, but installing dependencies requires internet access.

There is no existing application to migrate: the starting repository contained only its title README. Keep changes on the feature branch until you have tested them; no pull request or merge is performed automatically.
