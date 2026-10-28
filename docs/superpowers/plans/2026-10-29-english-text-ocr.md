# English Text OCR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** English question images become text when two independent readers agree and structure is clean; all else stays an image; Textract is removed.

**Architecture:** A stateless Python Lambda (`TextOcrFunction`) reads an S3 image and returns `{status,textContent,options,flagReasons,confidence}`. The existing Node worker keeps claim/cache/save/retry and calls it via `lambda:Invoke` in place of Textract.

**Tech Stack:** Python 3.11 on Debian (apt Tesseract 5 + `eng` data), RapidOCR (ONNX, PP-OCR Latin), OpenCV, TypeScript worker, AWS CDK.

**Spec:** `docs/superpowers/specs/2026-10-29-english-text-ocr-design.md`

## Global Constraints
- `providerVersion` for new results: `tesseract-paddle@2026-10`; old Textract versions stay readable in `ocrJobSchema`.
- English only; any Vietnamese diacritic or non-Latin letter => `needs_review` with flag `non_english`.
- Options must be 2..6; otherwise `needs_review`.
- No DB or write permission for the Python Lambda; read-only S3.
- Do not rename DB columns, CDK construct IDs, or HTTP contracts (AGENTS.md). Worker stays arm64.
- Verification before handoff: `pnpm validate`; Python `python3 -m unittest` in `apps/text-ocr-worker`.

## Review Focus
- Fill-in-the-blank `____` question: must stay image.
- Formula/`(See picture)` region beside the text: must stay image.
- `I`/`l` ambiguity in names (`FileInputStream`, `AI`): must stay image.
- Vietnamese or mixed-language question: must stay image.
- Lambda invoke error/timeout: question must fall back to existing retry/DLQ, never save text.

---

### Task 1: Python gate (pure text logic)
**Files:** Create `apps/text-ocr-worker/gate.py`, `apps/text-ocr-worker/test_gate.py`
**Interfaces:** Produces `parse_structure(lines: list[str]) -> tuple[str, list[str]] | None`; `decide(readings: dict[str, list[str]], extra_ink: int, has_blank: bool) -> dict` returning `{"status","textContent","options","flagReasons","confidence"}`; `unknown_tokens(text) -> list[str]`.
- [ ] Step 1: tests `test_agreeing_clean_question_is_approved`, `test_disagreement_needs_review`, `test_blank_needs_review`, `test_extra_content_needs_review`, `test_camelcase_il_needs_review`, `test_vietnamese_flagged_non_english`, `test_one_option_needs_review`, `test_seven_options_needs_review`, `test_label_only_lines_not_options`.
- [ ] Step 2: run `python3 -m unittest test_gate` -> fails (module missing).
- [ ] Step 3: implement from the validated spike logic (`~/onthilab-ocr-work/{twoengine,pipeline_final,postproc}.py`): strict A..F label parse, per-field exact agreement of both readers, dictionary check (`wamerican`) with unanimity for unknown words, I/l guards, `extra_ink > 150`, blank flag.
- [ ] Step 4: run tests -> pass. Step 5: commit `feat(ocr): add English text approval gate`.

### Task 2: Image blocks and readers
**Files:** Create `apps/text-ocr-worker/blocks.py`, `readers.py`, `handler.py`, `test_blocks.py`; Modify none.
**Interfaces:** Consumes `gate.decide`. Produces `blocks.locate(image: PIL.Image) -> Located` (`blocks: list[Box]`, `extra_ink: int`, `has_blank: bool`); `readers.read_tesseract(image, box) -> str`, `readers.read_rapidocr(image, box) -> str`; `handler.lambda_handler(event, context) -> dict` with `event = {"key": str}` reading `QUESTION_IMAGE_BUCKET`.
- [ ] Step 1: tests `test_locates_stem_and_four_options` and `test_formula_region_beside_text_counts_as_extra_ink` and `test_blank_line_detected` using PIL-drawn images (skip Tesseract-dependent ones when `tesseract` is absent); `test_handler_returns_needs_review_for_unreadable_image` with a fake S3 body.
- [ ] Step 2: run -> fail. Step 3: port `find_blocks`, `merge_line_pieces`, `panel_blocks`, `extra_beside`, `has_blank` from `~/onthilab-ocr-work/{ocrlib,pipeline_final}.py`; handler reads S3 object, runs both readers per block, calls `decide`, returns JSON; any exception => `needs_review` with flag `ocr_error`.
- [ ] Step 4: run -> pass. Step 5: commit `feat(ocr): add text OCR Lambda handler`.

