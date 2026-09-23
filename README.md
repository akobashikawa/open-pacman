# PacMan like

Clon de Pac-Man en vanilla JS/HTML/CSS, fiel a la geometría y a las mecánicas del nivel 1 del arcade original: laberinto 28×31, los cuatro fantasmas clásicos con IA propia, power pellets y modo asustado.

Sin build, sin bundler y sin gestor de paquetes: se abre y funciona.

## Tecnologías

- Vanilla JS
- HTML
- CSS

## Cómo jugar

Abre `src/index.html` directamente en el navegador (funciona por `file://`, sin servidor de desarrollo).

- **Movimiento:** flechas del teclado; el giro se aplica en la próxima celda alineada, como en el arcade.
- **Objetivo:** comer todos los dots y los 4 power pellets sin perder las 3 vidas.
- **Puntuación:** dot 10 · power pellet 50 · fantasma 200/400/800/1600 (se duplica con cada fantasma comido desde el último pellet).

## Mecánicas

- **Laberinto 28×31** con túnel lateral en la fila 14: sal por un borde y apareces por el otro.
- **4 fantasmas clásicos** con IA por celda objetivo (distancia Manhattan, sin pathfinding):
  - **Blinky** (rojo) persigue directo la celda de Pac-Man.
  - **Pinky** (rosa) embosca apuntando 4 celdas por delante.
  - **Inky** (cian) flanquea usando a Blinky como pivote.
  - **Clyde** (naranja) persigue de lejos y se retira a su esquina al acercarse a ≤ 8 celdas.
- **Fases scatter/chase** globales: ~7 s hacia su esquina, ~20 s de persecución, 4 ciclos y luego persecución permanente.
- **Salidas escalonadas de la guarida:** al iniciar la partida salen cada 2.5 s; tras perder una vida, a los ~2/6/9 s. Mientras esperan, deambulan de forma errática por el interior.
- **Power pellets** en las cuatro esquinas: parpadean, valen 50 puntos y activan el **modo asustado** durante ~6 s.
- **Modo asustado:** los cuatro fantasmas se vuelven azules, invierten la marcha, deambulan de forma errática a mitad de velocidad y son comestibles. Un fantasma comido queda como solo ojos que regresan a la guarida, revive y vuelve a salir normal (no se re-asusta aunque el modo siga activo). El final del modo se avisa con un parpadeo azul/blanco de ~2 s; mientras dura, las fases scatter/chase quedan en pausa.

## Arquitectura

Cuatro scripts plain (sin módulos ES) cargados en este orden por `src/index.html`; comparten globals:

1. `src/js/maze.js` — datos del laberinto y globals (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`).
2. `src/js/game.js` — estado y reglas (`createGame`, `update`).
3. `src/js/render.js` — dibujo en canvas (`draw`); renderiza desde `game.grid`, nunca desde `MAZE`.
4. `src/js/main.js` — bucle, teclado y pantallas.

Canvas de 560×620 = 28 columnas × 31 filas a `TILE = 20`. `createGame()` copia `MAZE` a `game.grid` para poder comer dots sin destruir el original, que así queda disponible para los reinicios.

## Spec Driven Development

El proyecto sirve además para aprender este enfoque: cada feature vive en `specs/NN-slug.md` con su ciclo de estados (borrador → aprobado → implementado) y se construye con los skills `/spec` (diseña el spec) y `/spec-impl` (lo implementa paso a paso, en su propia rama).

| Spec | Feature |
| ---- | ------- |
| [01](specs/01-fantasmas-clasicos.md) | Los cuatro fantasmas clásicos con IA propia |
| [02](specs/02-salida-2-5s-y-paseo-erratico.md) | Salida cada 2.5 s al iniciar y paseo errático en la guarida |
| [03](specs/03-power-pellets-en-las-esquinas.md) | Power pellets en las cuatro esquinas |
| [04](specs/04-modo-asustado.md) | Modo asustado: fantasmas azules y comestibles |
