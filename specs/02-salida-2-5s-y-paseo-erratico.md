# SPEC 02 — Salida cada 2.5 s al iniciar y paseo errático en la guarida

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-16
> **Objetivo:** Al iniciar la partida los tres fantasmas de la guarida deambulan de forma errática por su interior y salen a intervalos de 2.5 s (2.5 / 5 / 7.5 s), conservándose tras perder una vida los tiempos de salida de SPEC 01 (2 / 6 / 9 s).

## Alcance

**In:**

- Delays de salida al iniciar la partida, en `createGame`: blinky 0 frames (arranca ya fuera, como hasta ahora), pinky 150 frames (~2.5 s), inky 300 frames (~5 s), clyde 450 frames (~7.5 s).
- Delays tras perder una vida, en `resetPositions`: se conservan exactamente los de SPEC 01 — pinky 120 frames (~2 s), inky 360 frames (~6 s), clyde 540 frames (~9 s).
- Paseo aleatorio por celdas en el interior de la guarida mientras un fantasma espera en modo `pen`, sustituyendo la oscilación vertical ±0.5 de SPEC 01:
  - En cada celda alineada, el fantasma elige una dirección aleatoria uniforme entre las transitables según `canMove` sobre `game.grid`.
  - La puerta (valor 3) ya cuenta como muro para `canMove`: el paseo no puede cruzarla y queda encerrado en el interior de la guarida (cols 11–16, filas 13–15) sin lógica extra de contención.
  - Se permiten reversiones de dirección (parte del aspecto errático); el interior no tiene callejones sin salida, nadie se atasca.
  - Velocidad `GHOST_SPEED` sin cambios; `g.dir` se actualiza con el movimiento para que el render muestre la mirada coherente.
- El paseo aleatorio aplica en ambos contextos de espera: inicio de partida y tras perder una vida.
- La ruta guionizada de salida (`exitGhost`) no cambia: al cumplirse el delay (aunque el fantasma esté a mitad de celda), se alinea a la columna 13 y sube en línea recta hasta (13, 11).

**Fuera de alcance (para futuros specs):**

- Power pellets y modo asustado (fantasmas comestibles, regreso a la guarida, puntuación con multiplicador).
- Cambios en la IA de persecución, fases scatter/chase, colores, velocidades o Cruise Elroy.
- Salidas por contadores de dots del arcade o cadencias configurables por nivel.
- Cambios en `maze.js`, `render.js`, `main.js` e `index.html`: no se tocan en este spec.
- Paso fijo del bucle (`requestAnimationFrame` es ~60 fps variable; preexistente, ya anotado en SPEC 01).

## Modelo de datos

Solo cambia `src/js/game.js`. La constante única de delays se divide en dos literales, uno por contexto:

```js
// Salida al iniciar la partida: intervalos de 2.5 s = 150 frames a 60 fps.
const EXIT_DELAY_FRAMES_START = { blinky: 0, pinky: 150, inky: 300, clyde: 450 };
// Salida tras perder una vida: valores de SPEC 01, sin cambio.
const EXIT_DELAY_FRAMES_RESPAWN = { blinky: 0, pinky: 120, inky: 360, clyde: 540 };
```

- `createGame` pasa a usar `EXIT_DELAY_FRAMES_START`; `resetPositions` usa `EXIT_DELAY_FRAMES_RESPAWN`.
- El campo por fantasma `bobDir` desaparece: la dirección errática se decide al vuelo en cada celda alineada y no necesita estado persistente. El resto de campos del fantasma no cambia.
- `bobGhost( g )` se sustituye por un paseo aleatorio que consulta `canMove( game.grid, ... )`; `updateGhost` cambia la llamada pero mantiene su estructura (`pen` → `exit` → `active`).
- Geometría de referencia (proviene de `MAZE`, no se duplica en código): interior de la guarida = cols 11–16, filas 13–15; puerta en fila 12, cols 13–14.

## Plan de implementación

