import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { createPrismaClient, type ApplicationPrismaClient } from './prisma-client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: ApplicationPrismaClient;
  }
}

async function databasePluginImplementation(fastify: FastifyInstance): Promise<void> {
  const prisma = createPrismaClient();

  prisma.$on('query', (event) => {
    fastify.log.debug(
      {
        durationMs: event.duration,
        target: event.target,
      },
      'Database query executed',
    );
  });

  prisma.$on('warn', (event) => {
    fastify.log.warn(
      {
        databaseMessage: event.message,
        target: event.target,
      },
      'Prisma warning',
    );
  });

  prisma.$on('error', (event) => {
    fastify.log.error(
      {
        databaseMessage: event.message,
        target: event.target,
      },
      'Prisma error',
    );
  });

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  fastify.log.info('PostgreSQL connection established');
}

export const databasePlugin = fastifyPlugin(databasePluginImplementation, {
  name: 'database',
});
