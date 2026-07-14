import type { PasswordHasher } from '../../application/ports/crypto/password-hasher.js';
import type { Clock } from '../../application/ports/system/clock.js';
import type { IdGenerator } from '../../application/ports/system/id-generator.js';

import { createRedisClient, type ApplicationRedisClient } from '../cache/redis-client.js';
import { BcryptPasswordHasher } from '../crypto/bcrypt-password-hasher.js';
import { createPrismaClient, type ApplicationPrismaClient } from '../database/prisma-client.js';
import { CryptoIdGenerator } from '../system/crypto-id-generator.js';
import { SystemClock } from '../system/system-clock.js';

export interface InfrastructureContainer {
  prisma: ApplicationPrismaClient;
  redis: ApplicationRedisClient;
  passwordHasher: PasswordHasher;
  clock: Clock;
  idGenerator: IdGenerator;
}

export function createInfrastructureContainer(): InfrastructureContainer {
  return {
    prisma: createPrismaClient(),
    redis: createRedisClient(),
    passwordHasher: new BcryptPasswordHasher(),
    clock: new SystemClock(),
    idGenerator: new CryptoIdGenerator(),
  };
}
