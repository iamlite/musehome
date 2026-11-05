"use strict";

/* Musehome v2 — Eternal's house, walked.
   Data comes from activities.json; if the fetch fails (e.g. opened via
   file://), the identical seed below is used so the page still works.
   He and Bella both move on a waypoint graph whose edges only pass
   through doorways — no walking through walls. */

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

/* Station display names (positions live in NODES). */
const STATIONS = {
  bed:     { name: "Hammock",       place: "the Hammock" },
  library: { name: "Reading chair", place: "the reading chair" },
  desk:    { name: "Study desk",    place: "the Study" },
  wall:    { name: "Wall screen",   place: "the Wall Screen" },
  server:  { name: "Server closet", place: "the Server Closet" },
  kitchen: { name: "Kitchen",       place: "the Kitchen" },
  door:    { name: "Front door",    place: "the Door" },
  window:  { name: "Observatory",   place: "the Observatory" }
};

/* Waypoint graph, percent-of-plan coordinates. Every edge is a straight
   segment that stays inside rooms or crosses a wall only inside a
   doorway gap (hand-checked against the wall layout in index.html):
   study east gap y20–28, study/kitchen gaps x22–30, observatory west
   gap y16–24, hall→lounge opening x46–64, kitchen east gap y66–74,
   server east gap y53–61, entry opening x44–60. */
const NODES = {
  desk:       { x: 24,   y: 31, edges: ["studyC"] },
  library:    { x: 11,   y: 34, edges: ["studyC"] },
  studyC:     { x: 21,   y: 25, edges: ["desk", "library", "studyDoorE", "studyDoorS"] },
  studyDoorE: { x: 38,   y: 24, edges: ["studyC", "hallN"] },
  studyDoorS: { x: 25,   y: 44, edges: ["studyC", "kitchenC"] },
  hallN:      { x: 52,   y: 20, edges: ["studyDoorE", "obsDoor", "hallS"] },
  obsDoor:    { x: 66,   y: 20, edges: ["hallN", "obsC"] },
  obsC:       { x: 80,   y: 19, edges: ["obsDoor", "window"] },
  window:     { x: 85,   y: 26, edges: ["obsC"] },
  hallS:      { x: 52,   y: 37, edges: ["hallN", "loungeC"] },
  loungeC:    { x: 70,   y: 63, edges: ["hallS", "wall", "kitDoorW", "entryN", "plant"] },
  wall:       { x: 78,   y: 58, edges: ["loungeC"] },
  plant:      { x: 90,   y: 80, edges: ["loungeC"] },
  kitDoorW:   { x: 39,   y: 70, edges: ["loungeC", "kitchenC"] },
  kitchenC:   { x: 22,   y: 74, edges: ["kitDoorW", "kitchen", "serverDoor", "studyDoorS"] },
  kitchen:    { x: 13,   y: 83, edges: ["kitchenC"] },
  serverDoor: { x: 17.5, y: 57, edges: ["kitchenC", "server"] },
  server:     { x: 9,    y: 57, edges: ["serverDoor"] },
  entryN:     { x: 53,   y: 72, edges: ["loungeC", "bed", "door"] },
  bed:        { x: 47,   y: 86, edges: ["entryN", "door"] },
  door:       { x: 58,   y: 90, edges: ["entryN", "bed"] }
};

function findPath(from, to) {
  if (from === to) return [];
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nxt of NODES[cur].edges) {
      if (!(nxt in prev)) {
        prev[nxt] = cur;
        if (nxt === to) {
          const path = [];
          let n = to;
          while (n !== from) { path.unshift(n); n = prev[n]; }
          return path;
        }
        queue.push(nxt);
      }
    }
  }
  return [to]; /* should never happen on a connected graph */
}

