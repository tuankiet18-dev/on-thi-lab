"""Recognize only the aligned A-F choice labels from OCR line output."""

import re
from collections.abc import Iterable

LABELS = "ABCDEF"
OPTION_PATTERN = re.compile(r"^\s*([A-F])\s*[.\)\]:-]", re.I)


def detect_option_labels(
    ocr_lines: Iterable[tuple[object, str, float]], image_width: int
) -> dict:
    candidates: list[tuple[str, float, float]] = []
    for box, raw_text, raw_score in ocr_lines:
        text = str(raw_text).strip()
        match = OPTION_PATTERN.match(text)
        if not match and re.fullmatch(r"[A-F]", text, re.I):
            match = re.match(r"([A-F])", text, re.I)
        if match:
            left = min(float(point[0]) for point in box)
            candidates.append((match.group(1).upper(), left, float(raw_score)))

    tolerance = max(18.0, image_width * 0.035)
    groups: list[list[tuple[str, float, float]]] = []
    for candidate in sorted(candidates, key=lambda item: item[1]):
        group = next(
            (
                group
                for group in groups
                if abs(candidate[1] - sum(item[1] for item in group) / len(group))
                <= tolerance
            ),
            None,
        )
        if group is None:
            groups.append([candidate])
        else:
            group.append(candidate)

    ranked: list[tuple[float, int, float, list[str]]] = []
    for group in groups:
        by_label: dict[str, float] = {}
        for label, _, score in group:
            by_label[label] = max(score, by_label.get(label, 0.0))
        max_index = max((LABELS.index(label) for label in by_label), default=-1)
        if max_index < 1:
            continue
        expected = LABELS[: max_index + 1]
        present = [label for label in expected if label in by_label]
        confidence = (
            sum(by_label[label] for label in present) / len(present)
        ) * (len(present) / len(expected))
        ranked.append((confidence * len(present), len(expected), confidence, present))

    if not ranked:
        return {"count": None, "labels": [], "confidence": 0.0, "complete": False}
    _, count, confidence, labels = max(ranked, key=lambda item: item[0])
    # A second column may hold C/D while the first column holds A/B. The
    # strongest aligned group alone would otherwise look like a complete
    # two-choice question. Surface the extra labels as uncertain evidence.
    outside_labels = {
        label
        for label, _, score in candidates
        if score >= 0.82 and LABELS.index(label) >= count
    }
    if outside_labels:
        all_labels = sorted(set(labels) | outside_labels, key=LABELS.index)
        return {
            "count": LABELS.index(all_labels[-1]) + 1,
            "labels": all_labels,
            "confidence": round(min(confidence, 0.5), 4),
            "complete": False,
        }
    return {
        "count": count,
        "labels": labels,
        "confidence": round(min(confidence, 0.99), 4),
        "complete": len(labels) == count,
    }
