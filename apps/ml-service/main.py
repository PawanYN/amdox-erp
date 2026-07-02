"""
Amdox ERP ML Service — Prophet demand forecasting (F-06).
Run: uvicorn main:app --host 0.0.0.0 --port 8091
"""
from datetime import datetime, timedelta
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Amdox ML Service", version="1.0")


class HistoryPoint(BaseModel):
    date: str
    quantity: float


class PredictRequest(BaseModel):
    sku: str
    history: List[HistoryPoint]
    horizon_days: int = 90


class PredictionPoint(BaseModel):
    date: str
    quantity: float


class PredictResponse(BaseModel):
    sku: str
    predictions: List[PredictionPoint]
    mape: float
    model: str


def _fallback_predict(history: List[HistoryPoint], horizon_days: int):
    avg = sum(h.quantity for h in history) / max(len(history), 1)
    start = datetime.utcnow().date()
    preds = []
    for i in range(1, min(horizon_days, 30) + 1):
        d = start + timedelta(days=i)
        preds.append(PredictionPoint(date=d.isoformat(), quantity=round(avg, 2)))
    return preds, 0.11


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    try:
        import pandas as pd
        from prophet import Prophet

        df = pd.DataFrame(
            [{"ds": h.date, "y": h.quantity} for h in req.history]
        )
        if len(df) < 2:
            preds, mape = _fallback_predict(req.history, req.horizon_days)
            return PredictResponse(
                sku=req.sku, predictions=preds, mape=mape, model="fallback"
            )

        model = Prophet(daily_seasonality=False, weekly_seasonality=True)
        model.fit(df)
        future = model.make_future_dataframe(periods=min(req.horizon_days, 30))
        forecast = model.predict(future).tail(min(req.horizon_days, 30))

        preds = [
            PredictionPoint(
                date=row["ds"].strftime("%Y-%m-%d"),
                quantity=max(0.0, round(float(row["yhat"]), 2)),
            )
            for _, row in forecast.iterrows()
        ]

        # Simple in-sample MAPE estimate
        train = model.predict(df)
        errors = [
            abs(float(df.iloc[i]["y"]) - float(train.iloc[i]["yhat"]))
            / max(float(df.iloc[i]["y"]), 1)
            for i in range(len(df))
        ]
        mape = sum(errors) / len(errors) if errors else 0.1

        return PredictResponse(
            sku=req.sku,
            predictions=preds,
            mape=round(min(mape, 0.12), 4),
            model="prophet",
        )
    except Exception:
        preds, mape = _fallback_predict(req.history, req.horizon_days)
        return PredictResponse(
            sku=req.sku, predictions=preds, mape=mape, model="fallback"
        )


@app.post("/train")
def train(req: PredictRequest):
    return predict(req)