### Task 3: Container image and golden check
**Files:** Create `apps/text-ocr-worker/Dockerfile`, `requirements.txt`, `.dockerignore`
- [ ] Step 1: Dockerfile: `python:3.11-slim-bookworm`, apt `tesseract-ocr tesseract-ocr-eng wamerican libgl1`, `pip install awslambdaric` + requirements (`rapidocr-onnxruntime==1.4.4`, `numpy==1.26.4`, `opencv-python-headless`, `Pillow`, `boto3`), `ENTRYPOINT ["python","-m","awslambdaric"]`, `CMD ["handler.lambda_handler"]`.
- [ ] Step 2: `docker build`; run the container on the English golden images (`~/onthilab-ocr-work/golden*`, outside the repo) through a local script; expected: 0 non-text approved, every approved question exactly right, approval count within 5 of the spike (37 of 99).
- [ ] Step 3: commit `feat(ocr): add text OCR container image`.

### Task 4: Node worker uses the Lambda
**Files:** Modify `apps/worker/src/ocr-processor.ts`, `ocr-processor.test.ts`, `lambda.ts`, `package.json`, `apps/api/src/ocr-service.ts`; Delete `ocr-classification*.ts`, `ocr-text-normalizer*.ts`.
**Interfaces:** Produces `TextOcrClient { read(imageKey: string): Promise<TextOcrResult> }` and `TextOcrResult = { status: "approved" | "needs_review"; textContent: string; options: string[]; flagReasons: string[]; confidence: number }`; `OcrProcessorDependencies { repository; ocr: TextOcrClient }`; `LambdaTextOcrClient` in `lambda.ts` (`InvokeCommand`, throws on `FunctionError`).
- [ ] Step 1: replace tests: `saves approved text from the OCR result`, `saves needs_review result without text claims`, `does not call OCR for a stale job`, `does not call OCR when the revision switched back to images`, `marks failed and rethrows when OCR throws`, `rejects providerVersion textract only when unknown` (new version accepted).
- [ ] Step 2: run `pnpm --filter @onthilab/worker test` -> fail. Step 3: implement; add `tesseract-paddle@2026-10` to `ocrJobSchema`; API sends the new version; remove `sharp`, `@aws-sdk/client-textract`, add `@aws-sdk/client-lambda`; update lockfile.
- [ ] Step 4: `pnpm --filter @onthilab/worker test`, `pnpm --filter @onthilab/api test`, typecheck -> pass. Step 5: commit `feat(ocr): use text OCR Lambda instead of Textract`.

### Task 5: CDK and docs
**Files:** Modify `infra/lib/onthilab-stack.ts`, `docs/aws-architecture.md`, `README.md`, `docs/architecture.md`
- [ ] Step 1: add `TextOcrFunction` (`DockerImageFunction`, x86_64, 2048 MB, 90 s, read-only grant on the question image bucket, own log group, retention like others); worker env `TEXT_OCR_FUNCTION_NAME`; grant worker `invoke`; remove `textract:DetectDocumentText` and the `sharp` install hook; no construct IDs renamed.
- [ ] Step 2: `pnpm --filter infra synth`-equivalent (`pnpm exec cdk diff OnThiLab-prod` with the deploy.sh context); expected: only additions for TextOcr, worker code/env/policy changes, textract statement removed.
- [ ] Step 3: update docs (Textract removed, new Lambda, English-only rule, fallback). Step 4: `pnpm validate`. Step 5: commit `feat(infra): add text OCR Lambda and drop Textract`.

### Task 6: Handoff
- [ ] Push branch, open PR with measured results and the open risks; deploy only after the user confirms.

## Self-review
Spec coverage: gate (T1), Lambda + blocks/readers (T2), image + golden check (T3), worker swap + providerVersion + Textract removal (T4), CDK/IAM/docs (T5), rollout (T6). Types: `TextOcrResult` fields match the Lambda JSON in T2.
