import contextlib
import json
import unittest

from handler import _apply_result


JOB = (
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "drafts/example/Q1.webp",
    "a" * 64,
    "2026-10-05T00:00:00.000Z",
)
PENDING = {"status": "pending", "queuedAt": JOB[4]}


class FakeCursor:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, row):
        self.row = row
        self.update = None
        self.update_statement = None

    def transaction(self):
        return contextlib.nullcontext()

    def execute(self, statement, parameters):
        if statement.strip().startswith("SELECT"):
            return FakeCursor(self.row)
        self.update = parameters
        self.update_statement = statement
        return FakeCursor(None)


class ApplyResultTests(unittest.TestCase):
    def test_matching_count_is_confirmed_without_rewriting_options(self):
        connection = FakeConnection(
            (list("ABCDE"), [2], PENDING, "draft", None)
        )
        _apply_result(
            connection,
            JOB,
            {"count": 5, "labels": list("ABCDE"), "confidence": 0.95, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0])["status"], "confirmed")
        self.assertNotIn("SET options", connection.update_statement)

    def test_ocr_overcount_requires_review(self):
        connection = FakeConnection(
            (list("ABCD"), [0], PENDING, "draft", None)
        )
        _apply_result(
            connection,
            JOB,
            {"count": 5, "labels": list("ABCDE"), "confidence": 0.95, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0])["status"], "conflict")
        self.assertNotIn("SET options", connection.update_statement)

    def test_answer_outside_detected_count_preserves_options(self):
        connection = FakeConnection(
            (list("ABCDE"), [4], PENDING, "draft", None)
        )
        _apply_result(
            connection,
            JOB,
            {"count": 4, "labels": list("ABCD"), "confidence": 0.98, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0])["status"], "conflict")
        self.assertNotIn("SET options", connection.update_statement)

    def test_suggested_answer_outside_detected_count_preserves_options(self):
        connection = FakeConnection(
            (
                list("ABCDE"),
                [],
                PENDING,
                "draft",
                {"proposedAnswers": [4]},
            )
        )
        _apply_result(
            connection,
            JOB,
            {"count": 4, "labels": list("ABCD"), "confidence": 0.98, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0])["status"], "conflict")
        self.assertNotIn("SET options", connection.update_statement)

    def test_ocr_never_silently_shrinks_the_saved_choices(self):
        connection = FakeConnection(
            (list("ABCD"), [0], PENDING, "draft", None)
        )
        _apply_result(
            connection,
            JOB,
            {"count": 2, "labels": list("AB"), "confidence": 0.98, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0])["status"], "conflict")
        self.assertNotIn("SET options", connection.update_statement)

    def test_manual_or_published_question_is_untouched(self):
        for status, exam_status in [("manual", "draft"), ("pending", "published")]:
            with self.subTest(status=status, exam_status=exam_status):
                connection = FakeConnection(
                    (
                        list("ABCD"),
                        [0],
                        {**PENDING, "status": status},
                        exam_status,
                        None,
                    )
                )
                _apply_result(
                    connection,
                    JOB,
                    {"count": 5, "labels": list("ABCDE"), "confidence": 0.95, "complete": True},
                )
                self.assertIsNone(connection.update)

    def test_stale_job_cannot_overwrite_a_new_retry(self):
        connection = FakeConnection(
            (
                list("ABCD"),
                [0],
                {"status": "pending", "queuedAt": "2026-10-05T00:20:00.000Z"},
                "draft",
                None,
            )
        )
        _apply_result(
            connection,
            JOB,
            {"count": 4, "labels": list("ABCD"), "confidence": 0.95, "complete": True},
        )
        self.assertIsNone(connection.update)


if __name__ == "__main__":
    unittest.main()
