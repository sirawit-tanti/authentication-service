import { env } from '@/shared/config/env.js';
import type { ConnectionOptions } from 'bullmq';

interface ParsedRedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  tls?: Record<string, never>;
}

function parseRedisUrl(redisUrl: string): ParsedRedisConnection {
  const parsedUrl = new URL(redisUrl);

  const databasePath = parsedUrl.pathname.replace('/', '');

  const database = databasePath.length === 0 ? 0 : Number.parseInt(databasePath, 10);

  if (!Number.isInteger(database) || database < 0) {
    throw new Error('Redis database index is invalid');
  }

  const connection: ParsedRedisConnection = {
    host: parsedUrl.hostname,
    port: parsedUrl.port.length > 0 ? Number.parseInt(parsedUrl.port, 10) : 6379,
    db: database,
  };

  if (parsedUrl.username.length > 0) {
    connection.username = decodeURIComponent(parsedUrl.username);
  }

  if (parsedUrl.password.length > 0) {
    connection.password = decodeURIComponent(parsedUrl.password);
  }

  if (parsedUrl.protocol === 'rediss:') {
    connection.tls = {};
  }

  return connection;
}

export function createBullMqProducerConnectionOptions(): ConnectionOptions {
  return {
    ...parseRedisUrl(env.REDIS_URL),
    connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
    enableReadyCheck: true,
  };
}

export function createBullMqWorkerConnectionOptions(): ConnectionOptions {
  return {
    ...parseRedisUrl(env.REDIS_URL),
    connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}
