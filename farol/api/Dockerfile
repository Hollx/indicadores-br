FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY farol_api ./farol_api

# Usuário sem privilégios (uid 10001, dono de secrets/sa-dashboard.json na VPS);
# o histórico SQLite fica num volume em /dados.
RUN useradd --uid 10001 --create-home farol && mkdir -p /dados && chown farol /dados
USER farol

EXPOSE 8000
CMD ["uvicorn", "farol_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
