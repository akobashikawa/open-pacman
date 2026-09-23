# SPEC 04 — Modo asustado: fantasmas azules y comestibles

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03
> **Fecha:** 2026-09-23
> **Objetivo:** Al comer un power pellet los cuatro fantasmas pasan a un modo asustado temporal (azules, erráticos, lentos y comestibles), regresan a la guarida como ojos al ser comidos otorgando 200/400/800/1600 puntos en cadena, y reviven para volver a salir.

## Alcance

**In:**

- Activación del modo al comer un power pellet (valor 4) en `movePacman`: se crea el estado global `game.frightened = { framesLeft: 360, chain: 0 }` y se marca `g.frightened = true` en los cuatro fantasmas que no estén en modo `eaten`.
- Duración: 360 frames (~6 s a 60 fps), como el nivel 1 del arcade.
- Flag asustado **por fantasma** (`g.frightened`) + temporizador **global**: un fantasma comido y revivido no se re-asusta aunque el modo siga activo (comportamiento arcade).
- Al activarse, los fantasmas con `mode === 'active'` invierten su dirección (`g.dir = OPPOSITE[ g.dir ]`) de forma inmediata.
- Velocidades: asustados a `0.05` (mitad de `GHOST_SPEED`); ojos que regresan a `0.2` (doble). El resto de casos sigue a `GHOST_SPEED`.
- Movimiento asustado: paseo aleatorio uniforme por celda (el patrón de `wanderPen` de SPEC 02, aplicado al laberinto con `wrapTunnel`), en vez de la IA por celda objetivo; reversiones permitidas.
- Comer fantasma: colisión con un fantasma asustado (modo `pen`/`exit`/`active` con `g.frightened`) lo pasa a modo `eaten`, suma `GHOST_POINTS[ chain ]` (200/400/800/1600) e incrementa `chain` (máx. 3). La cadena se reinicia a 0 con cada pellet.
- Modo `eaten` (nuevo estado en la máquina por fantasma): el fantasma se ve como solo ojos y navega con `decideGhost` hacia `PEN_CENTER` (13,14) a `EYES_SPEED`, con la puerta (valor 3) transitable como excepción exclusiva de este modo (`isWall`/`canMove` ganan un parámetro `allowDoor`, `false` por defecto).
- Revivir: al alcanzar la celda (13,14), `mode` pasa a `'exit'` y `speed` a `GHOST_SPEED`; la ruta `exitGhost` existente lo saca sin cambios y vuelve como fantasma normal (no asustado).
- Los ojos no colisionan con Pac-Man (ni muerte ni puntos) ni impiden seguir comiendo otros fantasmas.
- Si en un mismo frame hay colisión con un fantasma asustado y con uno normal, la comida prevalece sobre la muerte.
- Expiración a los 360 frames: `game.frightened = null`, `g.frightened = false` para todos, y `GHOST_SPEED` restaurada solo a los activos no comidos (los ojos conservan `EYES_SPEED` hasta revivir).
- El temporizador global scatter/chase (`updateMode`) queda en pausa mientras dura el modo asustado y se reanuda donde iba al terminar.
- Segundo pellet durante modo activo: el temporizador vuelve a 360 frames completos y la cadena se reinicia a 0; los ojos en tránsito no se re-asustan.
- `resetPositions` (tras perder una vida) limpia el modo: `game.frightened = null`, `g.frightened = false` y `speed = GHOST_SPEED` para todos.
- Render en `render.js`: cuerpo azul (`#2121ff`) con cara asustada simplificada (ojos blancos sin pupila y boca); en los últimos 120 frames parpadeo alternando azul/blanco cada 15 frames (~0.25 s); en `eaten`, solo los dos ojos orientados según `g.dir`.

**Fuera de alcance (para futuros specs):**

- Sonidos (el tono de asustado, el de comer fantasma) y congelación de ~0.5 s al comer un fantasma.
- Duración decreciente del modo por nivel o dificultad creciente: solo hay un nivel.
- Cruise Elroy, cambios en las IA de chase/scatter, velocidades por fantasma.
- Paso fijo del bucle (`requestAnimationFrame` es ~60 fps variable; preexistente, ya anotado en SPEC 01).
- Cambios en `maze.js`, `main.js` e `index.html`: no se tocan en este spec.

## Modelo de datos

`src/js/game.js` — constantes nuevas y estado:

