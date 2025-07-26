FROM python:3.13.5-slim-bookworm

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Chinese language support with comprehensive font installation
RUN apt-get update && apt-get install -y \
    fontconfig \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    fonts-arphic-ukai \
    fonts-arphic-uming \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Rebuild font cache
RUN fc-cache -fv

# List available fonts for debugging
RUN fc-list :lang=zh

CMD ["python", "-u", "src/app.py"]