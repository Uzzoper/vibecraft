# VibeCraft

> **VibeCraftLand** — A Minecraft-like voxel game running directly in the browser, built with Three.js and TypeScript.

<div align="center">

**v0.0.1** · Made with ❤️ by Juan Antonio Peruzzo

</div>

---

## Overview

VibeCraft is a browser-based voxel game that recreates the classic building and exploration experience in a procedural 3D world. The game runs entirely on the client side, with no backend server required.

### Key Features

| Feature | Description |
|---|---|
| **Procedural World** | Terrain generated with multi-octave value noise — hills, 3D caves, and underground lakes |
| **6 Block Types** | Grass, Dirt, Stone, Wood, Leaves, and Water — each with 16x16 pixel art textures |
| **Chunk System** | World divided into 16x64x16 chunks with dynamic loading based on player position |
| **Procedural Trees** | Automatically generated on grass surfaces with trunk and leaf canopy |
| **Day/Night Cycle** | Full 4-minute cycle with smooth lighting, sky color, and fog transitions |
| **Mob System** | Zombies that spawn at night, chase the player, attack, and burn in daylight |
| **Health System** | 20 HP health bar, zombie damage, drowning, and void fall — with auto-respawn |
| **Audio** | Block break/place, jump, footsteps, and zombie growls via Web Audio API |
| **Mobile Support** | Virtual joystick + action buttons with automatic touch and orientation detection |
| **Physics** | Gravity, AABB collision detection, and terminal fall velocity |

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** (package manager)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd vibecraft

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Open in browser (usually http://localhost:5173)
```

### Production Build

```bash
# Compile TypeScript + optimized Vite build
npm run build

# Preview production build
npm run preview
```

### Lint & Format

```bash
# Run lint check
npm run lint

# Auto-fix issues
npm run lint:fix
```

---

## Controls

### Desktop

| Key | Action |
|---|---|
| **W / A / S / D** | Move forward/left/backward/right |
| **Space** | Jump |
| **Left Shift** | Move down |
| **Mouse** | Look around (pointer lock) |
| **Left Click** | Break block / Attack zombie |
| **Right Click** | Place block |
| **Scroll / Keys 1-6** | Select block type |

### Mobile

| Control | Action |
|---|---|
| **Joystick (left side)** | Move |
| **Swipe (right side)** | Look around |
| **Button ⬆** | Jump |
| **Button ⛏** | Break block |
| **Button 🧱** | Place block |
| **Button 🔄** | Toggle landscape orientation |

---

## Project Architecture

### Directory Structure

```
vibecraft/
├── public/
│   ├── textures/          # 16x16px textures for each block type
│   │   ├── grass.png
│   │   ├── dirt.png
│   │   ├── stone.png
│   │   ├── wood.png
│   │   ├── leaves.png
│   │   └── water.png
│   └── sounds/            # OGG sound effects
│       ├── break.ogg
│       ├── jump.ogg
│       ├── place.ogg
│       └── zombie.ogg
├── src/
│   ├── main.ts            # Entry point — scene setup, game loop, UI
│   ├── Block.ts           # Block type definitions and materials
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

### Dependency Diagram

```
main.ts
├── engine/createEngine.ts
├── rendering/dayNight.ts
├── ui/gameUi.ts
├── world/World.ts
├── player/Controls.ts
├── player/MobileControls.ts
├── utils/AudioManager.ts
├── core/PlayerMovementManager.ts
├── interaction/ZombieManager.ts
├── interaction/BlockInteractionManager.ts
└── mobs/Zombie.ts
```

---

## Technical Details

### Blocks (`Block.ts`)

The block system defines 7 types (including Air):

| ID | Type | UI Color | Texture |
|---|---|---|---|
| 0 | Air | — | — |
| 1 | Grass | `#4c9900` | `/textures/grass.png` |
| 2 | Dirt | `#79553a` | `/textures/dirt.png` |
| 3 | Stone | `#808080` | `/textures/stone.png` |
| 4 | Wood | `#996633` | `/textures/wood.png` |
| 5 | Leaves | `#006600` | `/textures/leaves.png` |
| 6 | Water | `#3366aa` | `/textures/water.png` |

`BLOCK_TYPES` filters placeable blocks (excludes Water). Water is treated as solid for collision but transparent for rendering.

### Chunk System (`Chunk.ts`)

Each chunk is a **16x64x16** block grid stored in a flat `Uint8Array`:

```
index = (y * CHUNK_SIZE + z) * CHUNK_SIZE + x
```

**Mesh Merging**: Blocks of the same type are combined into a single `BufferGeometry` per chunk, drastically reducing draw calls. Hidden faces (adjacent to solid blocks) are not generated.

**Face Visibility**: A face is only rendered if the neighboring block is Air or Water (for non-Water blocks). This prevents rendering of internal faces.

**Dirty Flag**: When a block is modified, the chunk is marked dirty and the mesh is rebuilt on the next update.

### Terrain Generation (`World.ts`)

Terrain is generated procedurally per chunk using **multi-octave value noise**:

1. **Terrain height**: `octaveNoise2D` with 4 octaves maps each (x,z) column to a height between 2-14 blocks
2. **Layers**: Top = Grass, 3 layers below = Dirt, remainder = Stone
3. **Caves**: `octaveNoise3D` with 3 octaves carves caves into Stone/Dirt (values below 0.35 = air)
4. **Underground water**: Air pockets below y=10 with a solid ceiling are filled with Water
5. **Trees**: `octaveNoise2D` with offset determines ~25% density — trunk (4-6 blocks) + 3x3 canopy at 2 levels

### Day/Night Cycle (`rendering/dayNight.ts`)

| Parameter | Value |
|---|---|
| Cycle duration | 240 seconds (4 minutes) |
| Sky color (day) | `#87ceeb` (sky blue) |
| Sky color (night) | `#0a0a2e` (dark navy) |
| Fog range | 20-80 units |

The sun moves in a full circular arc. Light intensities (ambient, directional, moon, hemisphere) are smoothly interpolated based on sun height. The renderer's `toneMappingExposure` is also adjusted to reinforce the day/night feel.

### Mob System (`Zombie.ts`)

| Attribute | Value |
|---|---|
| Max health | 10 HP |
| Speed | 2.5 units/s |
| Damage per attack | 2 HP |
| Attack interval | 0.8 seconds |
| Spawn distance | 15-35 units from player |
| Max simultaneous | 3 zombies |
| Spawn interval | 15 seconds (night only) |
| Despawn distance | 60 units |
| Burn height | y >= 60 (dies after 2s) |

**Behavior**:
- Spawn only at night at random positions around the player
- Direct line-of-sight pathfinding toward the player
- Contact attack with arm swing animation
- Growls every 3 seconds when within 15 units (volume proportional to distance)
- Red flash on hit (0.2s)
- Burn and die if at y >= 60 for more than 2 seconds

### Player Physics (`Player.ts`)

| Parameter | Value |
|---|---|
| Movement speed | 5.0 units/s |
| Gravity | -8.0 units/s² |
| Jump force | 4.5 units/s |
| Terminal velocity | -18.0 units/s |
| Player height | 2.0 blocks |
| Player width | 0.6 blocks |
| Mouse sensitivity | 0.002 rad/px |
| Max health | 20 HP |
| Post-damage invincibility | 1.0 second |
| Drowning interval | 5 seconds (1 damage) |
| Respawn time | 2.0 seconds |

**Collision**: The player is represented by a 0.6x2.0x0.6 bounding box. Sample points every 0.5 units check for solid blocks. Horizontal and vertical movement are handled separately to allow sliding along walls.

### Raycasting (`interaction/BlockInteractionManager.ts`)

**Step traversal**-based raycasting (not Three.js Raycaster for blocks):
- Step size: 0.1 units
- Maximum: 60 steps (6 unit range)
- Calculates hit face normal based on block entry fraction
- For zombies: uses standard `THREE.Raycaster` with `intersectObjects`

### Audio (`AudioManager.ts`)

Using **constructor dependency injection** (not a singleton):

| Sound | File | Trigger |
|---|---|---|
| Break | `break.ogg` | Break block / take damage |
| Jump | `jump.ogg` | Jump |
| Place | `place.ogg` | Place block / footsteps |
| Zombie | `zombie.ogg` | Zombie growl |

**Optimization**: Sounds are trimmed on load to remove initial silence. Footsteps reuse the "place" sound at reduced volume (0.25) with a 0.35s interval.

### PlayerMovementManager (`core/PlayerMovementManager.ts`)

Handles player movement logic including:
- Processing keyboard input from Controls
- Applying gravity and jump physics
- Collision detection with world blocks
- Updating player position and velocity
- Separating horizontal and vertical movement for smooth wall sliding

### BlockInteractionManager (`interaction/BlockInteractionManager.ts`)

Manages block interactions including:
- Raycasting to detect block hits
- Processing left-click (block removal) and right-click (block placement)
- Playing appropriate sound effects via injected AudioManager
- Updating chunk data and marking chunks for mesh rebuild
- Handling block placement constraints (adjacent to hit face)

### ZombieManager (`interaction/ZombieManager.ts`)

Controls zombie spawning and behavior including:
- Spawning zombies at night at configurable intervals
- Managing zombie lifecycle (spawn, update, despawn)
- Distributing AudioManager instances to zombies for sound effects
- Handling zombie despawning when too far from player
- Coordinating zombie attacks on the player

### Internationalization (`i18n/`)

Provides multi-language support through:
- `i18n.ts`: Core initialization and language switching logic
- `translations.ts`: JSON-like structure containing all translatable strings
- Easy addition of new languages by extending the translations object
- Integration with UI components for dynamic language updates

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Language** | TypeScript | ^5.7.0 |
| **3D Rendering** | Three.js | ^0.170.0 |
| **Build Tool** | Vite | ^6.0.0 |
| **ES Target** | ES2020 | — |
| **Module System** | ESNext (bundler) | — |
| **Lint** | ESLint + TypeScript ESLint | ^8.59.2 / ^10.3.0 |
| **Format** | Prettier | ^3.8.3 |
| **Font** | Press Start 2P (Google Fonts) | — |

---

## Design Decisions

### Why Value Noise Instead of Perlin Noise?

Value noise is simpler to implement and sufficient for voxel terrain generation. The visual difference is minimal for this use case, and the custom implementation avoids external dependencies.

### Why Mesh Merging by Block Type?

Instead of creating one `THREE.Mesh` per block (which would result in thousands of draw calls), blocks of the same type within a chunk are combined into a single geometry. This reduces draw calls from `N*blocks` to `N*types` (typically 6 per chunk).

### Why Step-Based Raycasting Instead of Three.js Raycaster?

Three.js's raycaster works with mesh geometries, which are merged. This makes it impossible to identify which individual block was hit. The step-based raycaster traverses the block grid directly, enabling precise block and face identification.

### Why Constructor DI for AudioManager?

Instead of a singleton, AudioManager is instantiated once in main.ts and injected via constructor into dependent classes (Player, Zombie, ZombieManager, BlockInteractionManager). This approach:
- Makes dependencies explicit and easier to test
- Prevents accidental multiple AudioContext instances
- Allows for better resource management
- Follows dependency injection principles for looser coupling

---

## Performance

### Implemented Optimizations

- **Face culling**: Faces between adjacent blocks are not generated
- **Mesh merging**: Geometries combined by block type per chunk
- **Dynamic chunk loading**: Only chunks within render distance (4 chunks) are loaded
- **On-demand rebuild**: Meshes are only rebuilt when blocks change (dirty flag)
- **Cached textures**: Each texture is loaded once and reused
- **Limited pixel ratio**: Touch devices capped at 1.5x, desktop at 2x

### Known Limitations

- Chunks are not unloaded when the player moves away (only new chunks are loaded)
- Raycasting is O(steps) per frame during interaction
- Terrain generation is synchronous (may cause frame drops on new chunks)
- No LOD (Level of Detail) for distant chunks

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Compile TypeScript and production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on `src/` directory |
| `npm run lint:fix` | Run ESLint with auto-fix |

---

## License

Project developed by Juan Antonio Peruzzo.