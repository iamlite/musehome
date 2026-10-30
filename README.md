# Musehome

A playful, static single-page window into Eternal/Alfred's workday: a
whole little house — study, observatory, wall room, kitchen, server
closet, entry — where the chibi nebula figure from the avatar's own
sprite sheet walks his actual day, station to station, through the
doorways. Bella the orange cat wanders the same floor plan on her own
schedule.

No framework, no build step. Just open it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: floor plan (6 rooms + hall), furniture, Bella, the character, clock controls, log panel |
| `style.css` | All styling. Deep space tones, warm gold accents, no green |
| `app.js` | The engine: simulated clock, waypoint routing, sprite direction, ambient life |
| `activities.json` | The day's schedule — the only file that changes day to day |
| `assets/` | The Eternal sprite sheet + sliced frames, and the CC0 Kenney tiles in use — see `ASSETS.md` |

## Run it

- **Simplest:** open `index.html` in a browser. If the browser blocks the
  `activities.json` fetch (some do on `file://`), the page falls back to
  an identical built-in copy of the seed day, so it still works.
- **Properly:** serve the folder so the JSON loads live:

  ```bash
  cd ~/workspace/repo-musehome
  python3 -m http.server 8765
  # then open http://localhost:8765
  ```

## How it works

- **The day is data.** `activities.json` holds an array of
  `{ "time": "07:30", "station": "desk", "text": "Morning briefing delivered" }`
  entries (24-hour `HH:MM`, America/Toronto). Stations are fixed:
  `bed`, `library`, `desk`, `wall`, `server`, `kitchen`, `door`, `window`.
- **On load**, the page "jumps to now": it maps the real Toronto time
  onto the schedule and puts him at whichever station the latest entry
  at or before now points to. Before the first entry he's in the
  Hammock asleep; after 23:00 he's back there recharging.
- **Play the day** runs the clock at an accelerated speed (1–30
  sim-minutes per real second). Each time the clock crosses an activity,
  he walks to that station — always along a waypoint graph whose edges
  pass through the actual doorways, never through walls — and his
  speech bubble and the "Right now" card show what he's doing. The log
  on the right marks finished entries with a ✓ and highlights the
  current one. **Click any log entry** to jump the clock to that
  moment. **Jump to now** re-syncs to real Toronto time.
- **The character is the avatar.** Frames sliced from
  `assets/eternal-sprite-sheet.png` (see `ASSETS.md` /
  `assets/slice_sprites.py`): front and side walk cycles (side flips
  for direction; walking up reuses the front row, as chibi games do),
  and station poses — typing at the desk, reading in the library chair,
  curled up asleep in the hammock.
- **Ambient life.** Between entries he putters: watering the nebula
  plant, glancing through the telescope, putting the kettle on, the
  occasional stretch. Bella the cat roams room to room and naps where
  she lands (the server closet is warm; the couch is hers too). The
  observatory sky, the rooms' light, and the lamps follow the simulated
  time of day; the server racks blink; the big wall screen cycles
  tb-dash widgets (clock, weather, next event from `activities.json`);
  dust motes drift.

## Updating the day

Edit `activities.json` — that's it. Keep entries sorted loosely by
time (the page sorts them), use the station keys above, and write the
`text` the way he'd say it. One entry per thing he actually did or
will do.

## The live version (not built)

This page is a static toy, seeded by hand with Friday Oct 30, 2026 —
bail hearing day. A live version would work exactly like the tb-dash
wall display already does: Alfred updates `activities.json` himself as
the day happens (audit at 05:00, Angie's text at 07:00, podcast at
07:48, out the door at 08:30…), and the page just renders whatever the
file says. Same pattern as the tb-dash pushes: one small JSON file as
the source of truth, written in the same turn as the work itself.