```js
// Constantes nuevas junto a las de fases:
const FRIGHTENED_FRAMES = 360;       // 6 s a 60 fps (nivel 1 del arcade)
const FRIGHTENED_FLASH_FRAMES = 120; // ultimos ~2 s: parpadeo azul/blanco
const FRIGHTENED_SPEED = 0.05;       // mitad de GHOST_SPEED
const EYES_SPEED = 0.2;              // doble de GHOST_SPEED
const GHOST_POINTS = [ 200, 400, 800, 1600 ];

// Global de partida, en createGame() — null = modo inactivo:
frightened: null,
// Al comer un pellet: { framesLeft: FRIGHTENED_FRAMES, chain: 0 }

// Por fantasma, en createGame() y resetPositions():
mode: 'pen',       // 'pen' | 'exit' | 'active' | 'eaten' (nuevo)
frightened: false, // true mientras dura el modo y no ha sido comido
```

- `isWall` / `canMove` ganan un parámetro opcional `allowDoor` (por defecto `false`); solo la IA de ojos (`eaten`) lo usa con `true`. La puerta sigue siendo muro para Pac-Man, paseo de la guarida y activos.
- El paseo asustado reutiliza la lógica de `wanderPen` (dirección aleatoria uniforme entre las transitables por `canMove`) añadiendo `wrapTunnel`.
- La máquina de estados de `updateGhost` pasa a `pen → exit → active → eaten → exit → active` (el `eaten` revive en `'exit'`).

`src/js/render.js` — color por estado en `drawGhost` (decidido en `draw`, que ya tiene `game` y `frame`):

```js
const FRIGHTENED_COLOR = '#2121ff';       // mismo azul que las paredes, como el arcade
const FRIGHTENED_FLASH_COLOR = '#ffffff'; // fase de aviso del final

// eaten          -> solo los dos ojos (sin cuerpo)
// g.frightened   -> FRIGHTENED_COLOR + cara asustada
// g.frightened && framesLeft <= 120 && floor( frame / 15 ) % 2 === 1
//                -> FRIGHTENED_FLASH_COLOR + cara asustada
// resto          -> GHOST_COLOR[ g.kind ]
```

`maze.js`, `main.js` e `index.html` no cambian.

## Plan de implementación

1. En `src/js/game.js`, añadir las 5 constantes, el campo global `frightened` y el flag por fantasma; activar el modo al comer el pellet en `movePacman` (flag a los no comidos, reversión de activos, `speed = FRIGHTENED_SPEED`); decrementar y expirar el temporizador en `update` (restaurar velocidades de activos no comidos); pausar `updateMode` mientras dure el modo; limpiar todo en `resetPositions`. Estado intermedio jugable: los asustados aún usan su IA normal. Verificación manual: al comer un pellet los activos dan la vuelta y avanzan a mitad de velocidad; a los ~6 s recuperan ritmo y las fases scatter/chase reanudan; tras perder una vida todo vuelve a la normalidad.
2. En `src/js/game.js`, movimiento asustado: los activos con `g.frightened` pasan al paseo aleatorio uniforme por celda (patrón de `wanderPen` + `wrapTunnel`) en lugar de `decideGhost`. Verificación: los asustados deambulan de forma errática por el laberinto, no persiguen, cruzan el túnel y no se atascan.
3. En `src/js/game.js`, modo `eaten` y puntuación: colisión con asustado → sumar `GHOST_POINTS[ chain ]`, `chain++`, `mode = 'eaten'`, `frightened = false`, `speed = EYES_SPEED`; `decideGhost` con objetivo fijo `PEN_CENTER` y `allowDoor` para los ojos; revivir en (13,14) → `mode = 'exit'`, `speed = GHOST_SPEED`; los ojos no colisionan; la comida se resuelve antes que la muerte en el mismo frame. Verificación: comer dos asustados seguidos suma exactamente 200 y 400; los ojos cruzan la puerta, reviven en el centro y re-salen normales; atravesar ojos no mata ni puntúa.
4. En `src/js/render.js`, pintar el estado: azul con cara asustada, parpadeo azul/blanco cada 15 frames durante los últimos 120, y solo ojos en `eaten`. Verificación visual completa: azul al comer pellet, aviso parpadeante al final, ojos al comerlos, colores normales al revivir y al expirar el modo.
5. Verificación final de todos los criterios de aceptación, jugando partidas completas con la consola abierta.

## Criterios de aceptación

