# Musehome

A playful, static single-page window into Eternal/Alfred's workday: a little
dark room with gold trim where the translucent nebula figure walks between
his stations doing his actual jobs — briefing at the Desk, briefs at the
Library, flights at the Window, reminders on the Wall Screen, and so on.

No framework, no build step. Just open it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: room, stations, character (inline SVG), clock controls, log panel |
| `style.css` | All styling. Deep space tones, warm gold accents, no green |
| `app.js` | The engine: simulated clock, walking, speech bubble, log highlighting |
| `activities.json` | The day's schedule — the only file that changes day to day |

## Run it

- **Simplest:** open `index.html` in a browser. If the browser blocks the
  `activities.json` fetch (some do on `file://`), the page falls back to an
  identical built-in copy of the seed day, so it still works.
- **Properly:** serve the folder so the JSON loads live:

  ```bash
  cd ~/workspace/musehome
  python3 -m http.server 8765
  # then open http://localhost:8765
  ```

## How it works

- **The day is data.** `activities.json` holds an array of
  `{ "time": "07:30", "station": "desk", "text": "Morning briefing delivered" }`
  entries (24-hour `HH:MM`, America/Toronto). Stations are fixed:
  `bed`, `library`, `desk`, `wall`, `server`, `kitchen`, `door`, `window`.
- **On load**, the page "jumps to now": it maps the real Toronto time onto
  the schedule and puts him at whichever station the latest entry at or
  before now points to. Before the first entry he's in the Hammock asleep;
  after 23:00 he's back there recharging.
- **Play the day** runs the clock at an accelerated speed (1–30 sim-minutes
  per real second). Each time the clock crosses an activity, he walks to
  that station — long trips route through the middle of the room so he
  doesn't clip through the furniture — pauses, and his speech bubble and
  the "Right now" card show what he's doing. The log on the right marks
  finished entries with a ✓ and highlights the current one.
- **Click any log entry** to jump the clock to that moment and send him
  walking there. **Jump to now** re-syncs to real Toronto time.
- The walking itself is a small `requestAnimationFrame` mover in `app.js`
  (constant speed, waypoint list, a bobbing animation while he moves);
  the figure is an inline SVG — gold outline, nebula fill, star eyes.

## Updating the day

Edit `activities.json` — that's it. Keep entries sorted loosely by time
(the page sorts them), use the station keys above, and write the `text`
the way he'd say it. One entry per thing he actually did or will do.

## The live version (not built)

This page is a static toy, seeded by hand with Friday Oct 30, 2026 — bail
hearing day. A live version would work exactly like the tb-dash wall
display already does: Alfred updates `activities.json` himself as the day
happens (audit at 05:00, Angie's text at 07:00, podcast at 07:48, out the
door at 08:30…), and the page just renders whatever the file says. Same
pattern as the tb-dash pushes: one small JSON file as the source of truth,
written in the same turn as the work itself.