1. En `src/js/game.js`, sustituir `EXIT_DELAY_FRAMES` por las dos constantes nuevas y repartir su uso: `createGame` → `EXIT_DELAY_FRAMES_START`, `resetPositions` → `EXIT_DELAY_FRAMES_RESPAWN`. Verificación manual: al iniciar la partida las salidas pasan a ~2.5 / 5 / 7.5 s; tras perder una vida siguen siendo ~2 / 6 / 9 s; la espera sigue siendo la oscilación vertical actual (aún sin cambiar en este paso).
2. En `src/js/game.js`, sustituir `bobGhost` por el paseo aleatorio dentro de la guarida (dirección aleatoria uniforme entre las transitables por `canMove`, avance a `g.speed`, actualización de `g.dir`) y eliminar `bobDir` de `createGame` y `resetPositions`. Verificación: los tres fantasmas deambulan por todo el interior de la guarida sin cruzar la puerta antes de tiempo, sin atascarse y sin errores en consola; al llegar su delay salen con normalidad desde donde estén.
3. Verificación final de todos los criterios de aceptación, jugando partidas completas con la consola abierta.

## Criterios de aceptación

- [ ] Al iniciar una partida, Blinky arranca ya fuera de la guarida y Pinky, Inky y Clyde deambulan de forma errática por su interior mientras esperan.
- [ ] Al iniciar una partida, Pinky sale a los ~2.5 s, Inky a los ~5 s y Clyde a los ~7.5 s.
- [ ] Ningún fantasma en espera cruza la puerta: el paseo se mantiene dentro del interior (cols 11–16, filas 13–15).
- [ ] Ningún fantasma en espera se queda inmóvil ni atascado contra una pared.
- [ ] Al cumplirse un delay con el fantasma a mitad de celda, la ruta de salida lo alinea con la columna 13 y lo sube hasta (13, 11) sin errores.
- [ ] Tras perder una vida, los tres vuelven a la guarida, deambulan esperando y salen a ~2 s, ~6 s y ~9 s (tiempos de SPEC 01).
- [ ] Ganar, perder 3 vidas y reiniciar siguen funcionando, con overlays correctos y consola sin errores.

## Decisiones

- **Sí:** intervalos de 2.5 s entre salidas al iniciar (150 / 300 / 450 frames), con Blinky arrancando fuera. Petición del usuario; Blinky conserva el arranque arcade de SPEC 01.
- **Sí:** conservar los delays de SPEC 01 (120 / 360 / 540) tras perder una vida. Petición del usuario: la cadencia de 2.5 s es exclusiva del inicio de partida y evita esperas largas después de cada muerte.
- **Sí:** paseo aleatorio uniforme por celdas en lugar de la oscilación vertical ±0.5. Petición del usuario ("que se movieran erráticamente dentro del pen"); no añade estado y no toca `maze.js` ni `render.js`.
- **Sí:** paseo con `canMove` sobre `game.grid`. La puerta (valor 3) ya es muro para `canMove`, así que el encierro en la guarida sale gratis, sin duplicar geometría.
- **Sí:** reversiones permitidas en el paseo. Refuerzan el aspecto errático y el interior (6 × 3 celdas libres) no tiene callejones.
- **Sí:** dos constantes literales (START / RESPAWN) en vez de una parametrizada. Dos contextos distintos, dos literales; todavía no hay nada que merezca ser configurable.
- **No:** velocidad distinta para el paseo. Se cambia el patrón de espera, no el ritmo: `GHOST_SPEED`.
- **No:** editar SPEC 01. Sus valores de inicio quedan modificados por este spec; SPEC 01 se queda como histórico aprobado y este documento registra el cambio.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `requestAnimationFrame` no es paso fijo: en pantallas de ~120 Hz los 2.5 s nominales se cumplen en ~1.25 s reales. | Preexistente y aceptado en SPEC 01; el paso fijo sigue fuera de alcance. |
| El delay puede cumplirse con el fantasma a mitad de celda del paseo. | La ruta de salida (`exitGhost` / `stepToward`) ya trabaja con tolerancia epsilon desde cualquier posición; se verifica en el paso 2. |
| Dos fantasmas pueden solaparse al deambular por la guarida. | Ya ocurre con los fantasmas activos (no hay colisiones fantasma-fantasma); se considera aceptable. |

## Qué **no** entra en este spec

- Power pellets, modo asustado y fantasmas comestibles.
- Cambios de IA, fases scatter/chase, velocidades, Cruise Elroy.
- Salidas por contadores de dots o cadencias configurables por nivel.

Cada uno de esos puntos, si llega, va en su propio spec.
