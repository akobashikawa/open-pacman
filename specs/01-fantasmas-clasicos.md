# SPEC 01 — Los cuatro fantasmas clásicos con IA propia

> **Estado:** Aprobado
> **Depende de:** ninguno
> **Fecha:** 2026-09-16
> **Objetivo:** Sustituir los 2 fantasmas actuales por los 4 clásicos (Blinky, Pinky, Inky y Clyde), cada uno con su IA de persecución por celda objetivo, fases globales scatter/chase y salida escalonada de la guarida.

## Alcance

**In:**

- Cuatro fantasmas identificados por `kind`: `blinky`, `pinky`, `inky`, `clyde`.
- IA de movimiento por celda objetivo (target tile): en cada celda alineada, el fantasma elige la dirección transitable que minimiza la distancia Manhattan a su objetivo, sin invertir dirección salvo callejón sin salida; en caso de empate, prioridad `up` > `left` > `down` > `right` (determinista, como el arcade).
- Objetivos por personalidad en fase chase:
  - `blinky` (agresivo): la celda de Pac-Man.
  - `pinky` (emboscada): 4 celdas delante de Pac-Man según su dirección actual.
  - `inky` (flanqueo): pivote = 2 celdas delante de Pac-Man; objetivo = `2·pivote − posición de blinky`.
  - `clyde` (tímido): si su distancia a Pac-Man es > 8 celdas, objetivo = Pac-Man; si es ≤ 8, objetivo = su esquina de scatter.
- Fases globales scatter/chase con temporizador en frames de juego: scatter 420 frames (~7 s a 60 fps) y chase 1200 frames (~20 s), alternando 4 ciclos; a partir de ahí, chase permanente. En scatter, el objetivo de cada fantasma es su esquina asignada.
- Salida escalonada de la guarida, medida en frames de juego desde el inicio de la partida (y re-aplicada tras perder una vida):
  - `blinky` arranca ya fuera, en (13, 11), sobre la puerta.
  - `pinky` en (13, 14) sale a los 120 frames (~2 s).
  - `inky` en (12, 14) sale a los 360 frames (~6 s).
  - `clyde` en (15, 14) sale a los 540 frames (~9 s).
  - Mientras un fantasma espera en la guarida, oscila verticalmente alrededor de su celda (±0.5 en `y`).
- Máquina de estados por fantasma: `pen` (esperando/oscilando) → `exit` (ruta guionizada: primero alinearse en la columna 13 de la fila 14, luego subir en línea recta hasta (13, 11)) → `active` (IA normal).
- Regla de puerta (celda 3): transitable únicamente por fantasmas en modo `exit`; muro para Pac-Man (regla actual que se conserva) y para fantasmas activos (nadie re-entra a la guarida).
- Colores por `kind` en `render.js`: blinky `#ff0000`, pinky `#ffb8ff`, inky `#00ffff`, clyde `#ffb852` (mapeo por `kind`, no por índice de array).
- `resetPositions` (tras perder una vida) re-aplica el estado inicial completo de los fantasmas: posiciones, direcciones, modos, delays de salida y temporizador de fases.

**Fuera de alcance (para futuros specs):**

- Power pellets y modo asustado (fantasmas comestibles, regreso a la guarida al ser comidos, puntuación con multiplicador).
- Cruise Elroy (Blinky acelera cuando quedan pocos dots): velocidad uniforme `GHOST_SPEED = 0.1`.
- El bug original del arcade con Pinky y la dirección `up` (desplazamiento lateral del objetivo).
- Pathfinding real (BFS/Dijkstra): la IA decide por celda vecina, como el arcade.
- Paso fijo del bucle (`requestAnimationFrame` es ~60 fps variable; preexistente, afecta a todo el juego).
- Sonidos, niveles múltiples, dificultad creciente.

## Modelo de datos

`src/js/maze.js` — `GHOST_STARTS` pasa de 2 a 4 entradas; cada una gana `scatter` (esquina objetivo):

```js
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky', scatter: { x: 25, y: 0 } },  // fuera, sobre la puerta
  { x: 13, y: 14, kind: 'pinky',  scatter: { x: 2,  y: 0 } },  // centro de la guarida
  { x: 12, y: 14, kind: 'inky',   scatter: { x: 27, y: 30 } }, // izquierda de la guarida
  { x: 15, y: 14, kind: 'clyde',  scatter: { x: 0,  y: 30 } }, // derecha de la guarida
];
```

Las esquinas de scatter pueden ser celdas de pared: son objetivos de navegación, no celdas a pisar.

`src/js/game.js` — cada fantasma gana campos de estado y pasa por una pequeña máquina de estados:

```js
// Por fantasma, en createGame():
{
  x: g.x,
  y: g.y,
  dir: 'left',
  speed: GHOST_SPEED,
  kind: g.kind,
  scatter: g.scatter,
  mode: 'pen',        // 'pen' | 'exit' | 'active'
  bobDir: -1,         // +/-1, solo usado en 'pen'
  exitDelayFrames: 0, // blinky 0, pinky 120, inky 360, clyde 540
}

// Global de partida, en createGame():
mode: { phase: 'scatter', timerFrames: 420, cycle: 0 },
// SCATTER_FRAMES = 420, CHASE_FRAMES = 1200, MAX_CYCLES = 4
```

Los contadores (`exitDelayFrames` y `game.mode.timerFrames`) se decrementan dentro de `update()`, que solo corre con `state === 'playing'`: los timers se pausan solos en las pantallas de inicio/fin.

`src/js/render.js` — sustituir el array `GHOST_COLORS` indexado por un mapa por `kind`:

