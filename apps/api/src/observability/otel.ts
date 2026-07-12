/**
 * OpenTelemetry bootstrap (Day 26 / PLAT-05).
 *
 * Must be imported before Nest/express/ioredis/etc. so auto-instrumentation
 * can patch those modules as they load (main.ts imports this right after
 * dotenv). Traces go to the local OTel Collector via OTLP/HTTP — sampling
 * (100% errors / 10% success) happens there, tail-based, not here, because
 * only the collector sees a finished trace and knows whether it errored.
 * Metrics are exposed on :9464/metrics for Prometheus to scrape.
 *
 * Disable entirely with OTEL_DISABLED=true (e.g. in tests).
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

export let otelSdk: NodeSDK | undefined;

if (process.env.OTEL_DISABLED !== 'true') {
  otelSdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'amdox-api',
    traceExporter: new OTLPTraceExporter({
      // OTel Collector's OTLP/HTTP receiver
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: new PrometheusExporter({
      port: Number(process.env.OTEL_METRICS_PORT || 9464),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs instrumentation is pure noise (thousands of spans per request)
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  try {
    otelSdk.start();

    console.log(
      `[otel] instrumentation started — metrics :${process.env.OTEL_METRICS_PORT || 9464}/metrics, traces → ${process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces'}`,
    );
  } catch (err) {
    // Observability must never take the API down

    console.error('[otel] failed to start instrumentation', err);
    otelSdk = undefined;
  }

  // Flush pending telemetry on shutdown (pm2 sends SIGINT on restart)
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      otelSdk
        ?.shutdown()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
  }
}
