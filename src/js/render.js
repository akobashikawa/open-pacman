// render.js
// Dibujo arcade sobre canvas. Usa game.grid (no MAZE) para reflejar dots comidos.

const TILE = 20;
const WALL_COLOR = '#2121ff';
const DOOR_COLOR = '#ffb8ff';
const DOT_COLOR = '#ffb897';

function cellCenter( x, y ) {
  return { cx: x * TILE + TILE / 2, cy: y * TILE + TILE / 2 };
}

// Paredes estilo arcade: lineas finas redondeadas que conectan los centros
// de celdas-pared adyacentes. Produce el trazado continuo del original.
function drawWalls( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 1 ) continue;
      const { cx, cy } = cellCenter( x, y );
      // Conectar solo hacia derecha y abajo evita trazos duplicados.
      if ( x + 1 < W && grid[ y ][ x + 1 ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx + TILE, cy );
      }
      if ( y + 1 < H && grid[ y + 1 ][ x ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx, cy + TILE );
      }
      // Celda-pared aislada (sin vecino): punto corto para que se vea.
      const lone =
        ( x + 1 >= W || grid[ y ][ x + 1 ] !== 1 ) &&
        ( x - 1 < 0 || grid[ y ][ x - 1 ] !== 1 ) &&
        ( y + 1 >= H || grid[ y + 1 ][ x ] !== 1 ) &&
        ( y - 1 < 0 || grid[ y - 1 ][ x ] !== 1 );
      if ( lone ) {
        ctx.moveTo( cx - 3, cy );
        ctx.lineTo( cx + 3, cy );
      }
    }
  }
  ctx.stroke();
}

function drawDoor( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = DOOR_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 3 ) continue;
      const px = x * TILE;
      const py = y * TILE + TILE / 2;
      ctx.moveTo( px, py );
      ctx.lineTo( px + TILE, py );
    }
  }
  ctx.stroke();
}

// Dots (2): circulito fijo. Power pellets (4): radio 6 y parpadeo lento,
// ocultos la mitad de cada ciclo de 30 frames (~0.25 s a 60 fps).
function drawDots( ctx, grid, frame ) {
  ctx.fillStyle = DOT_COLOR;
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      const v = grid[ y ][ x ];
      if ( v === 4 ) {
        if ( Math.floor( frame / 15 ) % 2 === 1 ) continue; // fase oculta
        const { cx, cy } = cellCenter( x, y );
        ctx.beginPath();
        ctx.arc( cx, cy, 6, 0, Math.PI * 2 );
        ctx.fill();
        continue;
      }
      if ( v !== 2 ) continue;
      const { cx, cy } = cellCenter( x, y );
      ctx.beginPath();
      ctx.arc( cx, cy, 2.5, 0, Math.PI * 2 );
      ctx.fill();
    }
  }
}

function drawPacman( ctx, p, frame ) {
  const { cx, cy } = cellCenter( p.x, p.y );
  let rot = 0;
  if ( p.dir === 'right' ) rot = 0;
  else if ( p.dir === 'down' ) rot = Math.PI / 2;
  else if ( p.dir === 'left' ) rot = Math.PI;
  else if ( p.dir === 'up' ) rot = -Math.PI / 2;

  // Boca animada: abre/cierra con el frame.
  const open = ( Math.sin( frame * 0.3 ) * 0.5 + 0.5 ) * 0.28 + 0.02;

  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo( cx, cy );
  ctx.arc( cx, cy, TILE / 2 - 1, rot + open * Math.PI, rot - open * Math.PI );
  ctx.closePath();
  ctx.fill();
}

// Ojos blancos con pupila mirando segun la direccion de g.
function drawEyes( ctx, g ) {
  const { cx, cy } = cellCenter( g.x, g.y );
  const dir = DIRS[ g.dir ] || { x: 0, y: 0 };
  const ex = dir.x * 1.6;
  const ey = dir.y * 1.6;
  for ( const off of [ -3.5, 3.5 ] ) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc( cx + off, cy - 1, 3, 0, Math.PI * 2 );
    ctx.fill();
    ctx.fillStyle = '#0000bb';
    ctx.beginPath();
    ctx.arc( cx + off + ex, cy - 1 + ey, 1.5, 0, Math.PI * 2 );
    ctx.fill();
  }
}

