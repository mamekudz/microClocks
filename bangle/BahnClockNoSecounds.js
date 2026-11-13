var hour_hand = {
  width : 61, height : 8, bpp : 1,
  transparent : 0,
  buffer : E.toArrayBuffer(atob("/////////////////////////////////////////////////////////////////////////////////w=="))
};
var minute_hand = {
  width : 110, height : 4, bpp : 1,
  transparent : 0,
  buffer : E.toArrayBuffer(atob("/////////////////////////////////////////////////////////////////////////w=="))
};

// Wochentag und Monat in der Sprache, die auf der Uhr eingestellt ist (App "Languages"; ohne sie Englisch).
const locale = require("locale");

let intervalRef = null;
const p180 = Math.PI/180;
const WEEK_SIZE = 16;
const DATE_SIZE = 14;
const YEAR_SIZE = 14;
const clock_center = {x:Math.floor((g.getWidth()-1)/2), y:24+Math.floor((g.getHeight()-25)/2)};
const radius = Math.floor((g.getWidth()-24+1)/2);

let tick0 = Graphics.createArrayBuffer(20,8,1,{msb:true});
tick0.fillRect(0,0,tick0.getWidth()-1, tick0.getHeight()-1);
let tick5 = Graphics.createArrayBuffer(20,6,1,{msb:true});
tick5.fillRect(0,0,tick5.getWidth()-1, tick5.getHeight()-1);
let tick1 = Graphics.createArrayBuffer(8,4,1,{msb:true});
tick1.fillRect(0,0,tick1.getWidth()-1, tick1.getHeight()-1);

minute_hand.width=radius-tick1.getWidth()-6;
hour_hand.width=radius-tick5.getWidth()-6;

function big_wheel_x(angle){
  return clock_center.x + radius * Math.cos(angle*p180);
}
function big_wheel_y(angle){
  return clock_center.y + radius * Math.sin(angle*p180);
}
function rotate_around_x(center_x, angle, tick){
  return center_x + Math.cos(angle*p180) * tick.getWidth()/2;
}
function rotate_around_y(center_y, angle, tick){
  return center_y + Math.sin(angle*p180) * tick.getWidth()/2;
}
function hour_pos_x(angle){
  return clock_center.x + Math.cos(angle*p180) * hour_hand.width/2;
}
function hour_pos_y(angle){
  return clock_center.y + Math.sin(angle*p180) * hour_hand.width/2;
}
function minute_pos_x(angle){
  return clock_center.x + Math.cos(angle*p180) * minute_hand.width/2;
}
function minute_pos_y(angle){
  return clock_center.y + Math.sin(angle*p180) * minute_hand.width/2;
}

function minute_angle(date){
  let minutes = date.getMinutes();
  return 6*minutes - 90;
}
function hour_angle(date){
  let hours= date.getHours() + date.getMinutes()/60;
  return 30*hours - 90;
}

function draw_line(text, size, y, alignY){
  g.setFont("Vector", size);
  g.setFontAlign(0, alignY);
  const half = Math.ceil(g.stringWidth(text) / 2) + 2;
  const top = alignY === 1 ? y - size - 1 : y - 1;
  const bottom = alignY === 1 ? y + 1 : y + size + 1;
  g.setColor(g.theme.bg);
  g.fillRect(clock_center.x - half, top, clock_center.x + half, bottom);
  g.setColor(g.theme.fg);
  g.drawString(text, clock_center.x, y);
}

function draw_date(date){
  const weekday = locale.dow(date);
  const dayMonth = date.getDate() + ". " + locale.month(date);
  const year = "" + date.getFullYear();
  draw_line(weekday, WEEK_SIZE, clock_center.y - 12, 1);
  draw_line(dayMonth, DATE_SIZE, clock_center.y + 12, -1);
  draw_line(year, YEAR_SIZE, clock_center.y + 12 + DATE_SIZE + 3, -1);
}

function draw_clock(){
  let date = new Date();
  g.reset();
  g.clearRect(0,24,g.getWidth()-1,g.getHeight()-1);

  g.setColor(g.theme.fg);
  let ticks = [0, 90, 180, 270];
  ticks.forEach((item)=>{
    let agl = item+180;
    g.drawImage(tick5.asImage(), rotate_around_x(big_wheel_x(item), agl, tick5), rotate_around_y(big_wheel_y(item), agl, tick5), {rotate:agl*p180});
  });
  ticks = [30, 60, 120, 150, 210, 240, 300, 330];
  ticks.forEach((item)=>{
    let agl = item+180;
    g.drawImage(tick5.asImage(), rotate_around_x(big_wheel_x(item), agl, tick5), rotate_around_y(big_wheel_y(item), agl, tick5), {rotate:agl*p180});
  });

  let hour_agl = hour_angle(date);
  let minute_agl = minute_angle(date);

  g.drawImage(hour_hand, hour_pos_x(hour_agl), hour_pos_y(hour_agl), {rotate:hour_agl*p180});
  g.drawImage(minute_hand, minute_pos_x(minute_agl), minute_pos_y(minute_agl), {rotate:minute_agl*p180});

  g.setColor(g.theme.fg);
  g.fillCircle(clock_center.x, clock_center.y, 6);
  g.setColor(g.theme.bg);
  g.fillCircle(clock_center.x, clock_center.y, 3);

  g.setColor(g.theme.fg);
  for (var i=0; i<60; i++){
    let agl = i*6+180;
    g.drawImage(tick1.asImage(), rotate_around_x(big_wheel_x(i*6), agl, tick1), rotate_around_y(big_wheel_y(i*6), agl, tick1), {rotate:agl*p180});
  }

  draw_date(date);
  g.flip();
}
function clearTimers(){
  if(intervalRef) {
    clearTimeout(intervalRef);
    intervalRef = null;
  }
}
function startTimers(){
  if(intervalRef) clearTimers();
  draw_clock();
  const wait = 60000 - (Date.now() % 60000);
  intervalRef = setTimeout(function tick(){
    draw_clock();
    intervalRef = setTimeout(tick, 60000);
  }, wait);
}

Bangle.on('lcdPower', (on) => {
  if (on) {
    Bangle.drawWidgets();
    startTimers();
  } else {
    clearTimers();
  }
});

Bangle.setUI("clock");

g.clear();
Bangle.loadWidgets();
Bangle.drawWidgets();
startTimers();
