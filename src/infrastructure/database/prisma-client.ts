import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { env } from '../../shared/config/env.js';

// Prisma derives the supported $on event types from the constructor options.
// An explicit broad PrismaClient return type would erase those event types.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,

    log: [
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
    ],
  });
};

export type ApplicationPrismaClient = ReturnType<typeof createPrismaClient>;
