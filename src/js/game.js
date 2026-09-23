// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Salida al iniciar la partida: intervalos de 2.5 s = 150 frames a 60 fps.
const EXIT_DELAY_FRAMES_START = { blinky: 0, pinky: 150, inky: 300, clyde: 450 };
// Salida tras perder una vida: valores de SPEC 01, sin cambio.
const EXIT_DELAY_FRAMES_RESPAWN = { blinky: 0, pinky: 120, inky: 360, clyde: 540 };

// Fases globales scatter/chase, en frames (4 ciclos, luego chase permanente).
const SCATTER_FRAMES = 420;
const CHASE_FRAMES = 1200;
const MAX_CYCLES = 4;

// Modo asustado (power pellets), nivel 1 del arcade.
const FRIGHTENED_FRAMES = 360;       // 6 s a 60 fps
const FRIGHTENED_FLASH_FRAMES = 120; // ultimos ~2 s: parpadeo azul/blanco
const FRIGHTENED_SPEED = 0.05;       // mitad de GHOST_SPEED
const EYES_SPEED = 0.2;              // doble de GHOST_SPEED
const GHOST_POINTS = [ 200, 400, 800, 1600 ];

// Geometria fija de la ruta de salida (espeja GHOST_STARTS en maze.js).
const PEN_CENTER = { x: 13, y: 14 }; // centro de la guarida: alineacion previa
const PEN_EXIT = { x: 13, y: 11 };   // sobre la puerta: final de la salida

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  // Dots y power pellets cuentan para la victoria.
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'left',
      speed: GHOST_SPEED,
      kind: g.kind,
      scatter: g.scatter,
      mode: 'pen',        // 'pen' | 'exit' | 'active' | 'eaten'
      exitDelayFrames: EXIT_DELAY_FRAMES_START[ g.kind ],
      frightened: false,  // true mientras dura el modo asustado sin ser comido
    } ) ),
    mode: { phase: 'scatter', timerFrames: SCATTER_FRAMES, cycle: 0 },
    frightened: null,     // modo asustado activo: { framesLeft, chain }
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro?
//   pared (1): siempre.
//   puerta (3): muro para todos los que deciden con canMove (Pac-Man,
//   paseos y activos). Solo la cruzan la ruta guionizada de salida (modo
//   'exit', que no consulta canMove) y los ojos (modo 'eaten', con
//   allowDoor).
function isWall( grid, x, y, allowDoor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return !allowDoor;
  return false;
}

