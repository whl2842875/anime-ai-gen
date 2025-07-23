FROM python:3.13.5-slim-bookworm

WORKDIR /app

# Install build tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "src/app.py"]