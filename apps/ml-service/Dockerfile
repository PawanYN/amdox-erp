# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the demand-forecasting ML service (FastAPI + Prophet
# + a small LSTM). Build from apps/ml-service as context (matches the
# existing docker-compose.yml build.context):
#   docker build -t amdox-ml-service .

# Pinned to the -bookworm (Debian 12) tag, not the floating `slim` tag —
# `python:3.11-slim` now resolves to Debian 13/trixie (glibc 2.41), which is
# ABI-incompatible with gcr.io/distroless/python3-debian12's glibc 2.36:
# torch's copied libstdc++.so.6 refused to load, needing GLIBC_2.38.
FROM python:3.11-slim-bookworm AS builder

# build-essential is needed at *install* time: Prophet pulls in cmdstanpy,
# which compiles the actual cmdstan binary from source on first
# `pip install` (there's no prebuilt wheel for it).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- runtime: distroless, no shell/package manager ----
FROM gcr.io/distroless/python3-debian12 AS runner
WORKDIR /app

# torch/cmdstan are native code and need libstdc++/libgomp, which the
# distroless python3 base doesn't ship (it only carries what CPython itself
# needs) — pulled from the same Debian 12 builder so the glibc ABI matches.
COPY --from=builder /usr/lib/x86_64-linux-gnu/libstdc++.so.6 /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/lib/x86_64-linux-gnu/libgomp.so.1 /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/lib/x86_64-linux-gnu/libgcc_s.so.1 /usr/lib/x86_64-linux-gnu/

# Only the venv's site-packages are copied in, not its bin/ — venv's own
# python binary there is a symlink back to the builder image's interpreter
# path, which doesn't exist in this stage. Run the distroless base's own
# python3 (also 3.11, same Debian 12 ABI) against the copied site-packages
# via PYTHONPATH instead.
COPY --from=builder --chown=nonroot:nonroot /opt/venv/lib/python3.11/site-packages /opt/venv/site-packages
COPY --chown=nonroot:nonroot main.py .

ENV PYTHONPATH="/opt/venv/site-packages"
ENV ML_MODEL_REGISTRY_DIR=/app/model_registry
# The named volume mounted at /app/model_registry inherits this directory's
# ownership from the image on first creation, so it must be nonroot-owned
# ahead of time — distroless has no shell to chown it after the fact.
COPY --chown=nonroot:nonroot --from=builder /app /app/model_registry

USER nonroot
EXPOSE 8091
ENTRYPOINT ["/usr/bin/python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8091"]
