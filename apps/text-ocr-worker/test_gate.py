import unittest

from gate import decide

STEM = "Which of the following is a database object?"
CLEAN = [STEM, "A. Table", "B. Index", "C. Column", "D. Row"]


def both(blocks, other=None):
    return {"tess": blocks, "paddle": other if other is not None else list(blocks)}


class DecideTests(unittest.TestCase):
    def test_agreeing_clean_question_is_approved(self):
        result = decide(both(CLEAN), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "approved")
        self.assertEqual(result["textContent"], STEM)
        self.assertEqual(result["options"], ["Table", "Index", "Column", "Row"])
        self.assertEqual(result["flagReasons"], [])

    def test_noise_blocks_are_ignored(self):
        noisy = ["(Choose 1 answer)", *CLEAN, "Back Next"]
        result = decide(both(noisy), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "approved")
        self.assertEqual(result["textContent"], STEM)

    def test_disagreement_needs_review(self):
        other = [*CLEAN[:2], "B. Indes", *CLEAN[3:]]
        result = decide(both(CLEAN, other), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "needs_review")
        self.assertIn("field_disagreement", result["flagReasons"])

    def test_blank_needs_review(self):
        result = decide(both(CLEAN), extra_ink=0, has_blank=True)
        self.assertEqual(result["status"], "needs_review")
        self.assertIn("blank_in_text", result["flagReasons"])

    def test_extra_content_needs_review(self):
        result = decide(both(CLEAN), extra_ink=400, has_blank=False)
        self.assertEqual(result["status"], "needs_review")
        self.assertIn("extra_content", result["flagReasons"])

    def test_camelcase_il_needs_review(self):
        blocks = [STEM, "A. FilelnputStream class", "B. BufferedReader class"]
        result = decide(both(blocks), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "needs_review")
        self.assertIn("ambiguous_il", result["flagReasons"])

    def test_vietnamese_flagged_non_english(self):
        blocks = ["Đâu là nhận định đúng về triết học?", "A. Một", "B. Hai"]
        result = decide(both(blocks), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "needs_review")
        self.assertIn("non_english", result["flagReasons"])

    def test_one_option_needs_review(self):
        result = decide(both([STEM, "A. Only one"]), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "needs_review")
        self.assertIn("no_structure", result["flagReasons"])

    def test_label_only_lines_are_not_options(self):
        blocks = [STEM, "A", "B", "C", "D"]
        result = decide(both(blocks), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "needs_review")
        self.assertIn("no_structure", result["flagReasons"])

    def test_six_options_are_allowed(self):
        blocks = [STEM, *[f"{c}. Option {c.lower()}" for c in "ABCDEF"]]
        result = decide(both(blocks), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "approved")
        self.assertEqual(len(result["options"]), 6)

    def test_unconfirmed_unknown_word_needs_review(self):
        blocks = [STEM, "A. Zzqxv table", "B. Index"]
        other = [STEM, "A. Zzqxv table", "B. Index"]
        # unknown words are only trusted when every reader agrees and the word is not letter-ambiguous
        result = decide(both(blocks, other), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "approved")
        ambiguous = [STEM, "A. Illquv table", "B. Index"]
        result = decide(both(ambiguous), extra_ink=0, has_blank=False)
        self.assertEqual(result["status"], "needs_review")


if __name__ == "__main__":
    unittest.main()
