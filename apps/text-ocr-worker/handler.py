"""Lambda entry point: read one question image from S3 and return the OCR decision as JSON. No database access."""
import io
import os

from PIL import Image

import blocks
import gate
import readers

_S3 = None


def _image(key: str) -> Image.Image:
    global _S3
    if _S3 is None:
        import boto3

        _S3 = boto3.client("s3")
    body = _S3.get_object(Bucket=os.environ["QUESTION_IMAGE_BUCKET"], Key=key)["Body"].read()
    return Image.open(io.BytesIO(body)).convert("RGB")


def recognise(image: Image.Image) -> dict:
    located = blocks.locate(image)
    if len(located.boxes) < 3:
        return gate.decide({"tess": [], "paddle": []}, 0, False)
    tess_text, paddle_text = [], []
    for x0, y0, x1, y1 in located.boxes:
        box = (max(0, x0 - 3), max(0, y0 - 3), min(image.width, x1 + 3), min(image.height, y1 + 3))
        crop = located.clean.crop(box)
        lines = readers.read_tesseract(crop)
        tess_text.append(" ".join(lines))
        paddle_text.append(readers.read_paddle(crop, located.dark[box[1]:box[3], box[0]:box[2]], len(lines)))
    return gate.decide({"tess": tess_text, "paddle": paddle_text}, located.extra_ink, located.has_blank)


def lambda_handler(event, _context):
    try:
        return recognise(_image(event["key"]))
    except Exception:  # an unreadable image must never become text
        return {"status": "needs_review", "textContent": "", "options": [], "flagReasons": ["ocr_error"], "confidence": 0.0}