// Puede avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, allowDoor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, allowDoor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot (10) o power pellet (50). El pellet activa el modo asustado.
    const v = grid[ p.y ][ p.x ];
    if ( v === 2 || v === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += v === 4 ? 50 : 10;
      game.dotsRemaining--;
      if ( v === 4 ) startFrightened( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Direccion preferida a igual distancia: up > left > down > right (arcade).
const DIR_PRIORITY = [ 'up', 'left', 'down', 'right' ];

// Celda objetivo del fantasma: su esquina en scatter, su personalidad en chase.
// Los objetivos son celdas de navegacion, pueden quedar fuera del laberinto.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( game.mode.phase === 'scatter' ) return g.scatter;

  if ( g.kind === 'blinky' ) {
    // Agresivo: la celda de Pac-Man.
    return { x: px, y: py };
  }

  if ( g.kind === 'pinky' ) {
    // Emboscada: 4 celdas delante de Pac-Man segun su direccion actual
    // (sin replicar el bug del arcade original con la direccion up).
    const d = DIRS[ p.dir ];
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }

  if ( g.kind === 'inky' ) {
    // Flanqueo: pivote = 2 celdas delante de Pac-Man;
    // objetivo = 2*pivote - posicion de blinky.
    const d = DIRS[ p.dir ];
    const b = game.ghosts.find( ( gh ) => gh.kind === 'blinky' );
    return {
      x: 2 * ( px + d.x * 2 ) - Math.round( b.x ),
      y: 2 * ( py + d.y * 2 ) - Math.round( b.y ),
    };
  }

  // clyde, timido: persigue de lejos (> 8 celdas); de cerca, su esquina.
  const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
  return dist > 8 ? { x: px, y: py } : g.scatter;
}

// IA por celda objetivo: en cada celda alineada, la direccion transitable
// (sin invertir) que minimiza la distancia Manhattan al objetivo. A igual
// distancia gana up > left > down > right. En callejon sin salida, giro de 180.
// Los ojos (eaten) apuntan siempre al centro de la guarida y cruzan la puerta.
function decideGhost( game, g ) {
  const grid = game.grid;
  const eaten = g.mode === 'eaten';
  const target = eaten ? PEN_CENTER : ghostTarget( game, g );

  const options = DIR_PRIORITY.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, eaten )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( g.x + d.x - target.x ) + Math.abs( g.y + d.y - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;
  const eaten = g.mode === 'eaten';

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // Ojos en el centro de la guarida: revivir y salir de nuevo por exit.
    if ( eaten && g.x === PEN_CENTER.x && g.y === PEN_CENTER.y ) {
      g.mode = 'exit';
      g.speed = GHOST_SPEED;
      return;
    }
    // Asustado: paseo aleatorio uniforme (patron de la guarida) en vez de
    // la IA por celda objetivo; reversiones permitidas.
    if ( g.frightened ) g.dir = randomDir( grid, g );
    else decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, eaten ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

// Direccion aleatoria uniforme entre las transitables desde la celda de g
// (reversiones incluidas). Patron compartido por el paseo de la guarida
// y el deambular asustado por el laberinto.
function randomDir( grid, g ) {
  const options = Object.keys( DIRS ).filter(
    ( dir ) => canMove( grid, g.x, g.y, dir )
  );
  return options[ Math.floor( Math.random() * options.length ) ];
}

// pen: paseo aleatorio por el interior de la guarida. En cada celda alineada
// elige una direccion aleatoria uniforme entre las transitables por canMove
// (la puerta cuenta como muro: nadie sale antes de su delay).
function wanderPen( game, g ) {
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    g.dir = randomDir( game.grid, g );
  }
  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

// Un paso de g.speed hacia (tx,ty) por el eje dominante, encajando al llegar
// para evitar derivas de coma flotante. true si ya esta en el destino.
function stepToward( g, tx, ty ) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  if ( Math.abs( dx ) < 1e-3 && Math.abs( dy ) < 1e-3 ) {
    g.x = tx;
    g.y = ty;
    return true;
  }
  if ( Math.abs( dx ) > Math.abs( dy ) ) {
    g.x += Math.sign( dx ) * g.speed;
    g.dir = dx > 0 ? 'right' : 'left';
    if ( Math.abs( tx - g.x ) < 1e-3 ) g.x = tx;
  } else {
    g.y += Math.sign( dy ) * g.speed;
    g.dir = dy > 0 ? 'down' : 'up';
    if ( Math.abs( ty - g.y ) < 1e-3 ) g.y = ty;
  }
  return false;
}

// exit: ruta guionizada. Alinearse en la columna 13, subir hasta el centro
// (fila 14) si se encuentra por debajo, y luego recto hasta (13,11).
function exitGhost( g ) {
  if ( Math.abs( g.x - PEN_CENTER.x ) > 1e-3 ) {
    stepToward( g, PEN_CENTER.x, g.y );
    return;
  }
  g.x = PEN_CENTER.x;
  if ( g.y > PEN_CENTER.y + 1e-3 ) {
    stepToward( g, PEN_CENTER.x, PEN_CENTER.y );
    return;
  }
  if ( stepToward( g, PEN_EXIT.x, PEN_EXIT.y ) ) {
    g.mode = 'active';
    g.dir = 'left';
    // Sale a velocidad asustada si el modo sigue activo; normal en el resto.
    g.speed = g.frightened ? FRIGHTENED_SPEED : GHOST_SPEED;
  }
}

// Maquina de estados por fantasma: pen -> exit -> active -> eaten -> exit
// (los ojos reviven en la guarida y re-salen). 'active' y 'eaten' comparten
// moveGhost; la decision de direccion difiere dentro.
function updateGhost( game, g ) {
  if ( g.mode === 'pen' ) {
    if ( g.exitDelayFrames > 0 ) {
      g.exitDelayFrames--;
      wanderPen( game, g );
    } else {
      g.mode = 'exit';
    }
    return;
  }
  if ( g.mode === 'exit' ) {
    exitGhost( g );
    return;
  }
  moveGhost( game, g );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'left';
    g.mode = 'pen';
    g.frightened = false;
    g.speed = GHOST_SPEED;
    g.exitDelayFrames = EXIT_DELAY_FRAMES_RESPAWN[ GHOST_STARTS[ i ].kind ];
  } );
  game.mode = { phase: 'scatter', timerFrames: SCATTER_FRAMES, cycle: 0 };
  game.frightened = null; // perder la vida limpia el modo asustado
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Temporizador global de fases: scatter 420 / chase 1200 frames, 4 ciclos
// y a partir de ahi chase permanente.
function updateMode( game ) {
  const m = game.mode;
  m.timerFrames--;
  if ( m.timerFrames > 0 ) return;
  if ( m.phase === 'scatter' ) {
    m.phase = 'chase';
    m.timerFrames = CHASE_FRAMES;
  } else {
    m.cycle++;
    if ( m.cycle >= MAX_CYCLES ) {
      m.timerFrames = Infinity; // tras 4 ciclos: chase permanente
    } else {
      m.phase = 'scatter';
      m.timerFrames = SCATTER_FRAMES;
    }
  }
}

