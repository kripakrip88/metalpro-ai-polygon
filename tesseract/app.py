import io
import time
import pytesseract
from fastapi import FastAPI, File, UploadFile, HTTPException
from pdf2image import convert_from_bytes
from PIL import Image

app = FastAPI()

LANG = "rus+eng"


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    start = time.time()

    try:
        if file.filename and file.filename.lower().endswith(".pdf"):
            images = convert_from_bytes(content, dpi=300)
        else:
            images = [Image.open(io.BytesIO(content))]
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to decode file: {e}")

    texts = []
    confidences = []

    for image in images:
        data = pytesseract.image_to_data(
            image, lang=LANG, output_type=pytesseract.Output.DICT
        )
        page_text = pytesseract.image_to_string(image, lang=LANG)
        texts.append(page_text)

        page_confs = [c for c in data["conf"] if isinstance(c, (int, float)) and c >= 0]
        if page_confs:
            confidences.append(sum(page_confs) / len(page_confs))

    duration_ms = int((time.time() - start) * 1000)
    avg_confidence = round(sum(confidences) / len(confidences), 2) if confidences else 0.0

    return {
        "text": "\n\n".join(texts),
        "confidence": avg_confidence,
        "page_count": len(images),
        "duration_ms": duration_ms,
        "language": LANG,
        "engine": "tesseract",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
