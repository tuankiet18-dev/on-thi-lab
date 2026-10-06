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
        self.writes = []

    def transaction(self):
        return contextlib.nullcontext()

    def execute(self, statement, parameters):
        if statement.strip().startswith("SELECT"):
            return FakeCursor(self.row)
        self.writes.append((statement, parameters))
        return FakeCursor(None)

    @property
    def update(self):
        return self.writes[0][1] if self.writes else None

    def check(self):
        return json.loads(self.writes[0][1][0])

    def option_writes(self):
        return [w for w in self.writes if "SET options" in w[0]]

    def ai_patch(self):
        for statement, parameters in self.writes:
            if "ai_metadata" in statement:
                return json.loads(parameters[0])
        return None


def detection(labels, confidence=0.95, complete=True):
    return {
        "count": len(labels),
        "labels": list(labels),
        "confidence": confidence,
        "complete": complete,
    }


COMMUNITY = {
    "status": "suggested",
    "provider": "community-comments",
    "proposedAnswers": [1],
    "requiresReview": False,
}


class ApplyResultTests(unittest.TestCase):
    def test_matching_count_is_confirmed_without_rewriting_options(self):
        connection = FakeConnection((list("ABCDE"), [2], PENDING, "draft", None))
        _apply_result(connection, JOB, detection("ABCDE"))
        self.assertEqual(connection.check()["status"], "confirmed")
        self.assertEqual(connection.option_writes(), [])

    def test_trusted_ocr_updates_options_when_no_answer_is_saved(self):
        for saved, found in [("ABCD", "ABCDE"), ("ABCD", "AB"), ("ABCD", "ABCDEF")]:
            with self.subTest(saved=saved, found=found):
                connection = FakeConnection((list(saved), [], PENDING, "draft", None))
                _apply_result(connection, JOB, detection(found))
                self.assertEqual(connection.check()["status"], "confirmed")
                writes = connection.option_writes()
                self.assertEqual(len(writes), 1)
                self.assertEqual(json.loads(writes[0][1][0]), list(found))

    def test_saved_answer_is_never_rewritten_by_ocr(self):
        connection = FakeConnection((list("ABCD"), [0], PENDING, "draft", None))
        _apply_result(connection, JOB, detection("ABCDE"))
        self.assertEqual(connection.check()["status"], "conflict")
        self.assertEqual(connection.option_writes(), [])

    def test_answer_outside_detected_count_preserves_options(self):
        connection = FakeConnection((list("ABCDE"), [4], PENDING, "draft", None))
        _apply_result(connection, JOB, detection("ABCD", 0.98))
        self.assertEqual(connection.check()["status"], "conflict")
        self.assertEqual(connection.option_writes(), [])

    def test_suggested_answer_outside_detected_count_preserves_options(self):
        connection = FakeConnection(
            (list("ABCDE"), [], PENDING, "draft", {"proposedAnswers": [4]})
        )
        _apply_result(connection, JOB, detection("ABCD", 0.98))
        self.assertEqual(connection.check()["status"], "conflict")
        self.assertEqual(connection.option_writes(), [])

    def test_uncertain_or_incomplete_ocr_does_not_touch_options(self):
        for result in [
            detection("ABCDE", 0.7),
            detection("ABCDE", 0.95, complete=False),
            {"count": None, "labels": [], "confidence": 0.0, "complete": False},
        ]:
            with self.subTest(result=result):
                connection = FakeConnection((list("ABCD"), [], PENDING, "draft", None))
                _apply_result(connection, JOB, result)
                self.assertEqual(connection.check()["status"], "uncertain")
                self.assertEqual(connection.option_writes(), [])

    def test_ocr_failure_is_recorded_without_touching_options(self):
        connection = FakeConnection((list("ABCD"), [], PENDING, "draft", None))
        _apply_result(connection, JOB, None, error="boom")
        self.assertEqual(connection.check()["status"], "failed")
        self.assertEqual(connection.option_writes(), [])

    def test_trusted_ocr_records_evidence_for_community_answers(self):
        connection = FakeConnection((list("ABCD"), [], PENDING, "draft", COMMUNITY))
        _apply_result(connection, JOB, detection("ABCDE", 0.9123456))
        self.assertEqual(
            connection.ai_patch(),
            {
                "optionCount": 5,
                "optionCountConfidence": 0.9123,
                "optionCountSource": "ocr",
                "optionCountNeedsReview": False,
            },
        )

    def test_uncertain_ocr_leaves_community_evidence_untrusted(self):
        connection = FakeConnection((list("ABCD"), [], PENDING, "draft", COMMUNITY))
        _apply_result(connection, JOB, detection("ABCD", 0.5))
        self.assertIsNone(connection.ai_patch())

    def test_community_answer_beyond_ocr_count_requires_review(self):
        suggestion = {**COMMUNITY, "proposedAnswers": [4]}
        connection = FakeConnection((list("ABCDE"), [], PENDING, "draft", suggestion))
        _apply_result(connection, JOB, detection("ABCD", 0.98))
        patch = connection.ai_patch()
        self.assertTrue(patch["requiresReview"])
        self.assertIn("vượt quá", patch["disputeReason"])

    def test_non_community_suggestion_is_not_modified(self):
        suggestion = {"status": "suggested", "provider": "groq", "proposedAnswers": [1]}
        connection = FakeConnection((list("ABCD"), [], PENDING, "draft", suggestion))
        _apply_result(connection, JOB, detection("ABCDE"))
        self.assertIsNone(connection.ai_patch())

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
