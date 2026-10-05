import contextlib
import json
import unittest

from handler import _apply_result


JOB = (
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "drafts/example/Q1.webp",
    "a" * 64,
)


class FakeCursor:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, row):
        self.row = row
        self.update = None

    def transaction(self):
        return contextlib.nullcontext()

    def execute(self, statement, parameters):
        if statement.strip().startswith("SELECT"):
            return FakeCursor(self.row)
        self.update = parameters
        return FakeCursor(None)


class ApplyResultTests(unittest.TestCase):
    def test_confirmed_count_updates_options(self):
        connection = FakeConnection(
            (["A", "B", "C", "D"], [2], {"status": "pending"}, "draft", None)
        )
        _apply_result(
            connection,
            JOB,
            {"count": 5, "labels": list("ABCDE"), "confidence": 0.95, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0]), list("ABCDE"))
        self.assertEqual(json.loads(connection.update[1])["status"], "confirmed")

    def test_answer_outside_detected_count_preserves_options(self):
        connection = FakeConnection(
            (list("ABCDE"), [4], {"status": "pending"}, "draft", None)
        )
        _apply_result(
            connection,
            JOB,
            {"count": 4, "labels": list("ABCD"), "confidence": 0.98, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0]), list("ABCDE"))
        self.assertEqual(json.loads(connection.update[1])["status"], "conflict")

    def test_suggested_answer_outside_detected_count_preserves_options(self):
        connection = FakeConnection(
            (
                list("ABCDE"),
                [],
                {"status": "pending"},
                "draft",
                {"proposedAnswers": [4]},
            )
        )
        _apply_result(
            connection,
            JOB,
            {"count": 4, "labels": list("ABCD"), "confidence": 0.98, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0]), list("ABCDE"))
        self.assertEqual(json.loads(connection.update[1])["status"], "conflict")

    def test_ocr_never_silently_shrinks_the_saved_choices(self):
        connection = FakeConnection(
            (list("ABCD"), [0], {"status": "pending"}, "draft", None)
        )
        _apply_result(
            connection,
            JOB,
            {"count": 2, "labels": list("AB"), "confidence": 0.98, "complete": True},
        )
        self.assertEqual(json.loads(connection.update[0]), list("ABCD"))
        self.assertEqual(json.loads(connection.update[1])["status"], "conflict")

    def test_manual_or_published_question_is_untouched(self):
        for status, exam_status in [("manual", "draft"), ("pending", "published")]:
            with self.subTest(status=status, exam_status=exam_status):
                connection = FakeConnection(
                    (list("ABCD"), [0], {"status": status}, exam_status, None)
                )
                _apply_result(
                    connection,
                    JOB,
                    {"count": 5, "labels": list("ABCDE"), "confidence": 0.95, "complete": True},
                )
                self.assertIsNone(connection.update)


if __name__ == "__main__":
    unittest.main()
