import { context, propagation } from '@opentelemetry/api';

import {
  captureTraceContext,
  extractTraceContext,
} from '../../../src/infrastructure/observability/trace-operation.js';

describe('Trace operation context', () => {
  it('does not create a fake carrier without an active trace', () => {
    expect(captureTraceContext()).toBeUndefined();
  });

  it('accepts an empty trace carrier', () => {
    const extractedContext = extractTraceContext({});

    expect(extractedContext).toBeDefined();

    expect(extractedContext).not.toBeNull();
  });

  it('uses the global propagator for extraction', () => {
    const extractSpy = vi.spyOn(propagation, 'extract');

    const carrier = {
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    };

    extractTraceContext(carrier);

    expect(extractSpy).toHaveBeenCalledWith(context.active(), carrier);

    extractSpy.mockRestore();
  });
});
