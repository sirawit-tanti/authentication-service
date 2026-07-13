import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { env } from '../../shared/config/env.js';

export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,

    log:
      env.NODE_ENV === 'development'
        ? [
            {
              emit: 'event',
              level: 'query',
            },
            {
              emit: 'event',
              level: 'warn',
            },
            {
              emit: 'event',
              level: 'error',
            },
          ]
        : [
            {
              emit: 'event',
              level: 'warn',
            },
            {
              emit: 'event',
              level: 'error',
            },
          ],
  });
}

export type ApplicationPrismaClient = ReturnType<typeof createPrismaClient>;
