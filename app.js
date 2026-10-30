"use strict";

/* Musehome — Eternal's day, walked.
   Data comes from activities.json; if the fetch fails (e.g. opened via
   file://), the identical seed below is used so the page still works. */

const FALLBACK_DATA = {
  date: "2026-10-30",
  dayLabel: "Friday, October 30, 2026",
  timezone: "America/Toronto",
  activities: [
    { time: "05:00", station: "desk",    text: "Ran the schedule audit" },
    { time: "06:48", station: "desk",    text: "Picked today's look — court form" },
    { time: "07:00", station: "desk",    text: "Texted Angie her morning overview" },
    { time: "07:30", station: "desk",    text: "Morning briefing delivered" },
    { time: "07:48", station: "desk",    text: "Recorded the Hearing Day drive-time episode" },
    { time: "08:30", station: "door",    text: "Out — bail hearing (Crown, Hearing #1)" },
    { time: "09:00", station: "wall",    text: "Reminded him to move the car" },
    { time: "10:45", station: "kitchen", text: "He's home early — Torts let out" },
    { time: "12:32", station: "door",    text: "Lemon cookie mission at YQT" },
    { time: "13:30", station: "window",  text: "Watching PD2634 to Toronto" },
    { time: "18:14", station: "window",  text: "Landed Ottawa — family time" },
    { time: "21:00", station: "desk",    text: "Checking the Con Law briefs are all filed" }
  ]
};

/* Floor spots (percent of room) where he stands for each station,
   plus the label used in the bubble/log. */
const STATIONS = {
  bed:     { x: 13, y: 34, name: "Hammock" },
  library: { x: 35, y: 30, name: "Library" },
  desk:    { x: 62, y: 30, name: "Desk" },
  wall:    { x: 88, y: 36, name: "Wall Screen" },
  server:  { x: 13, y: 62, name: "Server Rack" },
  kitchen: { x: 14, y: 76, name: "Kitchen Nook" },
  door:    { x: 50, y: 78, name: "Door" },
  window:  { x: 87, y: 74, name: "Window" }
};
const CENTER = { x: 50, y: 52 };
const WALK_SPEED = 60; /* percent-of-room per second */

const $ = (id) => document.getElementById(id);
const roomEl = $("room");
const charEl = $("character");
const bubbleEl = $("bubble");
const clockEl = $("clock");
const clockStateEl = $("clock-state");
const logEl = $("log");
const nowTextEl = $("now-text");

let activities = [];        /* [{minutes, time, station, text}] sorted */
let simMinutes = 0;         /* simulated time of day, 0..1439 */
let playing = false;
let speed = 10;             /* sim-minutes per real second */
let charPos = { x: STATIONS.bed.x, y: STATIONS.bed.y };
let charStation = "bed";
let currentIdx = -2;        /* index into activities, -1 = before first */
let walkToken = 0;

function toMinutes(hhmm) {
  const parts = hhmm.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}
