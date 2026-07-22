import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

import type {
  Metrics,
  ObserveDatabaseQueryInput,
  RecordHttpRequestInput,
  RedisConnectionState,
} from '@/application/ports/observability/metrics.js';

const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const DATABASE_DURATION_BUCKETS = [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

const REDIS_CONNECTION_STATES: RedisConnectionState[] = [
  'connecting',
  'ready',
  'reconnecting',
  'disconnected',
];

export interface PrometheusMetricsOptions {
  serviceName: string;
  collectProcessMetrics?: boolean;
}

function normalizeMetricLabel(value: string, fallback: string): string {
  const normalizedValue = value.trim();

  return normalizedValue.length === 0 ? fallback : normalizedValue;
}

export class PrometheusMetrics implements Metrics {
  private readonly registry: Registry;

  private readonly activeHttpRequests: Gauge;

  private readonly httpRequestsTotal: Counter;

  private readonly httpRequestDurationSeconds: Histogram;

  private readonly databaseQueryDurationSeconds: Histogram;

  private readonly databaseErrorsTotal: Counter;

  private readonly redisConnectionState: Gauge;

  private readonly redisErrorsTotal: Counter;

  public constructor(options: PrometheusMetricsOptions) {
    const serviceName = options.serviceName.trim();

    if (serviceName.length === 0) {
      throw new RangeError('Metrics service name must not be empty');
    }

    this.registry = new Registry();

    this.registry.setDefaultLabels({
      service: serviceName,
    });

    if (options.collectProcessMetrics !== false) {
      collectDefaultMetrics({
        register: this.registry,
        prefix: 'authentication_service_process_',
      });
    }

    this.activeHttpRequests = new Gauge({
      name: 'authentication_service_http_active_requests',
      help: 'Number of HTTP requests currently being processed',
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: 'authentication_service_http_requests_total',
      help: 'Total number of completed HTTP requests',
      labelNames: ['method', 'route', 'status_code'] as const,
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'authentication_service_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'] as const,
      buckets: HTTP_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.databaseQueryDurationSeconds = new Histogram({
      name: 'authentication_service_database_query_duration_seconds',
      help: 'Prisma database query duration in seconds',
      labelNames: ['target'] as const,
      buckets: DATABASE_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.databaseErrorsTotal = new Counter({
      name: 'authentication_service_database_errors_total',
      help: 'Total number of Prisma database errors',
      registers: [this.registry],
    });

    this.redisConnectionState = new Gauge({
      name: 'authentication_service_redis_connection_state',
      help: 'Current Redis connection state represented as one-hot labels',
      labelNames: ['state'] as const,
      registers: [this.registry],
    });

    this.redisErrorsTotal = new Counter({
      name: 'authentication_service_redis_errors_total',
      help: 'Total number of Redis client errors',
      registers: [this.registry],
    });

    this.setRedisConnectionState('disconnected');
  }

  public incrementActiveHttpRequests(): void {
    this.activeHttpRequests.inc();
  }

  public decrementActiveHttpRequests(): void {
    this.activeHttpRequests.dec();
  }

  public recordHttpRequest(input: RecordHttpRequestInput): void {
    const labels = {
      method: normalizeMetricLabel(input.method.toUpperCase(), 'UNKNOWN'),

      route: normalizeMetricLabel(input.route, 'UNMATCHED'),

      status_code: String(input.statusCode),
    };

    this.httpRequestsTotal.inc(labels);

    this.httpRequestDurationSeconds.observe(labels, input.durationSeconds);
  }

  public observeDatabaseQuery(input: ObserveDatabaseQueryInput): void {
    this.databaseQueryDurationSeconds.observe(
      {
        target: normalizeMetricLabel(input.target, 'unknown'),
      },
      input.durationSeconds,
    );
  }

  public recordDatabaseError(): void {
    this.databaseErrorsTotal.inc();
  }

  public setRedisConnectionState(state: RedisConnectionState): void {
    for (const candidateState of REDIS_CONNECTION_STATES) {
      this.redisConnectionState.set(
        {
          state: candidateState,
        },
        candidateState === state ? 1 : 0,
      );
    }
  }

  public recordRedisError(): void {
    this.redisErrorsTotal.inc();
  }

  public getContentType(): string {
    return this.registry.contentType;
  }

  public render(): Promise<string> {
    return this.registry.metrics();
  }
}
