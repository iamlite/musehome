#!/usr/bin/env python3
"""Slice eternal-sprite-sheet.png into per-frame PNGs in assets/frames/.

The sheet is 3 rows x 4 frames of chibi Eternal on solid black, but the
frames are not on a uniform grid, so frames are found by projection:
rows/columns of "content" in the background mask. The background is
removed by flood-filling from the borders through near-black pixels —
only background-connected black is keyed out, so the black suit (enclosed
by the gold outline) survives. Walk rows are normalized onto a shared
canvas, bottom-center aligned, so the cycle doesn't jitter.

Usage: python3 assets/slice_sprites.py   (run from the repo root)
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE / "eternal-sprite-sheet.png"
OUT = HERE / "frames"
NAMES = [
    ["front-0", "front-1", "front-2", "front-3"],
    ["side-0", "side-1", "side-2", "side-3"],
    ["idle", "typing", "reading", "sleeping"],
]


def bands(mask1d, minlen=30, gap=25):
    out, s, last = [], None, None
    for i, v in enumerate(mask1d):
        if v and s is None:
            s = i
        if v:
            last = i
        if not v and s is not None and (i - last) > gap:
            if last - s + 1 >= minlen:
                out.append((s, last))
            s = None
    if s is not None and last - s + 1 >= minlen:
        out.append((s, last))
    return out


def main():
    im = Image.open(SRC).convert("RGB")
    a = np.asarray(im).astype(int)
    h, w = a.shape[:2]
    dark = a.sum(axis=2) < 90

    bg = np.zeros((h, w), dtype=bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if dark[y, x] and not bg[y, x]:
                bg[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if dark[y, x] and not bg[y, x]:
                bg[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                dq.append((ny, nx))
    content = ~bg

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    out_im = Image.fromarray(np.dstack([np.asarray(im), alpha]), "RGBA")

    rows = bands(content.any(axis=1))
    assert len(rows) == 3, rows
    OUT.mkdir(exist_ok=True)
    for ri, (y0, y1) in enumerate(rows):
        cols = bands(content[y0 : y1 + 1, :].any(axis=0))
        assert len(cols) == 4, cols
        frames = []
        for ci, (x0, x1) in enumerate(cols):
            pad = 8
            box = (max(0, x0 - pad), max(0, y0 - pad),
                   min(w, x1 + 1 + pad), min(h, y1 + 1 + pad))
            frames.append((NAMES[ri][ci], out_im.crop(box)))
        if ri < 2:  # walk rows: shared canvas, bottom-center aligned
            mw = max(f.width for _, f in frames)
            mh = max(f.height for _, f in frames)
            for name, f in frames:
                canvas = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
                canvas.paste(f, ((mw - f.width) // 2, mh - f.height))
                canvas.save(OUT / f"{name}.png")
        else:
            for name, f in frames:
                f.save(OUT / f"{name}.png")
        print(f"row {ri}: " + ", ".join(n for n, _ in frames))


if __name__ == "__main__":
    main()
