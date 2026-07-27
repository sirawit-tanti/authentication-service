import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Context,
  type Span,
} from '@opentelemetry/api';

import type { TraceContextCarrier } from '@/application/jobs/email-job.js';

const tracer = trace.getTracer('authentication-service');

export interface TraceOperationOptions {
  name: string;
  kind?: SpanKind;
  attributes?: Attributes;
  parentContext?: Context;
}

function normalizeException(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown tracing operation error');
}

function recordOperationError(span: Span, error: unknown): void {
  const exception = normalizeException(error);

  span.recordException(exception);

  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: exception.message,
  });
}

export function captureTraceContext(): TraceContextCarrier | undefined {
  const carrier: Record<string, string> = {};

  propagation.inject(context.active(), carrier);

  const traceparent = carrier.traceparent;
  const tracestate = carrier.tracestate;

  if (traceparent === undefined && tracestate === undefined) {
    return undefined;
  }

  return {
    ...(traceparent === undefined
      ? {}
      : {
          traceparent,
        }),

    ...(tracestate === undefined
      ? {}
      : {
          tracestate,
        }),
  };
}

export function extractTraceContext(carrier: TraceContextCarrier | undefined): Context {
  if (carrier === undefined) {
    return context.active();
  }

  return propagation.extract(context.active(), carrier);
}

export function runTracedOperation<T>(
  options: TraceOperationOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const parentContext = options.parentContext ?? context.active();

  return tracer.startActiveSpan(
    options.name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,

      ...(options.attributes === undefined
        ? {}
        : {
            attributes: options.attributes,
          }),
    },
    parentContext,
    async (span): Promise<T> => {
      try {
        return await operation();
      } catch (error: unknown) {
        recordOperationError(span, error);

        throw error;
      } finally {
        span.end();
      }
    },
  );
}
