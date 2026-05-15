# VibeCraft

> **VibeCraftLand** — Um jogo voxel estilo Minecraft rodando diretamente no navegador, construído com Three.js e TypeScript.

<div align="center">

**v0.0.1** · Feito com ❤️ por Juan Antonio Peruzzo

</div>

---

## Visão Geral

VibeCraft é um jogo voxel baseado em navegador que recria a experiência clássica de construção e exploração em um mundo 3D procedural. O jogo roda inteiramente no cliente, sem necessidade de servidor backend.

### Funcionalidades Principais

| Feature | Descrição |
|---|---|
| **Mundo Procedural** | Terreno gerado com value noise multi-octave — colinas, cavernas 3D e lagos subterrâneos |
| **6 Tipos de Blocos** | Grass, Dirt, Stone, Wood, Leaves e Water — cada um com textura pixel art 16x16 |
| **Sistema de Chunks** | Mundo dividido em chunks 16x64x16 com carregamento dinâmico baseado na posição do jogador |
| **Árvores Procedurais** | Geradas automaticamente sobre superfícies de grama com tronco e copa de folhas |
| **Ciclo Dia/Noite** | Ciclo completo de 4 minutos com transição suave de iluminação, cor do céu e fog |
| **Sistema de Mobs** | Zombies que spawnam à noite, perseguem o jogador, atacam e queimam na luz do dia |
| **Sistema de Vida** | Barra de saúde com 20 HP, dano por zombie, afogamento e queda no void — com respawn automático |
| **Áudio** | Sons de quebra/colocação de blocos, pulo, passos e rosnados de zombie via Web Audio API |
| **Suporte Mobile** | Joystick virtual + botões de ação com detecção automática de toque e orientação |
| **Física** | Gravidade, detecção de colisão AABB e velocidade terminal de queda |

---

## Começando

### Pré-requisitos

- **Node.js** v18 ou superior
- **npm** (gerenciador de pacotes)

### Instalação