// Activar el modo asustado: timer y cadena globales nuevos (un segundo
// pellet reinicia ambos) y flag por fantasma. Los activos invierten su
// direccion al instante y pasan a velocidad asustada; pen/exit solo se
// marcan (la velocidad se decide al terminar su salida).
function startFrightened( game ) {
  game.frightened = { framesLeft: FRIGHTENED_FRAMES, chain: 0 };
  for ( const g of game.ghosts ) {
    if ( g.mode === 'eaten' ) continue; // los ojos no se re-asustan
    g.frightened = true;
    if ( g.mode === 'active' ) {
      g.dir = OPPOSITE[ g.dir ];
      g.speed = FRIGHTENED_SPEED;
    }
  }
}

// Temporizador global del modo asustado. Al expirar se apaga el flag de
// todos y la velocidad vuelve a GHOST_SPEED solo en los activos (los ojos
// conservan EYES_SPEED hasta revivir en la guarida).
function updateFrightened( game ) {
  game.frightened.framesLeft--;
  if ( game.frightened.framesLeft > 0 ) return;
  game.frightened = null;
  for ( const g of game.ghosts ) {
    g.frightened = false;
    if ( g.mode === 'active' ) g.speed = GHOST_SPEED;
  }
}

// Comer un fantasma asustado: puntos de la cadena (200/400/800/1600),
// modo eaten (ojos) y vuelta a la guarida. El snap a la celda mas cercana
// es necesario: con EYES_SPEED 0.2 un desfase de 0.05 nunca vuelve a
// alinear y los ojos se perderian atravesando paredes.
function eatGhost( game, g ) {
  const f = game.frightened;
  game.score += GHOST_POINTS[ f.chain ];
  f.chain = Math.min( f.chain + 1, GHOST_POINTS.length - 1 );
  g.frightened = false;
  g.mode = 'eaten';
  g.speed = EYES_SPEED;
  // El salto (<= media celda) coincide con la desaparicion del cuerpo.
  g.x = Math.round( g.x );
  g.y = Math.round( g.y );
  wrapTunnel( g, game.grid[ 0 ].length );
}

function update( game ) {
  // Durante el modo asustado las fases scatter/chase quedan en pausa.
  if ( game.frightened ) updateFrightened( game );
  else updateMode( game );
  movePacman( game );
  game.ghosts.forEach( ( g ) => updateGhost( game, g ) );

  // Colisiones: primero la comida (un asustado se come y no mata), luego
  // la muerte. Los ojos (eaten) no colisionan nunca.
  for ( const g of game.ghosts ) {
    if ( g.frightened && collides( game.pacman, g ) ) eatGhost( game, g );
  }
  for ( const g of game.ghosts ) {
    if ( g.frightened || g.mode === 'eaten' ) continue;
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