/* ---------- Generic waypoint mover ---------- */
function makeMover(speed, startNode) {
  return {
    speed: speed,
    pos: { x: NODES[startNode].x, y: NODES[startNode].y },
    queue: [],           /* [{x, y, node}] */
    destNode: startNode, /* final node of the current route */
    walking: false,
    vel: { x: 0, y: 0 },
    lastDist: 0,
    onArrive: null,
    setRoute(names, onArrive) {
      this.queue = names.map((n) => ({ x: NODES[n].x, y: NODES[n].y, node: n }));
      if (names.length) this.destNode = names[names.length - 1];
      this.onArrive = onArrive || null;
      this.walking = this.queue.length > 0;
      if (!this.walking && this.onArrive) { const cb = this.onArrive; this.onArrive = null; cb(); }
    },
    appendRoute(names, onArrive) {
      const pts = names.map((n) => ({ x: NODES[n].x, y: NODES[n].y, node: n }));
      this.queue = this.queue.concat(pts);
      if (names.length) this.destNode = names[names.length - 1];
      this.onArrive = onArrive || null;
      this.walking = this.queue.length > 0;
    },
    teleport(node) {
      this.queue = [];
      this.walking = false;
      this.onArrive = null;
      this.destNode = node;
      this.pos = { x: NODES[node].x, y: NODES[node].y };
      this.vel = { x: 0, y: 0 };
    },
    step(dt) {
      this.lastDist = 0;
      if (!this.queue.length) { this.walking = false; this.vel = { x: 0, y: 0 }; return; }
      this.walking = true;
      let budget = this.speed * dt;
      const startPos = { x: this.pos.x, y: this.pos.y };
      while (budget > 0 && this.queue.length) {
        const t = this.queue[0];
        const dx = t.x - this.pos.x, dy = t.y - this.pos.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.05) { this.queue.shift(); continue; }
        if (d <= budget) {
          this.pos = { x: t.x, y: t.y };
          budget -= d; this.lastDist += d;
          this.queue.shift();
        } else {
          this.pos = { x: this.pos.x + (dx / d) * budget, y: this.pos.y + (dy / d) * budget };
          this.lastDist += budget;
          budget = 0;
        }
      }
      if (dt > 0) this.vel = { x: (this.pos.x - startPos.x) / dt, y: (this.pos.y - startPos.y) / dt };
      if (!this.queue.length) {
        this.walking = false;
        if (this.onArrive) { const cb = this.onArrive; this.onArrive = null; cb(); }
      }
    }
  };
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const planEl = $("plan");
const charEl = $("character");
const spriteEl = $("sprite");
const bubbleEl = $("bubble");
const catEl = $("cat");
const clockEl = $("clock");
const clockStateEl = $("clock-state");
const logEl = $("log");
const nowTextEl = $("now-text");
const skyEl = $("sky");
const skyStarsEl = $("sky-stars");
const orbEl = $("orb");
const lightingEl = $("lighting");

/* ---------- State ---------- */
let activities = [];
let simMinutes = 0;
let playing = false;
let speed = 10;
let currentIdx = -2;
let sceneStation = "bed";
let sceneText = "";
let sceneSleep = true;
let currentNode = "bed";
let arrivedAt = 0;         /* performance.now()/1000 when he last settled */
let behavior = null;       /* active micro-behavior or null */
let behaviorCooldown = 15; /* real seconds */
const him = makeMover(50, "bed");
const cat = makeMover(17, "hallS");
let catAnchor = "hallS";
let catState = "dwell";
let catTimer = 5;
let catNap = false;

function toMinutes(hhmm) {
  const p = hhmm.split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}
