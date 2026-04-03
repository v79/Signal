# Signal

A single-player strategy game about humanity's response to an alien signal. Built with SvelteKit, Phaser 3, and TypeScript.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
```

## Running

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Dev Modes

### Full tech tree inspection

To unlock all eras and reveal all techs in the tech tree (useful for inspecting the full tree without playing through the game):

```bash
VITE_DEV_TREE=true npm run dev
```

Then open the tech tree from the in-game menu. All Era I, II, and III nodes will be visible and the era switcher tabs will all be enabled.

## Other Commands

```bash
npm run build        # Production build
npm run test         # Run Vitest unit tests
npm run test:e2e     # Run Playwright end-to-end tests
npm run lint         # Type-check and lint
```