```bash
# Clonar o repositório
git clone <repo-url>
cd vibecraft

# Instalar dependências
npm install
```

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Abrir no navegador (geralmente http://localhost:5173)
```

### Build de Produção

```bash
# Compilar TypeScript + build otimizado com Vite
npm run build

# Preview do build de produção
npm run preview
```

### Lint e Formatação

```bash
# Verificar lint
npm run lint

# Corrigir automaticamente
npm run lint:fix
```

---

## Controles

### Desktop

| Tecla | Ação |
|---|---|
| **W / A / S / D** | Mover para frente/esquerda/trás/direita |
| **Espaço** | Pular |
| **Shift Esquerdo** | Mover para baixo |
| **Mouse** | Olhar ao redor (pointer lock) |
| **Botão Esquerdo** | Quebrar bloco / Atacar zombie |
| **Botão Direito** | Colocar bloco |
| **Scroll / Teclas 1-6** | Selecionar tipo de bloco |

### Mobile

| Controle | Ação |
|---|---|
| **Joystick (lado esquerdo)** | Mover |
| **Deslizar (lado direito)** | Olhar ao redor |
| **Botão ⬆** | Pular |
| **Botão ⛏** | Quebrar bloco |
| **Botão 🧱** | Colocar bloco |
| **Botão 🔄** | Alternar orientação paisagem |

---

## Arquitetura do Projeto

### Estrutura de Diretórios

```
vibecraft/
├── public/
│   ├── textures/          # Texturas 16x16px para cada tipo de bloco
│   │   ├── grass.png
│   │   ├── dirt.png
│   │   ├── stone.png
│   │   ├── wood.png
│   │   ├── leaves.png
│   │   └── water.png
│   └── sounds/            # Efeitos sonoros em OGG
│       ├── break.ogg
│       ├── jump.ogg
│       ├── place.ogg
│       └── zombie.ogg
├── src/
│   ├── main.ts            # Entry point — setup da cena, game loop, UI
│   ├── Block.ts           # Definições dos tipos de bloco e materiais
│   ├── globals.css        # Estilos de toda a UI/HUD
│   ├── player/
│   │   ├── Controls.ts    # Pointer lock + input de teclado
│   │   ├── MobileControls.ts  # Joystick virtual + botões touch
│   │   └── Player.ts      # Física, colisão, vida e câmera
│   ├── world/
│   │   ├── Chunk.ts       # Chunk 16x64x16 com storage e mesh merging
│   │   └── World.ts       # Gerenciamento do mundo, geração de terreno
│   ├── mobs/
│   │   └── Zombie.ts      # IA, mesh, pathfinding e combate
│   └── utils/
│       ├── noise.ts       # Value noise 2D/3D com octaves
│       ├── texture.ts     # Carregamento e cache de texturas
│       └── AudioManager.ts # Web Audio API com singleton
├── index.html             # HTML base com fonte Press Start 2P
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

### Diagrama de Dependências

```
main.ts
├── World ──────────────┬── Chunk ────────────┬── Block.ts
│                       │                     └── noise.ts
│                       ├── texture.ts ───────┤
│                       └── noise.ts ─────────┘
├── Player ─────────────┬── Controls.ts
│                       ├── MobileControls.ts
│                       ├── World (ref)
│                       └── AudioManager
├── MobileControls.ts
├── Zombie ─────────────┬── World (ref)
│                       ├── Player (ref)
│                       └── AudioManager
└── AudioManager.ts (singleton)
```

---

## Detalhamento Técnico

### Blocos (`Block.ts`)

O sistema de blocos define 7 tipos (incluindo Air):

| ID | Tipo | Cor UI | Textura |
|---|---|---|---|
| 0 | Air | — | — |
| 1 | Grass | `#4c9900` | `/textures/grass.png` |
| 2 | Dirt | `#79553a` | `/textures/dirt.png` |
| 3 | Stone | `#808080` | `/textures/stone.png` |
| 4 | Wood | `#996633` | `/textures/wood.png` |
| 5 | Leaves | `#006600` | `/textures/leaves.png` |
| 6 | Water | `#3366aa` | `/textures/water.png` |

`BLOCK_TYPES` filtra os blocos colocáveis (exclui Water). Water é tratado como bloco sólido para colisão mas transparente para rendering.

### Chunk System (`Chunk.ts`)

Cada chunk é uma grade de **16x64x16** blocos armazenada em um `Uint8Array` flat:

```
index = (y * CHUNK_SIZE + z) * CHUNK_SIZE + x
```

**Mesh Merging**: Blocos do mesmo tipo são combinados em uma única `BufferGeometry` por chunk, reduzindo draw calls drasticamente. Faces ocultas (adjacentes a blocos sólidos) não são geradas.

**Face Visibility**: Uma face só é renderizada se o bloco vizinho for Air ou Water (para blocos não-Water). Isso previne rendering de faces internas.

**Dirty Flag**: Quando um bloco é modificado, o chunk é marcado como dirty e a mesh é reconstruída na próxima atualização.

### Geração de Terreno (`World.ts`)

O terreno é gerado proceduralmente por chunk usando **value noise multi-octave**:

1. **Altura do terreno**: `octaveNoise2D` com 4 octaves mapeia cada coluna (x,z) para uma altura entre 2-14 blocos
2. **Camadas**: Topo = Grass, 3 camadas abaixo = Dirt, restante = Stone
3. **Cavernas**: `octaveNoise3D` com 3 octaves esculpe cavernas no Stone/Dirt (valores abaixo de 0.35 = ar)
4. **Água subterrânea**: Espaços de ar abaixo de y=10 com teto sólido são preenchidos com Water
5. **Árvores**: `octaveNoise2D` com offset determina ~25% de densidade — tronco (4-6 blocos) + copa 3x3 em 2 níveis

### Ciclo Dia/Noite (`main.ts`)

| Parâmetro | Valor |
|---|---|
| Duração do ciclo | 240 segundos (4 minutos) |
| Cor do céu (dia) | `#87ceeb` (sky blue) |
| Cor do céu (noite) | `#0a0a2e` (dark navy) |
| Fog range | 20-80 unidades |

O sol se move em um arco circular completo. Intensidades de luz (ambient, directional, moon, hemisphere) são interpoladas suavemente com base na altura do sol. `toneMappingExposure` do renderer também é ajustado para reforçar a sensação de dia/noite.

### Sistema de Mobs (`Zombie.ts`)

| Atributo | Valor |
|---|---|
| Vida máxima | 10 HP |
| Velocidade | 2.5 unidades/s |
| Dano por ataque | 2 HP |
| Intervalo de ataque | 0.8 segundos |
| Distância de spawn | 15-35 unidades do jogador |
| Máximo simultâneo | 3 zombies |
| Intervalo de spawn | 15 segundos (apenas à noite) |
| Distância de despawn | 60 unidades |
| Burn height | y >= 60 (morre após 2s) |

**Comportamento**:
- Spawnam apenas à noite em posição aleatória ao redor do jogador
- Pathfinding direto em linha reta até o jogador
- Ataque por contato com animação de balanço dos braços
- Rosnados a cada 3 segundos quando dentro de 15 unidades (volume proporcional à distância)
- Flash vermelho ao receber dano (0.2s)
- Queimam e morrem se estiverem em y >= 60 por mais de 2 segundos

### Física do Jogador (`Player.ts`)

| Parâmetro | Valor |
|---|---|
| Velocidade de movimento | 5.0 unidades/s |
| Gravidade | -8.0 unidades/s² |
| Força do pulo | 4.5 unidades/s |
| Velocidade terminal | -18.0 unidades/s |
| Altura do jogador | 2.0 blocos |
| Largura do jogador | 0.6 blocos |
| Sensibilidade do mouse | 0.002 rad/px |
| Vida máxima | 20 HP |
| Invencibilidade pós-dano | 1.0 segundo |
| Intervalo de afogamento | 5 segundos (1 dano) |
| Tempo de respawn | 2.0 segundos |

**Colisão**: O jogador é representado por uma bounding box de 0.6x2.0x0.6. Pontos de amostragem a cada 0.5 unidades verificam blocos sólidos. Movimento horizontal e vertical são tratados separadamente para permitir deslizar ao longo de paredes.

### Raycasting (`main.ts`)

Raycasting baseado em **step traversal** (não Three.js Raycaster para blocos):
- Step size: 0.1 unidades
- Máximo: 60 steps (6 unidades de alcance)
- Calcula normal da face hit baseada na fração de entrada no bloco
- Para zombies: usa `THREE.Raycaster` padrão com `intersectObjects`

### Áudio (`AudioManager.ts`)

Singleton usando **Web Audio API** (`AudioContext`):

| Som | Arquivo | Gatilho |
|---|---|---|
| Break | `break.ogg` | Quebrar bloco / receber dano |
| Jump | `jump.ogg` | Pular |
| Place | `place.ogg` | Colocar bloco / passos |
| Zombie | `zombie.ogg` | Rosnado de zombie |

**Otimização**: Sons são trimados no carregamento para remover silêncio inicial. Passos reutilizam o som de "place" em volume reduzido (0.25) com intervalo de 0.35s.

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| **Linguagem** | TypeScript | ^5.7.0 |
| **Rendering 3D** | Three.js | ^0.170.0 |
| **Build Tool** | Vite | ^6.0.0 |
| **Target ES** | ES2020 | — |
| **Module System** | ESNext (bundler) | — |
| **Lint** | ESLint + TypeScript ESLint | ^8.59.2 / ^10.3.0 |
| **Format** | Prettier | ^3.8.3 |
| **Font** | Press Start 2P (Google Fonts) | — |

---

## Decisões de Design

### Por que Value Noise em vez de Perlin Noise?

Value noise é mais simples de implementar e suficiente para geração de terreno voxel. A diferença visual é mínima para este caso de uso, e a implementação customizada evita dependências externas.

### Por que Mesh Merging por Tipo de Bloco?

Em vez de criar um `THREE.Mesh` por bloco (o que resultaria em milhares de draw calls), blocos do mesmo tipo dentro de um chunk são combinados em uma única geometria. Isso reduz draw calls de `N*blocos` para `N*tipos` (tipicamente 6 por chunk).

### Por que Raycasting por Step em vez de Three.js Raycaster?

O raycaster do Three.js funciona com geometrias de mesh, que são merged. Isso torna impossível identificar qual bloco individual foi hit. O step-based raycaster percorre o grid de blocos diretamente, permitindo identificação precisa do bloco e da face atingida.

### Por que Singleton para AudioManager?

O `AudioContext` é um recurso pesado que deve ser compartilhado. O singleton garante uma única instância em toda a aplicação, evitando múltiplos contextos de áudio.

---

## Performance

### Otimizações Implementadas

- **Face culling**: Faces entre blocos adjacentes não são geradas
- **Mesh merging**: Geometrias combinadas por tipo de bloco por chunk
- **Chunk loading dinâmico**: Apenas chunks dentro do render distance (4 chunks) são carregados
- **Rebuild sob demanda**: Meshes só são reconstruídas quando blocos mudam (dirty flag)
- **Texturas cacheadas**: Cada textura é carregada uma vez e reutilizada
- **Pixel ratio limitado**: Touch devices limitados a 1.5x, desktop a 2x

### Limitações Conhecidas

- Chunks não são unloadados quando o jogador se afasta (apenas novos chunks são carregados)
- Raycasting é O(steps) por frame durante interação
- Geração de terreno é síncrona (pode causar frame drops em chunks novos)
- Não há LOD (Level of Detail) para chunks distantes

---

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia servidor de desenvolvimento com HMR |
| `npm run build` | Compila TypeScript e faz build de produção |
| `npm run preview` | Preview do build de produção localmente |
| `npm run lint` | Executa ESLint no diretório `src/` |
| `npm run lint:fix` | Executa ESLint com correção automática |

---

## Licença

Projeto desenvolvido por Juan Antonio Peruzzo.