- [ ] Al comer un power pellet, los cuatro fantasmas se vuelven azules y los que están activos invierten su dirección al instante.
- [ ] Los asustados se mueven de forma errática (dirección aleatoria en cada celda, reversiones incluidas) y tardan el doble que un fantasma normal en cruzar una celda.
- [ ] Un fantasma asustado se puede comer: su cuerpo desaparece y quedan solo los ojos.
- [ ] El primer fantasma comido tras un pellet suma exactamente 200; el segundo 400; el tercero 800; el cuarto 1600.
- [ ] Los ojos navegan hasta la guarida, cruzan la puerta, reviven en el centro y re-salen por la puerta con color, velocidad y IA normales.
- [ ] Un fantasma revivido no se re-asusta aunque el modo siga activo: sale normal.
- [ ] En los últimos ~2 s del modo, los asustados parpadean alternando azul y blanco.
- [ ] Al agotarse los 6 s, todos vuelven a color, velocidad y persecución normales; tocar un fantasma después mata.
- [ ] Comer un segundo pellet durante el modo reinicia el temporizador a 6 s completos y la cadena a 200.
- [ ] Los fantasmas que estaban en `pen`/`exit` al comerse el pellet también se asustan y, si salen con modo activo, salen azules.
- [ ] Mientras dura el modo, las fases scatter/chase quedan en pausa y se reanudan donde iban al terminar.
- [ ] Atravesar unos ojos no produce muerte ni puntos.
- [ ] Perder una vida con el modo activo lo limpia: reinicio de posiciones sin azules ni ojos.
- [ ] Ganar, perder 3 vidas y reiniciar siguen funcionando, con overlays correctos y consola sin errores.

## Decisiones

- **Sí:** 360 frames (6 s) con 120 de parpadeo de aviso. Nivel 1 del arcade; tiempo para cazar a los cuatro sin ser trivial.
- **Sí:** paseo aleatorio uniforme como movimiento asustado. Es el comportamiento del arcade y reutiliza el patrón de SPEC 02 (`wanderPen`), solo añadiendo `wrapTunnel`.
- **Sí:** velocidades 0.05 asustado / 0.2 ojos. Fiel al arcade (mitad / doble de `GHOST_SPEED`).
- **Sí:** ojos navegando con IA hacia (13,14) y puerta transitable solo para ellos. El viaje visible es parte del valor didáctico; `decideGhost` ya sabe llegar a cualquier celda objetivo.
- **Sí:** revivir en el centro y re-salir por `exitGhost`. Cero código nuevo de ruta.
- **Sí:** reversión de dirección de los activos al comer el pellet. Feedback claro e inmediato, como el arcade.
- **Sí:** cadena 200/400/800/1600 reiniciada por cada pellet. Es lo que SPEC 03 dejó apuntado para este spec.
- **Sí:** flag `g.frightened` por fantasma + temporizador global. Permite que el revivido no se re-asuste (comportamiento arcade) sin condiciones especiales en colisiones o render.
- **Sí:** asustar también a los fantasmas en `pen`/`exit`. Un solo flag global cae gratis y es lo que hace el arcade.
- **Sí:** pausar `updateMode` durante el modo. Como el arcade; evita cambios de fase invisibles para el jugador.
- **Sí:** segundo pellet reinicia tiempo y cadena. Como el arcade; evita cadenas de 1600 gratis al solapar pellets.
- **Sí:** resolver la comida antes que la muerte en un mismo frame. El arcade congela al comer, así que la muerte nunca gana esa carrera.
- **No:** teletransporte a la guarida al ser comido. Pierde el viaje de los ojos, que es la mitad del show.
- **No:** huir de Pac-Man con la IA de celda objetivo. El paseo aleatorio es el arcade y reutiliza código existente.
- **No:** puntuación fija de 200. La cadena duplicadora es el comportamiento clásico apuntado desde SPEC 03.
- **No:** re-asustar ojos con un segundo pellet. En el arcade los ojos siguen siendo ojos hasta revivir.
- **No:** congelación de ~0.5 s al comer un fantasma y sonidos. Estado intermedio del juego; si llega, va en spec propio.
- **No:** duración decreciente por nivel. Solo existe un nivel.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `requestAnimationFrame` no es paso fijo: en pantallas de ~120 Hz los 6 s nominales se cumplen en ~3 s reales. | Preexistente y aceptado desde SPEC 01; el paso fijo sigue fuera de alcance. |
| La IA de ojos (greedy Manhattan sin reversión) no es el camino más corto y puede dar rodeos. | Es el mismo mecanismo que ya usan los activos (fiel al arcade); siempre converge al objetivo y `EYES_SPEED` lo hace rápido. |
| Comer un fantasma en `exit` (a mitad de puerta) deja a los ojos partiendo de una posición no alineada. | `moveGhost`/`decideGhost` solo deciden en celda alineada: avanza en su dirección actual hasta alinear y luego decide; sin caso especial. |
| Fantasmas asustados y ojos solapándose con otros (sin colisión fantasma-fantasma). | Ya ocurre hoy con los activos (anotado en SPEC 01); no se considera bug. |

## Qué **no** entra en este spec

- Sonidos y congelación al comer un fantasma.
- Duración del modo por nivel, dificultad creciente, niveles múltiples.
- Cruise Elroy, cambios de IA en chase/scatter, velocidades por fantasma.

Cada uno de esos puntos, si llega, va en su propio spec.
