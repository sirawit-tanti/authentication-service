import { type Attributes } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

export interface StartTracingOptions {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: 'development' | 'test' | 'production';
  exporterEndpoint: string;
  samplingRatio: number;
}

export interface TracingRuntime {
  enabled: boolean;

  shutdown(): Promise<void>;
}

function isIgnoredIncomingRequest(url: string | undefined): boolean {
  if (url === undefined) {
    return false;
  }

  return url.startsWith('/metrics') || url.startsWith('/docs/static/');
}

function validateOptions(options: StartTracingOptions): void {
  if (options.serviceName.trim().length === 0) {
    throw new RangeError('Tracing service name must not be empty');
  }

  if (
    !Number.isFinite(options.samplingRatio) ||
    options.samplingRatio < 0 ||
    options.samplingRatio > 1
  ) {
    throw new RangeError('Tracing sampling ratio must be between 0 and 1');
  }

  try {
    new URL(options.exporterEndpoint);
  } catch {
    throw new RangeError('Tracing exporter endpoint must be a valid URL');
  }
}

function createResourceAttributes(options: StartTracingOptions): Attributes {
  return {
    'service.name': options.serviceName,
    'service.version': options.serviceVersion,
    'deployment.environment.name': options.environment,
  };
}

export function startTracing(options: StartTracingOptions): TracingRuntime {
  if (!options.enabled) {
    return {
      enabled: false,

      shutdown(): Promise<void> {
        return Promise.resolve();
      },
    };
  }

  validateOptions(options);

  const traceExporter = new OTLPTraceExporter({
    url: options.exporterEndpoint,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes(createResourceAttributes(options)),

    traceExporter,

    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(options.samplingRatio),
    }),

    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook(request): boolean {
          return isIgnoredIncomingRequest(request.url);
        },
      }),
    ],
  });

  sdk.start();

  let shutdownPromise: Promise<void> | undefined;

  return {
    enabled: true,

    shutdown(): Promise<void> {
      shutdownPromise ??= sdk.shutdown();

      return shutdownPromise;
    },
  };
}

export { isIgnoredIncomingRequest };