function fmt(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

/* What he is doing at a given simulated minute. */
function sceneAt(mins) {
  if (mins >= 23 * 60) {
    return { idx: activities.length, station: "bed", text: "Recharging — tomorrow, whatever it brings" };
  }
  let idx = -1;
  for (let i = 0; i < activities.length; i++) {
    if (activities[i].minutes <= mins) idx = i; else break;
  }
  if (idx === -1) {
    return { idx: -1, station: "bed", text: "Asleep — recharging for a big day" };
  }
  const a = activities[idx];
  return { idx: idx, station: a.station, text: a.text };
}

function placeCharacter() {
  charEl.style.left = charPos.x + "%";
  charEl.style.top = charPos.y + "%";
}

/* Walk along [start, (centre), target]; token cancels stale walks. */
function walkTo(target, onArrive) {
  const token = ++walkToken;
  const start = { x: charPos.x, y: charPos.y };
  const dist = Math.hypot(target.x - start.x, target.y - start.y);
  if (dist < 0.5) { if (onArrive) onArrive(); return; }
  const path = dist > 26 ? [start, { x: CENTER.x, y: CENTER.y }, target] : [start, target];
  charEl.classList.add("walking");
  let seg = 0;
  let last = performance.now();
  function step(now) {
    if (token !== walkToken) return; /* superseded */
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let budget = WALK_SPEED * dt;
    while (budget > 0 && seg < path.length - 1) {
      const a = path[seg], b = path[seg + 1];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < 0.001) { seg++; continue; }
      const px = charPos.x - a.x, py = charPos.y - a.y;
      const done = Math.hypot(px, py);
      const remain = d - done;
      if (remain <= budget) {
        charPos = { x: b.x, y: b.y };
        budget -= remain;
        seg++;
      } else {
        const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
        charPos = { x: charPos.x + ux * budget, y: charPos.y + uy * budget };
        budget = 0;
      }
    }
    placeCharacter();
    if (seg >= path.length - 1) {
      charEl.classList.remove("walking");
      if (onArrive) onArrive();
      return;
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function setScene(mins, animate) {
  const scene = sceneAt(mins);
  const st = STATIONS[scene.station] || STATIONS.desk;
  const changedStation = scene.station !== charStation;
  currentIdx = scene.idx;
  charStation = scene.station;

  document.querySelectorAll(".station").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-station") === scene.station);
  });
  nowTextEl.textContent = scene.text + "  ·  " + st.name;
  updateLog();

  if (!animate) {
    walkToken++;
    charEl.classList.remove("walking");
    charPos = { x: st.x, y: st.y };
    placeCharacter();
    bubbleEl.textContent = scene.text;
    return;
  }
  if (changedStation) {
    bubbleEl.textContent = "Off to the " + st.name + "…";
    walkTo({ x: st.x, y: st.y }, () => { bubbleEl.textContent = scene.text; });
  } else {
    bubbleEl.textContent = scene.text;
  }
}

function updateLog() {
  const rows = logEl.children;
  for (let i = 0; i < rows.length; i++) {
    rows[i].classList.toggle("done", i < currentIdx);
    rows[i].classList.toggle("current", i === currentIdx);
  }
}

function buildLog() {
  logEl.innerHTML = "";
  activities.forEach((a, i) => {
    const li = document.createElement("li");
    const lt = document.createElement("span");
    lt.className = "lt";
    lt.textContent = a.time;
    const lx = document.createElement("span");
    lx.className = "lx";
    lx.textContent = a.text;
    const lst = document.createElement("span");
    lst.className = "lst";
    lst.textContent = (STATIONS[a.station] || {}).name || a.station;
    lx.appendChild(lst);
    li.appendChild(lt);
    li.appendChild(lx);
    li.addEventListener("click", () => {
      playing = false;
      $("btn-play").textContent = "▶ Play the day";
      clockStateEl.textContent = "paused";
      simMinutes = a.minutes;
      setScene(simMinutes, true);
      renderClock();
    });
    logEl.appendChild(li);
  });
}

function renderClock() {
  clockEl.textContent = fmt(simMinutes);
}

function torontoNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", hour12: false, hour: "2-digit", minute: "2-digit"
  }).formatToParts(new Date());
  let h = 0, m = 0;
  parts.forEach((p) => {
    if (p.type === "hour") h = parseInt(p.value, 10) % 24;
    if (p.type === "minute") m = parseInt(p.value, 10);
  });
  return h * 60 + m;
}

function jumpToNow(animate) {
  simMinutes = torontoNowMinutes();
  setScene(simMinutes, animate);
  renderClock();
}

/* Main loop: advance the simulated clock while playing. */
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  if (!playing) return;
  const before = sceneAt(simMinutes).idx;
  simMinutes += speed * dt;
  if (simMinutes >= 1439) {
    simMinutes = 1439;
    playing = false;
    $("btn-play").textContent = "▶ Play the day";
    clockStateEl.textContent = "day done — he earned it";
  }
  const after = sceneAt(simMinutes);
  if (after.idx !== before || (after.idx === activities.length && currentIdx !== activities.length)) {
    setScene(simMinutes, true);
  }
  renderClock();
}, 100);

function init(data) {
  if (data && data.dayLabel) $("day-label").textContent = data.dayLabel;
  activities = (data.activities || [])
    .map((a) => ({ minutes: toMinutes(a.time), time: a.time, station: a.station, text: a.text }))
    .sort((a, b) => a.minutes - b.minutes);
  buildLog();
  placeCharacter();
  jumpToNow(false); /* open on the real moment of his day */
  clockStateEl.textContent = "showing real time now";
}

$("btn-play").addEventListener("click", () => {
  playing = !playing;
  $("btn-play").textContent = playing ? "⏸ Pause" : "▶ Play the day";
  clockStateEl.textContent = playing ? "playing" : "paused";
  if (playing && simMinutes >= 1439) { simMinutes = 0; setScene(0, true); }
});
$("speed").addEventListener("change", (e) => { speed = parseFloat(e.target.value); });
$("btn-now").addEventListener("click", () => {
  playing = false;
  $("btn-play").textContent = "▶ Play the day";
  clockStateEl.textContent = "showing real time now";
  jumpToNow(true);
});

fetch("activities.json")
  .then((r) => { if (!r.ok) throw new Error("bad response"); return r.json(); })
  .then((data) => init(data))
  .catch(() => init(FALLBACK_DATA));