// Cara asustada: ojos blancos sin pupila y boca en zigzag.
function drawScaredFace( ctx, g ) {
  const { cx, cy } = cellCenter( g.x, g.y );
  ctx.fillStyle = '#fff';
  for ( const off of [ -3.5, 3.5 ] ) {
    ctx.beginPath();
    ctx.arc( cx + off, cy - 1, 2.5, 0, Math.PI * 2 );
    ctx.fill();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo( cx - 5, cy + 5 );
  ctx.lineTo( cx - 2.5, cy + 3.5 );
  ctx.lineTo( cx, cy + 5 );
  ctx.lineTo( cx + 2.5, cy + 3.5 );
  ctx.lineTo( cx + 5, cy + 5 );
  ctx.stroke();
}

// Cuerpo de fantasma con falda ondulada. scared = true dibuja la cara
// asustada en vez de los ojos direccionales.
function drawGhost( ctx, g, color, scared ) {
  const { cx, cy } = cellCenter( g.x, g.y );
  const r = TILE / 2 - 1;
  const top = cy - r;
  const bottom = cy + r;
  const left = cx - r;
  const right = cx + r;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc( cx, cy - 1, r, Math.PI, 0, false ); // cabeza
  ctx.lineTo( right, bottom );
  // falda ondulada (3 picos)
  ctx.lineTo( right - r * 0.66, bottom - 4 );
  ctx.lineTo( cx, bottom );
  ctx.lineTo( left + r * 0.66, bottom - 4 );
  ctx.lineTo( left, bottom );
  ctx.closePath();
  ctx.fill();

  if ( scared ) drawScaredFace( ctx, g );
  else drawEyes( ctx, g );
}

function drawHUD( ctx, game, W ) {
  ctx.fillStyle = '#fff';
  ctx.font = '14px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText( 'SCORE ' + game.score, 8, 4 );
  ctx.textAlign = 'right';
  ctx.fillText( 'VIDAS ' + game.lives, W * TILE - 8, 4 );
}

const GHOST_COLOR = {
  blinky: '#ff0000',
  pinky:  '#ffb8ff',
  inky:   '#00ffff',
  clyde:  '#ffb852',
};

// Modo asustado: azul arcade (mismo que las paredes) y blanco de aviso.
const FRIGHTENED_COLOR = '#2121ff';
const FRIGHTENED_FLASH_COLOR = '#ffffff';

function draw( ctx, game, frame ) {
  const grid = game.grid;
  const W = grid[ 0 ].length;
  const H = grid.length;

  ctx.fillStyle = '#000';
  ctx.fillRect( 0, 0, W * TILE, H * TILE );

  drawWalls( ctx, grid );
  drawDoor( ctx, grid );
  drawDots( ctx, grid, frame );
  drawPacman( ctx, game.pacman, frame );
  // Estado por fantasma: eaten = solo ojos de regreso; frightened = azul con
  // parpadeo blanco de aviso en los ultimos 120 frames (ritmo de 15, como
  // los pellets; umbral FRIGHTENED_FLASH_FRAMES de game.js); resto normal.
  game.ghosts.forEach( ( g ) => {
    if ( g.mode === 'eaten' ) {
      drawEyes( ctx, g );
      return;
    }
    if ( g.frightened ) {
      const flash =
        game.frightened.framesLeft <= FRIGHTENED_FLASH_FRAMES &&
        Math.floor( frame / 15 ) % 2 === 1;
      drawGhost( ctx, g, flash ? FRIGHTENED_FLASH_COLOR : FRIGHTENED_COLOR, true );
      return;
    }
    drawGhost( ctx, g, GHOST_COLOR[ g.kind ] || '#ff0000', false );
  } );
  drawHUD( ctx, game, W );
}

window.draw = draw;
