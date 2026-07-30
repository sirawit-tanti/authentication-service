import { INVALID_SPAN_CONTEXT, TraceFlags, type SpanContext } from '@opentelemetry/api';

import {
  createTraceLogBindings,
  getTraceLogBindings,
} from '@/shared/logging/trace-log-correlation.js';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

const SPAN_ID = '00f067aa0ba902b7';

describe('Trace log correlation', () => {
  it('returns no correlation fields without an active span', () => {
    expect(createTraceLogBindings()).toEqual({});
  });

  it('returns no correlation fields for an undefined span context', () => {
    expect(getTraceLogBindings(undefined)).toEqual({});
  });

  it('returns no correlation fields for an invalid span context', () => {
    expect(getTraceLogBindings(INVALID_SPAN_CONTEXT)).toEqual({});
  });

  it('returns trace and span identifiers for a sampled context', () => {
    const spanContext: SpanContext = {
      traceId: TRACE_ID,

      spanId: SPAN_ID,

      traceFlags: TraceFlags.SAMPLED,
    };

    expect(getTraceLogBindings(spanContext)).toEqual({
      traceId: TRACE_ID,

      spanId: SPAN_ID,

      traceSampled: true,
    });
  });

  it('marks a valid non-sampled context as not sampled', () => {
    const spanContext: SpanContext = {
      traceId: TRACE_ID,

      spanId: SPAN_ID,

      traceFlags: TraceFlags.NONE,
    };

    expect(getTraceLogBindings(spanContext)).toEqual({
      traceId: TRACE_ID,

      spanId: SPAN_ID,

      traceSampled: false,
    });
  });
});
