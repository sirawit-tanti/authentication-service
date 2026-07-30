import { isSpanContextValid, trace, TraceFlags, type SpanContext } from '@opentelemetry/api';

export interface TraceLogCorrelation {
  traceId: string;
  spanId: string;
  traceSampled: boolean;
}

export type TraceLogBindings = TraceLogCorrelation | Record<string, never>;

export function getTraceLogBindings(spanContext: SpanContext | undefined): TraceLogBindings {
  if (spanContext === undefined || !isSpanContextValid(spanContext)) {
    return {};
  }

  return {
    traceId: spanContext.traceId,

    spanId: spanContext.spanId,

    traceSampled: (spanContext.traceFlags & TraceFlags.SAMPLED) !== 0,
  };
}

export function createTraceLogBindings(): TraceLogBindings {
  return getTraceLogBindings(trace.getActiveSpan()?.spanContext());
}
