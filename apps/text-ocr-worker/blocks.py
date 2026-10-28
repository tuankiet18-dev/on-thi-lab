"""Find the text blocks of a question screenshot with plain image processing.

Exam screenshots show the question as near-black text on white, surrounded by coloured chrome (red bar, blue
headers, progress bars). Text lines share one left edge, so the most common left edge is the question panel.
"""
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image


@dataclass
class Located:
    boxes: list[tuple[int, int, int, int]]  # (x0, y0, x1, y1) of each text block inside the panel, top to bottom
    clean: Image.Image  # the image with long straight rules (panel borders) whitened out
    dark: np.ndarray  # binary text mask (255 = ink) used to split blocks into lines
    extra_ink: int  # ink of non-text content beside the panel (formula, diagram, "(See picture)")
    has_blank: bool  # a fill-in-the-blank gap (____) inside a text line


def _components(dark: np.ndarray, width: int) -> list[dict]:
    dilated = cv2.dilate(dark, cv2.getStructuringElement(cv2.MORPH_RECT, (max(14, int(0.011 * width)), 3)))
    count, _, stats, _ = cv2.connectedComponentsWithStats(dilated, connectivity=8)
    pieces = []
    for i in range(1, count):
        x, y, w, h, area = stats[i]
        if not (9 <= h <= 160 and w >= 10 and area > 40):
            continue
        ys, xs = np.where(dark[y:y + h, x:x + w] > 0)
        if len(xs) < 8:
            continue
        pieces.append(dict(x0=int(x + xs.min()), x1=int(x + xs.max()) + 1, y0=int(y + ys.min()), y1=int(y + ys.max()) + 1, ink=int(len(xs))))
    return _merge_line_pieces(pieces)


def _merge_line_pieces(pieces: list[dict]) -> list[dict]:
    """A blank (_____) or a wide gap can split one text line into pieces; join pieces sharing a text line."""
    lines: list[dict] = []
    for c in sorted(pieces, key=lambda c: (c["y0"], c["x0"])):
        h = c["y1"] - c["y0"]
        for line in lines:
            lh = line["y1"] - line["y0"]
            overlap = min(line["y1"], c["y1"]) - max(line["y0"], c["y0"])
            gap = c["x0"] - line["x1"]
            if overlap >= 0.6 * min(lh, h) and 0 <= gap <= max(60, 7.5 * max(lh, h)) and h <= 2.2 * lh + 6:
                line.update(x1=max(line["x1"], c["x1"]), y0=min(line["y0"], c["y0"]), y1=max(line["y1"], c["y1"]), ink=line["ink"] + c["ink"])
                break
        else:
            lines.append(dict(c))
    return lines


def _panel(components: list[dict], width: int):
    """The largest group of components sharing a left edge (within 1.2% of the width)."""
    tolerance = max(8, int(0.012 * width))
    best: list[dict] = []
    for c in components:
        group = [d for d in components if abs(d["x0"] - c["x0"]) <= tolerance]
        if len(group) > len(best):
            best = group
    inside = {id(c) for c in best}
    return sorted(best, key=lambda d: d["y0"]), [c for c in components if id(c) not in inside]


def _has_blank(dark: np.ndarray, boxes) -> bool:
    for x0, y0, x1, y1 in boxes:
        sub = dark[y0:y1 + 1, x0:x1 + 1]
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(22, int(1.6 * (y1 - y0 + 1))), 1))
        _, _, stats, _ = cv2.connectedComponentsWithStats(cv2.morphologyEx(sub, cv2.MORPH_OPEN, kernel))
        if any(stats[j][3] <= 3 for j in range(1, len(stats))):
            return True
    return False


def locate(image: Image.Image) -> Located:
    rgb = image.convert("RGB")
    width = rgb.width
    a = np.asarray(rgb).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gray = (r * 299 + g * 587 + b * 114) // 1000
    coloured = (np.abs(r - g) > 40) | (np.abs(g - b) > 40) | (np.abs(r - b) > 40)
    dark = ((gray < 150) & ~coloured).astype(np.uint8) * 255
    vertical = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40)))
    horizontal = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (90, 1)))
    rules = cv2.dilate(cv2.bitwise_or(vertical, horizontal), np.ones((3, 3), np.uint8))
    dark = cv2.bitwise_and(dark, cv2.bitwise_not(rules))
    cleaned = np.asarray(rgb).copy()
    cleaned[rules > 0] = 255
    panel, others = _panel(_components(dark, width), width)
    boxes = [(c["x0"], c["y0"], c["x1"], c["y1"]) for c in panel]
    extra = 0
    if panel:
        top, bottom = min(c["y0"] for c in panel), max(c["y1"] for c in panel)
        extra = sum(c["ink"] for c in others if c["y1"] > top and c["y0"] < bottom and c["ink"] >= 40)
    return Located(boxes, Image.fromarray(cleaned), dark, extra, _has_blank(dark, boxes))
