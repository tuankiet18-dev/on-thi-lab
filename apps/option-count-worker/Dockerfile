FROM public.ecr.aws/lambda/python:3.11

COPY requirements.txt ${LAMBDA_TASK_ROOT}/requirements.txt
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt \
    && pip uninstall -y opencv-python \
    && pip install --no-cache-dir opencv-python-headless==4.11.0.86
COPY handler.py ${LAMBDA_TASK_ROOT}/handler.py
COPY option_detector.py ${LAMBDA_TASK_ROOT}/option_detector.py

CMD ["handler.lambda_handler"]
