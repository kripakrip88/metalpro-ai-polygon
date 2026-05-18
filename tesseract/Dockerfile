FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-rus \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir fastapi uvicorn pytesseract pdf2image pillow python-multipart

WORKDIR /app
COPY app.py .

EXPOSE 8868
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8868"]
