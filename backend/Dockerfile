FROM python:3.12-slim

WORKDIR /app

#this line installs tesseract ocr and the albanian language data to read scanned and photographed invoices
#this also brings english and page orientation detection, they come with tesseract itself
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc tesseract-ocr tesseract-ocr-sqi \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
