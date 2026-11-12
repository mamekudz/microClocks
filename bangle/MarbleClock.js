

// Globale Konstanten und Variablen... (alles aus deinem Code unverändert)
const BORDER = 5;
const MARBLE_SIZE = 5;
const FRICTION = 0.98;
const COLLISION_DAMPING = 0.8;
const ATTRACTION_FORCE = 0.05;
const REJECTION_FORCE = 0.1;
var marbleSprite=atob("CAgDHjgAuPAg/8VAHHqkgqlVAUqkgh0qAEAg");
const DIGITS_MATRIX = {
  0: [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  1: [[0,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
  2: [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
  3: [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
  4: [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
  5: [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
  6: [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
  7: [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
  8: [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
  9: [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
};

const POSITIONS = {
  h1: {x: 20, y: 30},
  h2: {x: 50, y: 30},
  colon: {x: 80, y: 30},
  m1: {x: 100, y: 30},
  m2: {x: 130, y: 30}
};

let marbles = [];
let letzteZeit = "";
let animationIntervalId;
let clockIntervalId;

function CreateMarbles() {
  for (let i = 0; i <10; i++) {
    marbles.push({
      x: Math.random() * g.getWidth(),
      y: Math.random() * g.getHeight(),
      vx: 0,
      vy: 0,
      id: i
    });
  }
}
let ziel_positionen = [];

let lastHoursString = "";
let lastMinutesString = "";

function UpdateClock(){
  const now = new Date();
  const stunde = now.getHours();
  const minute = now.getMinutes();
  const hoursString = ("0" + stunde).slice(-2);
  const minutesString = ("0" + minute).slice(-2);
  if(lastHoursString != hoursString || lastMinutesString != minutesString){
	lastHoursString = hoursString;
	lastMinutesString = minutesString;
  }
}
  
function Init(){
  const now = new Date();
  const stunde = now.getHours();
  const minute = now.getMinutes();
  const hoursString = ("0" + stunde).slice(-2);
  const minutesString = ("0" + minute).slice(-2);
  const aktuelleZeit = hoursString + minutesString;  
  const h1_matrix = DIGITS_MATRIX[hoursString[0]];
  const h2_matrix = DIGITS_MATRIX[hoursString[1]];
  const m1_matrix = DIGITS_MATRIX[minutesString[0]];
  const m2_matrix = DIGITS_MATRIX[minutesString[1]];
  
   function getZiele(matrix, startX, startY) {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (matrix[r][c] === 1) {
          ziel_positionen.push({
            x: startX + c * (MARBLE_SIZE + BORDER),
            y: startY + r * (MARBLE_SIZE + BORDER)
          });
        }
      }
    }
  }

  getZiele(h1_matrix, POSITIONS.h1.x, POSITIONS.h1.y);
  getZiele(h2_matrix, POSITIONS.h2.x, POSITIONS.h2.y);
  getZiele(m1_matrix, POSITIONS.m1.x, POSITIONS.m1.y);
  getZiele(m2_matrix, POSITIONS.m2.x, POSITIONS.m2.y);
  
  let naechstesZiel = null;
    let minAbstand2 = Infinity;
   for (let i = 0; i < marbles.length; i++) {
    const marble = marbles[i];
    for (let j = 0; j < ziel_positionen.length; j++) {
      const ziel = ziel_positionen[j];
      const dx = ziel.x - marble.x;
      const dy = ziel.y - marble.y;
      const abstand2 = dx*dx + dy*dy;
      
      if (abstand2 < minAbstand2) {
        minAbstand2 = abstand2;
        naechstesZiel = ziel;
      }
    }
    
    if (naechstesZiel) {
      const dx = naechstesZiel.x - marble.x;
      const dy = naechstesZiel.y - marble.y;
      marble.vx += dx * ATTRACTION_FORCE;
      marble.vy += dy * ATTRACTION_FORCE;
    }
   
}
  
}

function UpdatePhysics() {

  for (let i = 0; i < marbles.length; i++) {
    const marble = marbles[i];
    
    
    const acc = Bangle.getAccel();
    marble.vx += acc.x * 0.1;
    marble.vy += acc.y * 0.1;

    marble.vx += acc.x * -0.2;
    marble.vy += acc.y * -0.2;
    
    marble.vx *= FRICTION;
    marble.vy *= FRICTION;

    /*
    for (let j = i + 1; j < marbles.length; j++) {
      const anderemarble = marbles[j];
      const dx = anderemarble.x - marble.x;
      const dy = anderemarble.y - marble.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minDist = marble.r + anderemarble.r;

      if (dist < minDist && dist > 0) {
        const force = (minDist - dist) * COLLISION_DAMPING;
        const nx = dx / dist;
        const ny = dy / dist;
        marble.vx -= nx * force;
        marble.vy -= ny * force;
        anderemarble.vx += nx * force;
        anderemarble.vy += ny * force;
      }
    }
    */
    
    marble.x += marble.vx;
    marble.y += marble.vy;
    
    if (marble.x < marble.r) { marble.x = marble.r; marble.vx *= -1; }
    if (marble.x > g.getWidth() - marble.r) { marble.x = g.getWidth() - marble.r; marble.vx *= -1; }
    if (marble.y < marble.r) { marble.y = marble.r; marble.vy *= -1; }
    if (marble.y > g.getHeight() - marble.r) { marble.y = g.getHeight() - marble.r; marble.vy *= -1; }
  }
}

function DrawClock() {
  g.clear();
  for (let i = 0; i < marbles.length; i++) {
    const marble = marbles[i];
    g.drawImage(marbleSprite, marble.x - marble.r, marble.y - marble.r);
  }
 // g.fillCircle(POSITIONS.colon.x, POSITIONS.colon.y, MARBLE_SIZE/2);
 // g.fillCircle(POSITIONS.colon.x, POSITIONS.colon.y + 30, MARBLE_SIZE/2);
  g.flip();
}

// Bangle.js spezifische Logik
// `Bangle.on('lcdPower', on => { ... })` ist entscheidend. Es reagiert, wenn das Display ein- oder ausgeschaltet wird.
// Wir müssen den Timer starten, wenn das Display an ist, und stoppen, wenn es aus ist, um Strom zu sparen.
Bangle.on('lcdPower', on => {
  if (on) {
    DrawClock();
    animationIntervalId = setInterval(function() {
      UpdatePhysics();
      DrawClock();
    }, 50);
  } else {
    clearInterval(animationIntervalId); // Stoppe den Timer, wenn das Display aus ist
  }
});

// `Bangle.setLCDTimeout(0)` verhindert den Deep Sleep
Bangle.setLCDTimeout(0);

// `Bangle.setUI()` stellt die Benutzeroberfläche so ein, dass der Watchface-Modus aktiv bleibt
Bangle.setUI({
  mode: 'custom',
  back: () => load()
});

// Init
g.setBgColor(0);
CreateMarbles();
Bangle.setLCDPower(1);
Init();

clockIntervalId = setInterval(function() {
  UpdateClock();
}, 1000);

DrawClock();
animationIntervalId = setInterval(function() {
  UpdatePhysics();
  DrawClock();
}, 50);