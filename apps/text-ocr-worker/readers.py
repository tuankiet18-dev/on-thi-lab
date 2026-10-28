"""Two independent text readers over the located blocks: Tesseract and PaddleOCR (PP-OCR Latin via RapidOCR)."""
import os
import re
import subprocess
import tempfile

import numpy as np
from PIL import Image

TESSERACT = os.environ.get("TESSERACT_BIN", "tesseract")
_PADDLE = None


def _upscale(crop: Image.Image) -> Image.Image:
    target = 56 if crop.height < 40 else 40
    scale = max(2.0, target / min(max(crop.height, 1), 60))
    big = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGB", (big.width + 40, big.height + 40), "white")
    canvas.paste(big, (20, 20))
    return canvas


def read_tesseract(crop: Image.Image) -> list[str]:
    """Text lines of one block. A single text line is read as a line (psm 7), a paragraph as a block (psm 6)."""
    with tempfile.NamedTemporaryFile(suffix=".png") as f:
        _upscale(crop).save(f.name)
        psm = "7" if crop.height < 30 else "6"
        out = subprocess.run([TESSERACT, f.name, "-", "-l", "eng", "--psm", psm], capture_output=True, text=True, timeout=60).stdout
    return [re.sub(r"\s+", " ", line).strip() for line in out.split("\n") if line.strip()]


def split_lines(dark_crop: np.ndarray, n: int) -> list[tuple[int, int]]:
    """Cut a block into `n` lines at the emptiest pixel rows near the expected boundaries."""
    h = dark_crop.shape[0]
    profile = (dark_crop > 0).sum(axis=1).astype(float)
    cuts = [0]
    for k in range(1, n):
        centre = int(round(k * h / n))
        window = max(3, h // (3 * n))
        lo, hi = max(cuts[-1] + 4, centre - window), min(h - 4, centre + window)
        cuts.append(int(lo + np.argmin(profile[lo:hi + 1])) if hi > lo else centre)
    cuts.append(h)
    return [(a, b) for a, b in zip(cuts[:-1], cuts[1:]) if b - a >= 6]


def read_paddle(crop: Image.Image, dark_crop: np.ndarray, n_lines: int) -> str:
    global _PADDLE
    if _PADDLE is None:
        from rapidocr import LangRec, ModelType, OCRVersion, RapidOCR

        _PADDLE = RapidOCR(params={"Rec.lang_type": LangRec.LATIN, "Rec.ocr_version": OCRVersion.PPOCRV5, "Rec.model_type": ModelType.MOBILE})
    parts = []
    for a, b in split_lines(dark_crop, max(1, n_lines)):
        line = crop.crop((0, max(0, a - 1), crop.width, min(crop.height, b + 1)))
        result = _PADDLE(np.asarray(line.convert("RGB")), use_det=False, use_cls=False, use_rec=True)
        parts.append(" ".join(result.txts) if getattr(result, "txts", None) else "")
    return re.sub(r"\s+", " ", " ".join(parts)).strip()
