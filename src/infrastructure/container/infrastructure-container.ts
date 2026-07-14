import { type ApplicationRedisClient, createRedisClient } from '../cache/redis-client.js';
import { type ApplicationPrismaClient, createPrismaClient } from '../database/prisma-client.js';

export interface InfrastructureContainer {
  prisma: ApplicationPrismaClient;
  redis: ApplicationRedisClient;
}

export function createInfrastructureContainer(): InfrastructureContainer {
  return {
    prisma: createPrismaClient(),
    redis: createRedisClient(),
  };
}
