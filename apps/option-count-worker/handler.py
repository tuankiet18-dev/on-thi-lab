"""SQS Lambda that checks image choice labels without reading question text."""

import hashlib
import io
import json
import logging
import os
import uuid

import boto3
import numpy as np
import psycopg
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

from option_detector import detect_option_labels

LOGGER = logging.getLogger(__name__)
REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
S3 = boto3.client("s3", region_name=REGION)
SSM = boto3.client("ssm", region_name=REGION)
ENGINE = None
DATABASE_URL = None


def _database_url():
    global DATABASE_URL
    if DATABASE_URL is None:
        DATABASE_URL = SSM.get_parameter(
            Name=os.environ["DATABASE_PARAMETER_NAME"], WithDecryption=True
        )["Parameter"]["Value"]
    return DATABASE_URL


def _job(message):
    value = json.loads(message)
    question_id = str(uuid.UUID(value["questionId"]))
    revision_id = str(uuid.UUID(value["revisionId"]))
    image_key = value["imageKey"]
    image_hash = value["imageHash"]
    queued_at = value["queuedAt"]
    if not image_key.startswith("drafts/") or not isinstance(image_hash, str):
        raise ValueError("Invalid option-count job")
    if len(image_hash) != 64 or any(char not in "0123456789abcdef" for char in image_hash):
        raise ValueError("Invalid image hash")
    if not isinstance(queued_at, str) or len(queued_at) < 20:
        raise ValueError("Invalid option-count job timestamp")
    return question_id, revision_id, image_key, image_hash, queued_at


def _detect(image_bytes):
    global ENGINE
    if ENGINE is None:
        ENGINE = RapidOCR()
    with Image.open(io.BytesIO(image_bytes)) as image:
        width = image.width
        rgb = np.asarray(image.convert("RGB"))
    lines, _ = ENGINE(rgb)
    return detect_option_labels(lines or [], width)


def _apply_result(connection, job, detection, error=None):
    question_id, revision_id, image_key, image_hash, queued_at = job
    with connection.transaction():
        row = connection.execute(
            """
            SELECT q.options, q.correct_options, q.option_count_check, e.status,
                   q.ai_metadata
            FROM questions q
            JOIN exam_revisions r ON r.id = q.revision_id
            JOIN exams e ON e.id = r.exam_id
            WHERE q.id = %s AND q.revision_id = %s AND q.image_key = %s
              AND q.image_hash = %s
            FOR UPDATE OF q
            """,
            (question_id, revision_id, image_key, image_hash),
        ).fetchone()
        if not row or row[3] != "draft":
            return
        options, answers, previous, _, answer_suggestion = row
        if (
            not isinstance(previous, dict)
            or previous.get("status") != "pending"
            or previous.get("queuedAt") != queued_at
        ):
            return

        count = detection["count"] if detection else None
        labels = detection["labels"] if detection else []
        confidence = detection["confidence"] if detection else None
        proposed_answers = (
            answer_suggestion.get("proposedAnswers", [])
            if isinstance(answer_suggestion, dict)
            else []
        )
        answer_floor = max([*answers, *proposed_answers], default=-1) + 1
        if error:
            status, reason = "failed", "OCR không xử lý được ảnh này."
        elif count is None:
            status, reason = "uncertain", "OCR không nhận diện được nhãn lựa chọn A–F."
        elif count < answer_floor:
            status, reason = (
                "conflict",
                f"OCR thấy {count} lựa chọn nhưng đáp án là {chr(64 + answer_floor)}.",
            )
        elif confidence < 0.82 or not detection["complete"]:
            status, reason = (
                "uncertain",
                f"OCR thấy {', '.join(labels) or 'không có nhãn'}, độ tin cậy {round(confidence * 100)}%; cần kiểm tra số lựa chọn.",
            )
        elif count != len(options):
            status, reason = (
                "conflict",
                f"OCR thấy {count} lựa chọn, khác {len(options)} lựa chọn đang lưu; giữ nguyên và cần kiểm tra ảnh.",
            )
        else:
            status, reason = "confirmed", None

        metadata = {
            "status": status,
            "detectedCount": count,
            "labels": labels,
            "confidence": confidence,
            "reason": reason,
            **(
                {"queuedAt": previous["queuedAt"]}
                if isinstance(previous.get("queuedAt"), str)
                else {}
            ),
        }
        connection.execute(
            """
            UPDATE questions
            SET option_count_check = %s::jsonb, updated_at = now()
            WHERE id = %s
            """,
            (json.dumps(metadata), question_id),
        )


def _process(message):
    job = _job(message)
    _, _, image_key, image_hash, _ = job
    image = S3.get_object(Bucket=os.environ["QUESTION_IMAGE_BUCKET"], Key=image_key)[
        "Body"
    ].read()
    if hashlib.sha256(image).hexdigest() != image_hash:
        detection, error = None, "Image checksum mismatch"
    else:
        try:
            detection, error = _detect(image), None
        except Exception as exc:
            LOGGER.exception("Option OCR failed for question %s", job[0])
            detection, error = None, str(exc)
    with psycopg.connect(_database_url(), sslmode="require", autocommit=True) as connection:
        _apply_result(connection, job, detection, error)


def lambda_handler(event, _context):
    for record in event["Records"]:
        _process(record["body"])
    return {"processed": len(event["Records"])}