```js
const GHOST_COLOR = {
  blinky: '#ff0000',
  pinky:  '#ffb8ff',
  inky:   '#00ffff',
  clyde:  '#ffb852',
};
```

`main.js` e `index.html` no cambian.

## Plan de implementación

1. Actualizar `GHOST_STARTS` en `src/js/maze.js` con los 4 fantasmas y sus esquinas `scatter`. Verificación manual: el juego carga, se ven 4 fantasmas en/fuera de la guarida y la consola queda limpia (los colores aún se asignan por índice y quedarán mal hasta el paso 2).
2. Sustituir `GHOST_COLORS` por el mapa `GHOST_COLOR` por `kind` en `src/js/render.js`. Verificación: rojo, rosa, cian y naranja sobre la guarida, estables al reiniciar.
3. Añadir en `src/js/game.js` los campos por fantasma y el objeto `game.mode`; implementar la máquina de estados `pen` (oscilación ±0.5 en `y`), `exit` (alinearse en la columna 13 de la fila 14 y subir hasta (13, 11)) y `active`; aplicar los delays 0/120/360/540; actualizar `resetPositions` para re-aplicar posiciones, direcciones, modos, delays y fases. Verificación: al empezar la partida los fantasmas salen escalonados (~2/6/9 s) y, tras perder una vida, vuelve a ocurrir.
4. En `src/js/game.js`: tratar la puerta (valor 3) como muro para fantasmas activos; reescribir `decideGhost` como IA por celda objetivo con desempate `up` > `left` > `down` > `right`; implementar los objetivos por `kind` en chase y esquinas en scatter; implementar el temporizador global de fases (420/1200 frames, 4 ciclos, luego chase permanente). Verificación jugando: Blinky acosa directo, Pinky corta el paso, Inky flanquea, Clyde se retira al acercarse, y todos van a su esquina en scatter.
5. Verificación final de todos los criterios de aceptación, jugando partidas completas con la consola abierta.

## Criterios de aceptación

- [ ] Se ven 4 fantasmas con colores rojo, rosa, cian y naranja desde el primer frame, y siguen correctos tras reiniciar.
- [ ] Blinky arranca fuera de la guarida; Pinky, Inky y Clyde salen de forma escalonada (~2 s, ~6 s, ~9 s) tras oscilar dentro mientras esperan.
- [ ] En fase chase, Blinky toma de forma continuada el camino que minimiza su distancia a la celda de Pac-Man, sin retroceder salvo callejón.
- [ ] Con Pac-Man avanzando en línea recta, Pinky se dirige a un punto por delante de su posición (emboscada visible).
- [ ] La trayectoria de Inky depende de la posición de Blinky (flanqueo; cambia si Blinky se mueve).
- [ ] Clyde persigue de lejos y, al acercarse a ≤ 8 celdas de Pac-Man, se retira hacia su esquina inferior izquierda.
- [ ] Al iniciar cada ciclo, los cuatro fantasmas se dirigen a su esquina ~7 s (scatter) y después persiguen ~20 s; tras 4 ciclos la persecución es permanente.
- [ ] Ningún fantasma activo re-entra en la guarida.
- [ ] Perder una vida resetea posiciones y re-aplica el escalonado de salidas y el temporizador de fases.
- [ ] Ganar (comer todos los dots) y perder (3 vidas) siguen funcionando, con overlays correctos y consola sin errores.

## Decisiones

- **Sí:** personalidades clásicas del arcade por celda objetivo. Bien documentadas y claramente distinguibles jugando.
- **No:** comportamientos custom simplificados. Menos valor didáctico y peor sensación de juego.
- **Sí:** fases scatter/chase con temporizador global simple en frames (420/1200, 4 ciclos). Da ritmo y evita acoso permanente.
- **Sí:** salidas escalonadas por tiempo en frames de juego. Simple y suficiente; la salida por contadores de dots del arcade es overkill aquí.
- **No:** power pellets y modo asustado. Merece su propio spec (afecta puntuación, estados, render y regreso a la guarida).
- **No:** Cruise Elroy (aceleración de Blinky con pocos dots). Velocidad uniforme `GHOST_SPEED`.
- **No:** replicar el bug original de Pinky con la dirección `up`. El objetivo se calcula igual para las 4 direcciones.
- **No:** pathfinding real (BFS). La decisión por celda vecina es como funciona el arcade original.
- **Sí:** desempate de direcciones con prioridad `up` > `left` > `down` > `right`. Determinista y fiel al original.
- **Sí:** puerta transitable solo en modo `exit`. Evita que los activos re-entren y queden atrapados en la guarida.
- **Sí:** timers en frames que solo avanzan jugando (`update` no corre fuera de `playing`). Pausa gratis en overlays.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `requestAnimationFrame` no es paso fijo: en pantallas de ~120 Hz todo el juego (no solo los timers nuevos) corre al doble de velocidad. | Preexistente y aceptado para el MVP. Un futuro spec puede introducir paso fijo con acumulador; queda anotado fuera de alcance. |
| Varias IA por distancia pueden apilarse en el mismo corredor persiguiendo el mismo objetivo. | Es el comportamiento del arcade original (los fantasmas se solapan); no se considera bug. |
| La ruta guionizada de salida asume la geometría fija de la guarida (columna 13, fila 14). | Las posiciones vienen de `GHOST_STARTS` en `maze.js`, único dueño de esa geometría; si la guarida cambia, el spec se revisa. |

## Qué **no** entra en este spec

- Power pellets, modo asustado y fantasmas comestibles.
- Cruise Elroy y velocidades distintas por fantasma.
- Sonidos, niveles múltiples, dificultad creciente, paso fijo del bucle.

Cada uno de esos puntos, si llega, va en su propio spec.
