import unittest

from option_detector import detect_option_labels


def line(label, x=20, score=0.98):
    return ([[x, 0], [x + 10, 0], [x + 10, 10], [x, 10]], label, score)


class OptionDetectorTests(unittest.TestCase):
    def test_complete_aligned_labels(self):
        result = detect_option_labels(
            [line("A."), line("B)"), line("C:"), line("D-")], 1000
        )
        self.assertEqual(result["count"], 4)
        self.assertEqual(result["labels"], ["A", "B", "C", "D"])
        self.assertTrue(result["complete"])

    def test_missing_label_is_uncertain(self):
        result = detect_option_labels([line("A."), line("C.")], 1000)
        self.assertEqual(result["count"], 3)
        self.assertFalse(result["complete"])

    def test_no_labels(self):
        self.assertIsNone(detect_option_labels([line("question text")], 1000)["count"])

    def test_two_column_choices_are_uncertain(self):
        result = detect_option_labels(
            [line("A.", 20), line("B.", 20), line("C.", 250), line("D.", 250)],
            1000,
        )
        self.assertEqual(result["count"], 4)
        self.assertEqual(result["labels"], list("ABCD"))
        self.assertFalse(result["complete"])


if __name__ == "__main__":
    unittest.main()
