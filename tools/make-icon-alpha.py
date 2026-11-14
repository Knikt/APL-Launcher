#!/usr/bin/env python3
"""make-icon-alpha.py - the black behind an app's tile becomes transparent.

The tile artwork in launcher/images/apps is drawn on a black rectangle, so on
the Home Screen every icon carried a dark plate with it, its own corners
cutting into the backdrop. A blend mode cannot fix that inside a rounded clip
(the card is its own group, so the black has nothing to lighten against), so
the black is removed from the file instead: the dark area touching the border
is flood-filled to alpha 0, and anything enclosed by the logo is left alone.

Run from the repository root. The files are rewritten in place (PNG, RGBA).
"""
import os
import sys

from PIL import Image

APPS = os.path.join("launcher", "images", "apps")

# A pixel counts as "the plate" when every channel is this dark: the artwork
# itself keeps its own blacks (they are enclosed, so the fill never reaches).
DARK = 26


def unplate(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()

    def dark(x, y):
        r, g, b, a = px[x, y]
        return a and max(r, g, b) <= DARK

    seen = bytearray(w * h)
    stack = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    cleared = 0
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i] or not dark(x, y):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        cleared += 1
        if x:
            stack.append((x - 1, y))
        if x + 1 < w:
            stack.append((x + 1, y))
        if y:
            stack.append((x, y - 1))
        if y + 1 < h:
            stack.append((x, y + 1))
    if cleared:
        im.save(path, "PNG", optimize=True)
    return cleared, w * h


def main():
    if not os.path.isdir(APPS):
        sys.exit("run from the repository root (no %s)" % APPS)
    changed = 0
    for name in sorted(os.listdir(APPS)):
        if not name.endswith(".png"):
            continue
        path = os.path.join(APPS, name)
        cleared, total = unplate(path)
        if cleared:
            changed += 1
            print("%-34s %5.1f%% of the plate removed" % (name, 100.0 * cleared / total))
    print("%d tile(s) given a transparent background" % changed)


if __name__ == "__main__":
    main()