function fmt(mins) {
  const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
function nowSecs() { return performance.now() / 1000; }

/* ---------- Sprite director ---------- */
const FRAME_NAMES = ["idle", "typing", "reading", "sleeping",
  "front-0", "front-1", "front-2", "front-3",
  "side-0", "side-1", "side-2", "side-3"];
FRAME_NAMES.forEach((n) => { const i = new Image(); i.src = "assets/frames/" + n + ".png"; });
let curFrame = "idle";
let curFlip = false;
let cycleIdx = 0;
let cycleAcc = 0;

function setSprite(name, flip) {
  if (name !== curFrame) {
    curFrame = name;
    spriteEl.src = "assets/frames/" + name + ".png";
  }
  if (flip !== curFlip) {
    curFlip = flip;
    spriteEl.style.transform = flip ? "scaleX(-1)" : "";
  }
}
function applyPose(pose) {
  charEl.classList.toggle("pose-sleeping", pose === "sleeping");
  charEl.classList.toggle("idle-bob", pose !== "sleeping");
  setSprite(pose, false);
}
function stationPose(station, sleep) {
  if (sleep) return "sleeping";
  if (station === "desk") return "typing";
  if (station === "library") return "reading";
  return "idle";
}
function directSprite() {
  if (him.walking) {
    charEl.classList.remove("idle-bob");
    const adx = Math.abs(him.vel.x), ady = Math.abs(him.vel.y);
    const set = adx >= ady ? "side" : "front"; /* walking up reuses the front row */
    const flip = set === "side" && him.vel.x < 0;
    cycleAcc += him.lastDist;
    if (cycleAcc > 3.4) { cycleAcc = 0; cycleIdx = (cycleIdx + 1) % 4; }
    setSprite(set + "-" + cycleIdx, flip);
  }
}

/* ---------- Scenes ---------- */
function sceneAt(mins) {
  if (mins >= 23 * 60) {
    return { idx: activities.length, station: "bed", text: "Recharging — tomorrow, whatever it brings", sleep: true };
  }
  let idx = -1;
  for (let i = 0; i < activities.length; i++) {
    if (activities[i].minutes <= mins) idx = i; else break;
  }
  if (idx === -1) {
    return { idx: -1, station: "bed", text: "Asleep — recharging for a big day", sleep: true };
  }
  const a = activities[idx];
  return { idx: idx, station: a.station, text: a.text, sleep: false };
}

function goToStation(station, replace, onArrive) {
  /* Anchor choice keeps every leg on graph edges: when replacing a route
     mid-walk, start from the node he is currently heading to (he reaches
     it along the edge he is already on, then follows graph edges). */
  let names;
  if (him.walking && replace) {
    const anchor = him.queue[0].node;
    names = [anchor].concat(findPath(anchor, station));
  } else if (him.walking) {
    names = findPath(him.destNode, station); /* append after the committed route */
  } else {
    names = findPath(currentNode, station);
  }
  const arrive = () => {
    currentNode = station;
    arrivedAt = nowSecs();
    if (onArrive) onArrive();
  };
  if (him.walking && !replace) him.appendRoute(names, arrive);
  else him.setRoute(names, arrive);
}

function cancelBehavior() {
  behavior = null;
  charEl.classList.remove("stretching");
  planEl.dataset.scene = sceneStation;
}

function setScene(mins, animate) {
  const scene = sceneAt(mins);
  const changedStation = scene.station !== sceneStation;
  currentIdx = scene.idx;
  sceneStation = scene.station;
  sceneText = scene.text;
  sceneSleep = scene.sleep;
  planEl.dataset.scene = scene.station;

  document.querySelectorAll(".st-marker").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-station") === scene.station);
  });
  nowTextEl.textContent = scene.text + "  ·  " + (STATIONS[scene.station] || {}).name;
  updateLog();
  updateDashNext();

  if (!animate) {
    cancelBehavior();
    him.teleport(scene.station);
    currentNode = scene.station;
    arrivedAt = nowSecs();
    applyPose(stationPose(scene.station, scene.sleep));
    bubbleEl.textContent = scene.text;
    return;
  }
  cancelBehavior();
  if (changedStation) {
    bubbleEl.textContent = "Off to " + (STATIONS[scene.station] || {}).place + "…";
    goToStation(scene.station, true, () => {
      applyPose(stationPose(scene.station, scene.sleep));
      bubbleEl.textContent = scene.text;
    });
  } else {
    bubbleEl.textContent = scene.text;
    if (!him.walking) applyPose(stationPose(scene.station, scene.sleep));
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
  activities.forEach((a) => {
    const li = document.createElement("li");
    const lt = document.createElement("span");
    lt.className = "lt"; lt.textContent = a.time;
    const lx = document.createElement("span");
    lx.className = "lx"; lx.textContent = a.text;
    const lst = document.createElement("span");
    lst.className = "lst";
    lst.textContent = (STATIONS[a.station] || {}).name || a.station;
    lx.appendChild(lst);
    li.appendChild(lt); li.appendChild(lx);
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    li.setAttribute("aria-label", a.time + " — " + a.text);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); li.click(); }
    });
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

