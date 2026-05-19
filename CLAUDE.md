# VibeCraft

A simplified Minecraft-like game built with Three.js and TypeScript.

## Overview

VibeCraft is a browser-based voxel game featuring:
- First-person movement with WASD controls
- Block placement and removal (left click to remove, right click to place)
- Procedural terrain generation using noise
- 5 block types: Grass, Dirt, Stone, Wood, Leaves
- 16x16 chunk-based world rendering
- Basic physics with gravity and collision detection

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Running
```bash
npm run dev
```
Then open the URL shown (usually `http://localhost:5173`) in your browser.
Click on the game window to lock the pointer and start playing.

### Controls
- **WASD**: Move
- **Space**: Jump
- **Mouse**: Look around
- **Left Click**: Remove block
- **Right Click**: Place block
- **Scroll / 1-5 keys**: Select block type

## Architecture notes
- **AudioManager** is no longer a singleton. It is instantiated once in `src/main.ts` (`const audioManager = new AudioManager();`) and **injected via constructor** into `Player`, `Zombie`, `ZombieManager` and `BlockInteractionManager`. This makes the audio system explicit, easier to test, and prevents accidental multiple `AudioContext` instances.

## Project Structure

```
vibecraft/
├── public/
│   └── textures/          # 16x16px block textures
├── src/
│   ├── main.ts            # Entry point, scene setup, game loop
│   ├── Block.ts           # Block type definitions
│   ├── core/
│   │   └── PlayerMovementManager.ts
│   ├── engine/
│   │   └── createEngine.ts
│   ├── i18n/
│   │   ├── i18n.ts
│   │   └── translations.ts
│   ├── interaction/
│   │   ├── BlockInteractionManager.ts
│   │   └── ZombieManager.ts
│   ├── mobs/
│   │   └── Zombie.ts
│   ├── player/
│   │   ├── Controls.ts
│   │   ├── MobileControls.ts
│   │   └── Player.ts
│   ├── rendering/
│   │   └── dayNight.ts
│   ├── ui/
│   │   └── gameUi.ts
│   ├── utils/
│   │   ├── AudioManager.ts
│   │   ├── noise.ts
│   │   └── texture.ts
│   ├── world/
│   │   ├── BlockType.ts
│   │   ├── Chunk.ts
│   │   ├── terrain.ts
│   │   ├── World.ts
│   │   └── world.worker.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Key Features

### Terrain Generation
Uses 2D value noise (multiple octaves) to generate hilly terrain. Each chunk generates ground height per column, with grass on top, dirt below, and stone at the bottom.

### Chunk System
World is divided into 16x16 chunks. Each chunk stores blocks in a flat Uint8Array and builds merged geometries (by block type) for efficient rendering.

### Block Interaction
Raycasting (step-based) detects block hits. Left click removes the targeted block; right click places the selected block adjacent to the hit face.

### Player Physics
Simple gravity and collision detection prevent the player from walking through solid blocks.