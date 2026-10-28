import shutil
import unittest
from unittest import mock

from PIL import Image, ImageDraw, ImageFont

import blocks
import handler
import readers

FONT = ImageFont.load_default(size=22)


def question_image(extra=None, blank=False):
    image = Image.new("RGB", (1400, 420), "white")
    draw = ImageDraw.Draw(image)
    if blank:
        draw.text((60, 30), "Which of the following is", fill="black", font=FONT)
        draw.line((330, 46, 390, 46), fill="black", width=2)
        draw.text((410, 30), "a database object?", fill="black", font=FONT)
    else:
        draw.text((60, 30), "Which of the following is a database object?", fill="black", font=FONT)
    for i, text in enumerate(["A. Table", "B. Index", "C. Column", "D. Row"]):
        draw.text((60, 90 + 55 * i), text, fill="black", font=FONT)
    if extra:
        draw.text((900, 120), extra, fill="black", font=FONT)
    return image


class LocateTests(unittest.TestCase):
    def test_locates_stem_and_four_options(self):
        located = blocks.locate(question_image())
        self.assertEqual(len(located.boxes), 5)
        self.assertEqual(located.extra_ink, 0)
        self.assertFalse(located.has_blank)

    def test_formula_region_beside_text_counts_as_extra_ink(self):
        located = blocks.locate(question_image(extra="f(x) = x^2 + 1"))
        self.assertGreater(located.extra_ink, 150)

    def test_diagram_below_the_options_counts_as_extra_ink(self):
        image = Image.new("RGB", (1400, 640), "white")
        image.paste(question_image(), (0, 0))
        draw = ImageDraw.Draw(image)
        for row in (330, 440, 550):  # a tree-like diagram: outlined, labelled nodes
            for x in (80, 260, 440):
                draw.ellipse((x, row, x + 130, row + 80), outline="black", width=4)
                draw.text((x + 50, row + 28), "30", fill="black", font=FONT)
        self.assertGreater(blocks.locate(image).extra_ink, 150)

    def test_blank_line_detected(self):
        self.assertTrue(blocks.locate(question_image(blank=True)).has_blank)


@unittest.skipUnless(shutil.which(readers.TESSERACT), "tesseract not installed")
class HandlerTests(unittest.TestCase):
    def test_synthetic_question_is_read_and_approved(self):
        result = handler.recognise(question_image())
        self.assertEqual(result["status"], "approved")
        self.assertEqual(result["textContent"], "Which of the following is a database object?")
        self.assertEqual(result["options"], ["Table", "Index", "Column", "Row"])

    def test_formula_beside_text_stays_an_image(self):
        result = handler.recognise(question_image(extra="f(x) = x^2 + 1"))
        self.assertEqual(result["status"], "needs_review")
        self.assertIn("extra_content", result["flagReasons"])

    def test_unreadable_image_needs_review(self):
        with mock.patch.object(handler, "_image", side_effect=RuntimeError("boom")):
            result = handler.lambda_handler({"key": "x"}, None)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["flagReasons"], ["ocr_error"])

    def test_blank_page_needs_review_without_text(self):
        with mock.patch.object(handler, "_image", return_value=Image.new("RGB", (800, 300), "white")):
            result = handler.lambda_handler({"key": "x"}, None)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["textContent"], "")


if __name__ == "__main__":
    unittest.main()
