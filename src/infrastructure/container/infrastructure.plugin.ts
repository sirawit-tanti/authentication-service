import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import type { InfrastructureContainer } from './infrastructure-container.js';
import { env } from '@/shared/config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    infrastructure: InfrastructureContainer;
  }
}

interface InfrastructurePluginOptions {
  container: InfrastructureContainer;
}

function registerPrismaLogging(fastify: FastifyInstance, container: InfrastructureContainer): void {
  container.prisma.$on('query', (event) => {
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
    fastify.log.error(
      {
        databaseMessage: event.message,
        target: event.target,
      },
      'Prisma error',
    );
  });
}

function registerRedisLogging(fastify: FastifyInstance, container: InfrastructureContainer): void {
  container.redis.on('connect', () => {
    fastify.log.debug('Redis TCP connection established');
  });

  container.redis.on('ready', () => {
    fastify.log.debug('Redis connection is ready');
  });

  container.redis.on('reconnecting', (delayMilliseconds: number) => {
    fastify.log.warn(
      {
        delayMilliseconds,
      },
      'Redis connection is reconnecting',
    );
  });

  container.redis.on('close', () => {
    fastify.log.warn('Redis connection closed');
  });

  container.redis.on('end', () => {
    fastify.log.warn('Redis connection is retry strategy ended');
  });

  container.redis.on('error', (error: Error) => {
    fastify.log.error(
      {
        error,
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
  const { container } = options;

  registerPrismaLogging(fastify, container);
  registerRedisLogging(fastify, container);

  try {
    await container.prisma.$connect();
    fastify.log.info('PostgreSQL connection established');

    await container.redis.connect();

    const pingResponse = await container.redis.ping();

    if (pingResponse !== 'PONG') {
      throw new Error(`Unexpected Redis Ping response: ${pingResponse}`);
    }
  } catch (error: unknown) {
    await Promise.allSettled([container.prisma.$disconnect(), closeRedisConnection(container)]);

    throw error;
  }

  fastify.decorate('infrastructure', container);

  fastify.addHook('onClose', async () => {
    const closeResults = await Promise.allSettled([
      container.prisma.$disconnect(),
      closeRedisConnection(container),
    ]);

    for (const result of closeResults) {
      if (result.status === 'rejected') {
        fastify.log.error(
          {
            error: result.reason,
          },
          'Failed to close an infrastructure connection',
        );
      }
    }
  });

  fastify.log.info('Infrastructure dependencies initialized');
}

export const infrastructurePlugin = fastifyPlugin(infrastructurePluginImplementation, {
  name: 'infrastructure',
});
