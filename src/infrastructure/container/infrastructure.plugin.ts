import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import type { Metrics } from '@/application/ports/observability/metrics.js';
import { env } from '@/shared/config/env.js';
import { isCloseableResource } from './closeable-resource.js';
import type { InfrastructureContainer } from './infrastructure-container.js';

declare module 'fastify' {
  interface FastifyInstance {
    infrastructure: InfrastructureContainer;
  }
}

interface InfrastructurePluginOptions {
  container: InfrastructureContainer;
  metrics?: Metrics;
}

function registerPrismaLogging(
  fastify: FastifyInstance,
  container: InfrastructureContainer,
  metrics: Metrics | undefined,
): void {
  container.prisma.$on('query', (event) => {
    metrics?.observeDatabaseQuery({
      target: event.target,
      durationSeconds: event.duration / 1_000,
    });

    if (env.NODE_ENV !== 'development') {
      return;
    }

    fastify.log.debug(
      {
        durationMs: event.duration,
        target: event.target,
      },
      'Database query executed',
    );
  });

  container.prisma.$on('warn', (event) => {
    fastify.log.warn(
      {
        databaseMessage: event.message,
        target: event.target,
      },
      'Prisma warning',
    );
  });

  container.prisma.$on('error', (event) => {
    metrics?.recordDatabaseError();

    fastify.log.error(
      {
        databaseMessage: event.message,
        target: event.target,
      },
      'Prisma error',
    );
  });
}

function registerRedisLogging(
  fastify: FastifyInstance,
  container: InfrastructureContainer,
  metrics: Metrics | undefined,
): void {
  container.redis.on('connect', () => {
    metrics?.setRedisConnectionState('connecting');

    fastify.log.debug('Redis TCP connection established');
  });

  container.redis.on('ready', () => {
    metrics?.setRedisConnectionState('ready');

    fastify.log.debug('Redis connection is ready');
  });

  container.redis.on('reconnecting', (delayMilliseconds: number) => {
    metrics?.setRedisConnectionState('reconnecting');

    fastify.log.warn(
      {
        delayMilliseconds,
      },
      'Redis connection is reconnecting',
    );
  });

  container.redis.on('close', () => {
    metrics?.setRedisConnectionState('disconnected');

    fastify.log.warn('Redis connection closed');
  });

  container.redis.on('end', () => {
    metrics?.setRedisConnectionState('disconnected');

    fastify.log.warn('Redis connection retry strategy ended');
  });

  container.redis.on('error', (error: Error) => {
    metrics?.recordRedisError();

    fastify.log.error(
      {
        err: error,
      },
      'Redis connection error',
    );
  });
}

async function closeRedisConnection(container: InfrastructureContainer): Promise<void> {
  const status = container.redis.status;

  if (status === 'end') {
    return;
  }

  if (status === 'wait') {
    container.redis.disconnect(false);

    return;
  }

  try {
    await container.redis.quit();
  } catch {
    container.redis.disconnect(false);
  }
}

async function infrastructurePluginImplementation(
  fastify: FastifyInstance,
  options: InfrastructurePluginOptions,
): Promise<void> {
  const { container, metrics } = options;

  registerPrismaLogging(fastify, container, metrics);

  registerRedisLogging(fastify, container, metrics);

  try {
    await container.prisma.$connect();

    fastify.log.info('PostgreSQL connection established');

    await container.redis.connect();
    await container.redis.ping();

    metrics?.setRedisConnectionState('ready');
  } catch (error: unknown) {
    metrics?.setRedisConnectionState('disconnected');

    await Promise.allSettled([container.prisma.$disconnect(), closeRedisConnection(container)]);

    throw error;
  }

  fastify.decorate('infrastructure', container);

  fastify.addHook('onClose', async (): Promise<void> => {
    const closeOperations: Promise<unknown>[] = [
      container.prisma.$disconnect(),
      closeRedisConnection(container),
    ];

    if (isCloseableResource(container.emailQueue)) {
      closeOperations.unshift(container.emailQueue.close());
    }

    const closeResults = await Promise.allSettled(closeOperations);

    metrics?.setRedisConnectionState('disconnected');

    for (const result of closeResults) {
      if (result.status === 'rejected') {
        fastify.log.error(
          {
            err: result.reason,
          },
          'Failed to close an infrastructure connection',
        );
      }
    }
  });

  fastify.log.info('Infrastructure dependencies initialized');
}

export const infrastructurePlugin = fastifyPlugin(infrastructurePluginImplementation, {
  name: 'infrastructure-plugin',
});
