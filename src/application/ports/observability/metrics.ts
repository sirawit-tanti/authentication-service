export interface RecordHttpRequestInput {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number;
}

export interface ObserveDatabaseQueryInput {
  target: string;
  durationSeconds: number;
}

export type RedisConnectionState = 'connecting' | 'ready' | 'reconnecting' | 'disconnected';

export interface Metrics {
  incrementActiveHttpRequests(): void;

  decrementActiveHttpRequests(): void;

  recordHttpRequest(input: RecordHttpRequestInput): void;

  observeDatabaseQuery(input: ObserveDatabaseQueryInput): void;

  recordDatabaseError(): void;

  setRedisConnectionState(state: RedisConnectionState): void;

  recordRedisError(): void;

  getContentType(): string;

  render(): Promise<string>;
}
