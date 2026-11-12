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

// **GEÄNDERT:** Der Zeiger ist jetzt etwas länger
var second_hand = {
  width : 115, height : 2, bpp : 1,
  transparent : 0,
  buffer : E.toArrayBuffer(atob("/////////////////////////////////////////////////////////////////////////w=="))
};

let intervalRef = null;
const p180 = Math.PI/180;
const clock_center = {x:Math.floor((g.getWidth()-1)/2), y:24+Math.floor((g.getHeight()-25)/2)};
const radius = Math.floor((g.getWidth()-24+1)/2);

// **GEÄNDERT:** Die 12/3/6/9-Uhr Striche sind dicker, aber genauso lang
let tick0 = Graphics.createArrayBuffer(20,8,1,{msb:true});
tick0.fillRect(0,0,tick0.getWidth()-1, tick0.getHeight()-1);
let tick5 = Graphics.createArrayBuffer(20,6,1,{msb:true});
tick5.fillRect(0,0,tick5.getWidth()-1, tick5.getHeight()-1);
let tick1 = Graphics.createArrayBuffer(8,4,1,{msb:true});
tick1.fillRect(0,0,tick1.getWidth()-1, tick1.getHeight()-1);

minute_hand.width=radius-tick1.getWidth()-6;
hour_hand.width=radius-tick5.getWidth()-6;
// **GEÄNDERT:** Die Länge des Sekundenzeigers wurde angepasst
second_hand.width = radius - 15; 

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
function second_pos_x(angle) {
  return clock_center.x + Math.cos(angle * p180) * second_hand.width / 2;
}
function second_pos_y(angle) {
  return clock_center.y + Math.sin(angle * p180) * second_hand.width / 2;
}
function second_disk_x(angle) {
  return clock_center.x + Math.cos(angle * p180) * (radius - 15);
}
function second_disk_y(angle) {
  return clock_center.y + Math.sin(angle * p180) * (radius - 15);
}

function minute_angle(date){
  let minutes = date.getMinutes();
  return 6*minutes - 90;
}
function hour_angle(date){
  let hours= date.getHours() + date.getMinutes()/60;
  return 30*hours - 90;
}
function second_angle(date) {
  let seconds = date.getSeconds();
  return 6 * seconds - 90;
}

function draw_date(date) {
  const text = date.getDate() + "." + (date.getMonth() + 1);
  const size = Math.max(14, Math.round(radius * 0.17));
  const x = clock_center.x + radius - tick5.getWidth() - 4;
  g.setFont("Vector", size);
  g.setFontAlign(1, 0);
  const width = g.stringWidth(text);
  const top = clock_center.y - Math.ceil(size / 2) - 1;
  const bottom = clock_center.y + Math.floor(size / 2) + 1;
  g.setColor(g.theme.bg);
  g.fillRect(x - width - 2, top, x + 1, bottom);
  g.setColor(g.theme.fg);
  g.drawString(text, x, clock_center.y);
}

function draw_clock(){
  let date = new Date();
  g.reset();
  g.clearRect(0,24,239,239);

  g.setColor(g.theme.fg);
  let ticks = [0, 90, 180, 270];
  ticks.forEach((item)=>{
    let agl = item+180;
    // **GEÄNDERT:** Größere Striche werden jetzt mit 'tick5' gezeichnet
    // Statt tick0, um die Länge anzugleichen.
    g.drawImage(tick5.asImage(), rotate_around_x(big_wheel_x(item), agl, tick5), rotate_around_y(big_wheel_y(item), agl, tick5), {rotate:agl*p180});
  });
  ticks = [30, 60, 120, 150, 210, 240, 300, 330];
  ticks.forEach((item)=>{
    let agl = item+180;
    g.drawImage(tick5.asImage(), rotate_around_x(big_wheel_x(item), agl, tick5), rotate_around_y(big_wheel_y(item), agl, tick5), {rotate:agl*p180});
  });

  let hour_agl = hour_angle(date);
  let minute_agl = minute_angle(date);
  let second_agl = second_angle(date);

  g.drawImage(hour_hand, hour_pos_x(hour_agl), hour_pos_y(hour_agl), {rotate:hour_agl*p180});
  g.drawImage(minute_hand, minute_pos_x(minute_agl), minute_pos_y(minute_agl), {rotate:minute_agl*p180});

  // **GEÄNDERT:** Reihenfolge der Zeichnung für den Sekundenzeiger
  g.setColor(1, 0, 0); // Rot für die Scheibe
  g.fillCircle(second_disk_x(second_agl), second_disk_y(second_agl), 5); 

  g.setColor(1, 0, 0); // Schwarz für den Zeiger
  g.drawImage(second_hand, second_pos_x(second_agl), second_pos_y(second_agl), {rotate:second_agl*p180});


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
    clearInterval(intervalRef);
    intervalRef = null;
  }
}
function startTimers(){
  if(intervalRef) clearTimers();
  intervalRef = setInterval(draw_clock, 1000);
  draw_clock();
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