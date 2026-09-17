# SPEC 03 — Power pellets en las cuatro esquinas

> **Estado:** Aprobado
> **Depende de:** ninguno
> **Fecha:** 2026-09-17
> **Objetivo:** Colocar 4 power pellets en las esquinas clásicas del laberinto, visibles como círculos grandes parpadeantes y comibles por 50 puntos, sin modo asustado.

## Alcance

**In:**

- 4 power pellets en las celdas clásicas del arcade: (1,3), (26,3), (1,23), (26,23), sustituyendo los dots normales actuales (la simetría del eje cols 13/14 se conserva).
- Representación: carácter `o` en `MAZE_STR`, parseado a valor 4 por `parseTile` (distinto de pared 1 / dot 2 / puerta 3; transitable como el resto de suelo).
- Los pellets cuentan como dots para la victoria: el conteo de `createGame` suma `v === 2` y `v === 4` en `dotsRemaining`.
- Comer: al pasar Pac-Man por una celda 4, esta pasa a 0, suma 50 puntos y decrementa `dotsRemaining`.
- Render: círculo de radio 6 px (vs 2.5 de los dots) con el mismo `DOT_COLOR`, parpadeando visible/oculto cada 15 frames (~0.25 s a 60 fps) usando el `frame` del bucle.
- Reinicios: `createGame` copia `MAZE`, así que reiniciar tras ganar/perder repone los 4 pellets; tras perder una vida no se restauran (mismo comportamiento que los dots: `resetPositions` no toca el grid).

**Fuera de alcance (para futuros specs):**

- Modo asustado: fantasmas azules, comestibles, puntuación 200/400/800/1600 y regreso a la guarida al ser comidos.
- Cualquier cambio en la IA de fantasmas, fases scatter/chase, velocidades o colores.
- Sonidos, niveles múltiples, dificultad creciente, paso fijo del bucle (preexistente, ya anotado en SPEC 01).
- Cambios en `main.js` e `index.html`: no se tocan en este spec.

## Modelo de datos

`src/js/maze.js` — 4 caracteres cambian en `MAZE_STR` y `parseTile` gana un caso:

```js
// Filas 3 y 23: '.' pasa a 'o' en cols 1 y 26.
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'o' ) return 4; // power pellet
  return 0;
}
```

`src/js/game.js` — conteo y comida en `createGame` / `movePacman`:

```js
// createGame: los pellets cuentan como dots.
for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

// movePacman: comer dot o pellet con la misma rama.
const v = grid[ p.y ][ p.x ];
if ( v === 2 || v === 4 ) {
  grid[ p.y ][ p.x ] = 0;
  game.score += v === 4 ? 50 : 10;
  game.dotsRemaining--;
}
```

`src/js/render.js` — `drawDots` pasa a recibir `frame` (y `draw` se lo pasa):

```js
// valor 4: radio 6; oculto la mitad de cada ciclo de 30 frames.
if ( grid[ y ][ x ] === 4 ) {
  if ( Math.floor( frame / 15 ) % 2 === 1 ) continue; // fase oculta del parpadeo
  // círculo radio 6, mismo DOT_COLOR
}
```

## Plan de implementación

1. En `src/js/maze.js`, sustituir los 4 `.` por `o` (filas 3 y 23, cols 1 y 26) y añadir el caso en `parseTile`. Verificación manual: el juego carga con la consola limpia; nada cambia visible aún (nadie lee el valor 4) y la partida sigue ganable con los dots normales.
2. En `src/js/render.js`, pasar `frame` a `drawDots` y dibujar el valor 4 como círculo radio 6 con parpadeo. Verificación: 4 círculos grandes parpadeantes en las esquinas, estables al reiniciar; aún no se dejan comer (estado intermedio aceptado, se cierra en el paso 3).
3. En `src/js/game.js`, contar `v === 4` en `createGame` y unificar la comida de dots/pellets en `movePacman` (10/50 puntos). Verificación: comer un pellet lo desaparece y suma exactamente 50; la victoria exige comer también los 4 pellets.
4. Verificación final de todos los criterios de aceptación, jugando partidas completas con la consola abierta.

## Criterios de aceptación

- [ ] Desde el primer frame se ven 4 power pellets (círculos ~6 px, color de dot) en (1,3), (26,3), (1,23) y (26,23), parpadeando.
- [ ] Los dots normales se dibujan igual que antes (radio 2.5, sin parpadeo).
- [ ] Comer un power pellet lo hace desaparecer y suma exactamente 50 puntos.
- [ ] Comer un dot normal sigue sumando exactamente 10 puntos.
- [ ] La victoria solo llega tras comer todos los dots y los 4 power pellets.
- [ ] Perder una vida no restaura los pellets ya comidos y la partida sigue siendo ganable.
- [ ] Reiniciar tras ganar o perder repone los 4 pellets en su sitio.
- [ ] Ganar, perder 3 vidas y reiniciar siguen funcionando, con overlays correctos y consola sin errores.

## Decisiones

- **Sí:** solo aparición + 50 puntos en este spec. Petición del usuario; el modo asustado va en su propio spec, manteniendo el tamaño de SPEC 01/02.
- **Sí:** posiciones clásicas del arcade (1,3), (26,3), (1,23), (26,23). Petición del usuario; hoy son dots normales y la sustitución no rompe la simetría.
- **Sí:** carácter `o` → valor 4 en la propia `MAZE`. Única fuente de verdad; el restablecimiento al reiniciar sale gratis vía `createGame`.
- **Sí:** los pellets cuentan en `dotsRemaining`. En el arcade son parte de los dots; sin ello se ganaría sin comerlos.
- **Sí:** círculo radio 6 con parpadeo de 15 frames usando `frame`. Fiel al arcade; `frame` ya llega a `draw()` para la boca de Pac-Man.
- **Sí:** mismo `DOT_COLOR` que los dots. En el arcade el pellet solo se distingue por tamaño y parpadeo.
- **No:** modo asustado. Explícitamente diferido: afecta estados de fantasma, timers, multiplicadores y regreso a la guarida.
- **No:** lista `POWER_PELLET_POS` aparte. Duplicaría la fuente de verdad de la posición.
- **No:** pellet fijo sin parpadeo. El parpadeo cuesta una condición sobre `frame`.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `requestAnimationFrame` no es paso fijo: el parpadeo (como todo el juego) corre al doble de ritmo en pantallas ~120 Hz. | Preexistente y aceptado desde SPEC 01; el paso fijo sigue fuera de alcance. |
| El paso 2 deja pellets visibles pero no comibles (estado intermedio). | Dura un solo paso; la partida sigue siendo ganable con los dots normales y el paso 3 cierra el ciclo. |

## Qué **no** entra en este spec

- Modo asustado: fantasmas azules, comestibles, puntuación 200/400/800/1600, regreso a la guarida.
- Cambios de IA, fases scatter/chase, velocidades, colores de fantasmas.
- Sonidos, niveles múltiples, paso fijo del bucle.

Cada uno de esos puntos, si llega, va en su propio spec.