/* ---------- Micro-behaviors (ambient life between entries) ---------- */
const BEHAVIORS = [
  { node: "plant",   go: "The nebula plant looks thirsty", act: "Watering the nebula plant" },
  { node: "window",  go: "Something moved in the sky",     act: "Quick glance through the telescope" },
  { node: "kitchen", go: "Kettle calls",                   act: "Putting the kettle on" },
  { stretch: true,   act: "Stretch break — even nebulae unkink" }
];
function behaviorTick(dt) {
  if (behaviorCooldown > 0) behaviorCooldown -= dt;
  if (!behavior) {
    if (him.walking || sceneSleep || behaviorCooldown > 0) return;
    if (nowSecs() - arrivedAt < 24) return;
    if (Math.random() > 0.45) { behaviorCooldown = 6; return; }
    const options = BEHAVIORS.filter((b) => b.stretch || (b.node !== sceneStation && b.node !== currentNode));
    if (!options.length) return;
    const def = options[Math.floor(Math.random() * options.length)];
    behavior = { def: def, phase: "go", t: 0 };
    if (def.stretch) {
      behavior.phase = "act";
      charEl.classList.add("stretching");
      bubbleEl.textContent = def.act;
    } else {
      bubbleEl.textContent = def.go;
      goToStation(def.node, false, () => {
        if (!behavior) return;
        behavior.phase = "act";
        behavior.t = 0;
        bubbleEl.textContent = def.act;
        planEl.dataset.scene = def.node; /* light the station FX while he putters */
        applyPose("idle");
      });
    }
    return;
  }
  if (behavior.phase === "act") {
    behavior.t += dt;
    if (behavior.t >= 2.6) {
      charEl.classList.remove("stretching");
      if (behavior.def.stretch) {
        behavior = null;
        behaviorCooldown = 25;
        arrivedAt = nowSecs();
        bubbleEl.textContent = sceneText;
        applyPose(stationPose(sceneStation, sceneSleep));
      } else {
        behavior.phase = "back";
        planEl.dataset.scene = sceneStation;
        bubbleEl.textContent = "Back to it";
        goToStation(sceneStation, false, () => {
          if (!behavior) return;
          behavior = null;
          behaviorCooldown = 25;
          arrivedAt = nowSecs();
          bubbleEl.textContent = sceneText;
          applyPose(stationPose(sceneStation, sceneSleep));
        });
      }
    }
  }
}

/* ---------- Bella ---------- */
const CAT_SPOTS = [
  { x: 52, y: 31, via: "hallS" },    /* hall rug */
  { x: 78, y: 63, via: "wall" },     /* on the couch */
  { x: 24, y: 89, via: "kitchenC" }, /* kitchen, hoping */
  { x: 13, y: 37, via: "library" },  /* reading chair */
  { x: 90, y: 15, via: "obsC" },     /* observatory sun patch */
  { x: 9,  y: 63, via: "server" }    /* warm server closet */
];
function catTick(dt) {
  if (catState === "dwell") {
    catTimer -= dt;
    if (catTimer <= 0) {
      const options = CAT_SPOTS.filter((s) => s.via !== catAnchor || s.x !== cat.pos.x);
      const spot = options[Math.floor(Math.random() * options.length)];
      catNap = false;
      catEl.classList.remove("napping");
      const names = findPath(catAnchor, spot.via);
      const pts = names.map((n) => ({ x: NODES[n].x, y: NODES[n].y, node: n }));
      pts.push({ x: spot.x, y: spot.y, node: spot.via });
      cat.queue = pts;
      cat.destNode = spot.via;
      cat.walking = pts.length > 0;
      cat.onArrive = () => {
        catAnchor = spot.via;
        catState = "dwell";
        catNap = Math.random() < 0.35;
        catTimer = catNap ? 9 + Math.random() * 8 : 5 + Math.random() * 6;
        catEl.classList.toggle("napping", catNap);
      };
      catState = "walk";
    }
  }
}

/* ---------- Time of day ---------- */
function phaseFor(m) {
  if (m < 300)  return { name: "night",   sky: ["#05081f", "#10163c"], stars: 1,    orb: "moon", overlay: "rgba(6,10,38,0.38)",  lamp: 1,   wx: "Clear · −3°C" };
  if (m < 420)  return { name: "dawn",    sky: ["#3a2b52", "#c77b3f"], stars: 0.35, orb: "sun",  overlay: "rgba(80,50,20,0.12)", lamp: 0.7, wx: "Sunrise · −1°C" };
  if (m < 1020) return { name: "day",     sky: ["#7fa8d8", "#cfe4f7"], stars: 0,    orb: "sun",  overlay: "rgba(255,240,200,0.05)", lamp: 0.25, wx: "Partly cloudy · 4°C" };
  if (m < 1170) return { name: "dusk",    sky: ["#40284f", "#d98a4a"], stars: 0.3,  orb: "sun",  overlay: "rgba(90,45,15,0.16)", lamp: 0.85, wx: "Cooling off · 1°C" };
  if (m < 1290) return { name: "evening", sky: ["#141a45", "#2c2358"], stars: 0.7,  orb: "moon", overlay: "rgba(10,14,44,0.28)", lamp: 1,   wx: "Clear · −2°C" };
  return           { name: "night",   sky: ["#05081f", "#10163c"], stars: 1,    orb: "moon", overlay: "rgba(6,10,38,0.38)",  lamp: 1,   wx: "Clear · −3°C" };
}
let lastPhase = "";
function applyPhase() {
  const p = phaseFor(simMinutes);
  skyEl.style.background = "linear-gradient(180deg, " + p.sky[0] + ", " + p.sky[1] + ")";
  skyStarsEl.style.opacity = p.stars;
  lightingEl.style.background = p.overlay;
  planEl.style.setProperty("--lamp", p.lamp);
  orbEl.className = "orb" + (p.orb === "moon" ? " moon" : "");
  let t;
  if (p.orb === "sun") t = Math.min(1, Math.max(0, (simMinutes - 360) / (1140 - 360)));
  else t = Math.min(1, Math.max(0, ((simMinutes + 300) % 1440) / 660));
  orbEl.style.left = (5 + t * 82) + "%";
  orbEl.style.top = (52 - Math.sin(t * Math.PI) * 36) + "%";
  if (p.name !== lastPhase) {
    lastPhase = p.name;
    planEl.dataset.phase = p.name;
    $("dash-weather").textContent = p.wx;
  }
}

