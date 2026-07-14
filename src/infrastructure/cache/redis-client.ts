import { env } from '@/shared/config/env.js';
import Redis, { type RedisOptions } from 'ioredis';

function calculateRetryDelay(attempNumber: number): number | null {
  const maximumRetryAttempts = 10;

  if (attempNumber > maximumRetryAttempts) {
    return null;
  }

  const baseDelayMilliseconds = 100;
  const maximumDelayMilliseconds = 2_000;

  return Math.min(attempNumber * baseDelayMilliseconds, maximumDelayMilliseconds);
}

export function createRedisClient(): Redis {
  const options: RedisOptions = {
    lazyConnect: true,

    connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,

    maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,

    enableReadyCheck: true,

    enableOfflineQueue: false,

    keyPrefix: env.REDIS_KEY_PREFIX,

    retryStrategy: calculateRetryDelay,

    reconnectOnError(error): boolean {
      const message = error.message.toUpperCase();

      return message.includes('READONLY');
    },
  };

  return new Redis(env.REDIS_URL, options);
}

export type ApplicationRedisClient = ReturnType<typeof createRedisClient>;
