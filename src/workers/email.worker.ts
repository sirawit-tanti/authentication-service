import { startTracing } from '@/infrastructure/observability/tracing.js';
import { env } from '@/shared/config/env.js';

import type { EmailWorkerRuntime } from './email-worker.runtime.js';

const APPLICATION_VERSION = '1.0.0';

const tracing = startTracing({
  enabled: env.OTEL_ENABLED,

  serviceName: env.OTEL_SERVICE_NAME,

  serviceVersion: APPLICATION_VERSION,

  environment: env.NODE_ENV,

  exporterEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,

  samplingRatio: env.OTEL_TRACES_SAMPLER_RATIO,
});

let runtime: EmailWorkerRuntime | undefined;

let shutdownPromise: Promise<void> | undefined;

async function startWorker(): Promise<void> {
  const { startEmailWorkerRuntime } = await import('./email-worker.runtime.js');

  runtime = await startEmailWorkerRuntime({
    tracingEnabled: tracing.enabled,
  });
}

function shutdown(signal: NodeJS.Signals): Promise<void> {
  shutdownPromise ??= performShutdown(signal);

  return shutdownPromise;
}

async function performShutdown(signal: NodeJS.Signals): Promise<void> {
  console.info(
    JSON.stringify({
      level: 'info',
      signal,
      message: 'Email worker shutdown started',
    }),
  );

  const results = await Promise.allSettled([
    runtime?.close() ?? Promise.resolve(),

    tracing.shutdown(),
  ]);

  let shutdownFailed = false;

  for (const result of results) {
    if (result.status === 'rejected') {
      shutdownFailed = true;

      console.error(
        JSON.stringify({
          level: 'error',
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          message: 'Email worker resource shutdown failed',
        }),
      );
    }
  }

  process.exitCode = shutdownFailed ? 1 : 0;
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void startWorker().catch(async (error: unknown): Promise<void> => {
  console.error(
    JSON.stringify({
      level: 'fatal',
      error: error instanceof Error ? error.message : String(error),
      message: 'Email worker failed to start',
    }),
  );

  process.exitCode = 1;

  await Promise.allSettled([runtime?.close() ?? Promise.resolve(), tracing.shutdown()]);
});
