# Assets & licences

Everything visual in Musehome is either hand-built in this repo
(CSS/SVG furniture, Bella the cat, the rooms) or listed here.

## Eternal sprite sheet — the character

- `assets/eternal-sprite-sheet.png` — custom sprite sheet of the avatar
  (chibi Eternal: nebula head, star eyes, black suit, burgundy tie),
  generated for this project and provided by Tariel. The untouched
  generation output sits beside it as
  `assets/media-generation-eternal-sprite-sheet-0-*.png`.
- `assets/frames/*.png` — the 12 frames sliced from that sheet by
  `assets/slice_sprites.py` (bounding-box detection; background removed
  by border flood-fill so the black suit survives; walk cycles
  normalized onto shared bottom-aligned canvases).
  - Row 1 → `front-0..3` (walk toward viewer; also used for walking up)
  - Row 2 → `side-0..3` (profile, faces right; flipped in code for left)
  - Row 3 → `idle`, `typing` (desk), `reading` (library), `sleeping`
    (hammock — Z's included in the art)

## Kenney Roguelike Indoor pack — CC0

- Source: "Roguelike Indoor pack" by Kenney (kenney.nl), via OpenGameArt.
- Licence: **Creative Commons Zero (CC0)** — public domain; credit is
  appreciated but not mandatory. Full text: `assets/Kenney-License.txt`.
  The original spritesheet is vendored at
  `assets/roguelikeIndoor_transparent.png` for provenance. No hotlinking:
  everything used is a local file.
- Used, extracted tile-by-tile:
  - `assets/couch.png` — the lounge couch (tiles (7–9, 10–11) of the
    sheet). **Modified:** the original upholstery is green; the hue of
    the green range was rotated to violet to fit this house's
    gold-on-dark, no-green palette.
  - `assets/candelabra.png` — a candelabra (tile (19,7)), unmodified,
    standing by the hall opening in the lounge.

Everything else — floors, walls, desk, bookshelf, telescope, kitchen,
server racks, hammock, Bella — is drawn in `style.css` / inline SVG in
`index.html`, made for this repo.
