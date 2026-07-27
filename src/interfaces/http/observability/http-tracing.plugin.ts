import { SpanStatusCode, trace, type Span, type SpanContext } from '@opentelemetry/api';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

const requestSpans = new WeakMap<FastifyRequest, Span>();

function resolveRoute(request: FastifyRequest): string {
  const route = request.routeOptions.url;

  if (route === undefined || route.trim().length === 0) {
    return 'UNMATCHED';
  }

  return route;
}

function isValidSpanContext(spanContext: SpanContext): boolean {
  return (
    spanContext.traceId !== '00000000000000000000000000000000' &&
    spanContext.spanId !== '0000000000000000'
  );
}

const httpTracingPluginImplementation: FastifyPluginCallback = (fastify, _options, done): void => {
  fastify.addHook('onRequest', (request, reply, hookDone): void => {
    const span = trace.getActiveSpan();

    if (span === undefined) {
      hookDone();

      return;
    }

    const spanContext = span.spanContext();

    if (!isValidSpanContext(spanContext)) {
      hookDone();

      return;
    }

    requestSpans.set(request, span);

    reply.header('x-trace-id', spanContext.traceId);

    hookDone();
  });

  fastify.addHook('onResponse', (request, reply, hookDone): void => {
    const span = requestSpans.get(request);

    if (span === undefined) {
      hookDone();

      return;
    }

    requestSpans.delete(request);

    const route = resolveRoute(request);

    span.updateName(`${request.method} ${route}`);

    span.setAttribute('http.route', route);

    if (reply.statusCode >= 500) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
      });
    }

    const spanContext = span.spanContext();

    request.log.info(
      {
        traceId: spanContext.traceId,

        spanId: spanContext.spanId,

        route,

        method: request.method,

        statusCode: reply.statusCode,
      },
      'HTTP request trace completed',
    );

    hookDone();
  });

  done();
};

export const httpTracingPlugin = fastifyPlugin(httpTracingPluginImplementation, {
  name: 'http-tracing-plugin',
});
