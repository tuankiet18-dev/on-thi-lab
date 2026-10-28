# Debian base (not the AWS Amazon Linux image) because Tesseract is not packaged for Amazon Linux.
FROM python:3.11-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr wamerican ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# tessdata_best (LSTM) is noticeably more accurate than the packaged "fast" model on small screenshot text.
RUN mkdir -p /opt/tessdata \
    && curl -fsSL -o /opt/tessdata/eng.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/4.1.0/eng.traineddata

WORKDIR /var/task
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the PP-OCR Latin model at build time (RapidOCR fetches lazily, on the first recognition) so the Lambda never needs the network.
RUN python -c "import numpy as np; from rapidocr import LangRec, ModelType, OCRVersion, RapidOCR; e = RapidOCR(params={'Rec.lang_type': LangRec.LATIN, 'Rec.ocr_version': OCRVersion.PPOCRV5, 'Rec.model_type': ModelType.MOBILE}); e(np.full((32, 200, 3), 255, np.uint8), use_det=False, use_cls=False, use_rec=True)" \
    && ls /usr/local/lib/python3.11/site-packages/rapidocr/models/latin_PP-OCRv5_rec_mobile.onnx

COPY blocks.py gate.py readers.py handler.py ./
ENV TESSDATA_PREFIX=/opt/tessdata OMP_THREAD_LIMIT=1
ENTRYPOINT ["python", "-m", "awslambdaric"]
CMD ["handler.lambda_handler"]