/* ---------- Wall screen (tb-dash) ---------- */
let dashIdx = 0;
function cycleDash() {
  const slides = planEl.querySelectorAll(".dash-slide");
  const dots = planEl.querySelectorAll(".dash-dots i");
  dashIdx = (dashIdx + 1) % slides.length;
  slides.forEach((s, i) => s.classList.toggle("active", i === dashIdx));
  dots.forEach((d, i) => d.classList.toggle("on", i === dashIdx));
}
function updateDashNext() {
  let txt = "Day wrapped — hammock time";
  for (let i = 0; i < activities.length; i++) {
    if (activities[i].minutes > simMinutes) {
      txt = activities[i].time + " — " + activities[i].text;
      break;
    }
  }
  $("dash-next").textContent = txt;
}

/* ---------- Clock / controls ---------- */
function renderClock() {
  clockEl.textContent = fmt(simMinutes);
  $("dash-clock").textContent = fmt(simMinutes);
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
  applyPhase();
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

/* ---------- Main loops ---------- */
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (playing) {
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
  }
  him.step(dt);
  cat.step(dt);
  behaviorTick(dt);
  catTick(dt);
  directSprite();

  charEl.style.left = him.pos.x + "%";
  charEl.style.top = him.pos.y + "%";
  bubbleEl.classList.toggle("bub-left", him.pos.x < 20);
  bubbleEl.classList.toggle("bub-right", him.pos.x > 80);
  catEl.style.left = cat.pos.x + "%";
  catEl.style.top = cat.pos.y + "%";
  catEl.classList.toggle("walking", cat.walking);
  if (cat.walking) catEl.classList.toggle("flip", cat.vel.x < -0.5);
  requestAnimationFrame(frame);
}
setInterval(() => { applyPhase(); updateDashNext(); }, 1500);
setInterval(cycleDash, 4000);

/* ---------- Init ---------- */
function scatter(container, count, cls) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement("i");
    if (cls) s.className = cls;
    s.style.left = (Math.random() * 96) + "%";
    s.style.top = (Math.random() * 92) + "%";
    if (cls === "mote") {
      s.style.animationDuration = (9 + Math.random() * 12) + "s";
      s.style.animationDelay = (-Math.random() * 14) + "s";
    }
    container.appendChild(s);
  }
}
function init(data) {
  if (data && data.dayLabel) $("day-label").textContent = data.dayLabel;
  activities = (data.activities || [])
    .map((a) => ({ minutes: toMinutes(a.time), time: a.time, station: a.station, text: a.text }))
    .sort((a, b) => a.minutes - b.minutes);
  buildLog();
  scatter($("motes"), 22, "mote");
  scatter(skyStarsEl, 36, "");
  cat.pos = { x: 52, y: 31 };
  catEl.style.left = cat.pos.x + "%";
  catEl.style.top = cat.pos.y + "%";
  jumpToNow(false);
  clockStateEl.textContent = "showing real time now";
  requestAnimationFrame(frame);
}

fetch("activities.json")
  .then((r) => { if (!r.ok) throw new Error("bad response"); return r.json(); })
  .then((data) => init(data))
  .catch(() => init(FALLBACK_DATA));
