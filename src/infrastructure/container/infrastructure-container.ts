import type { PasswordHasher } from '../../application/ports/crypto/password-hasher.js';
import type { SecureTokenService } from '../../application/ports/crypto/secure-token-service.js';
import type { Clock } from '../../application/ports/system/clock.js';
import type { IdGenerator } from '../../application/ports/system/id-generator.js';
import type { EmailQueue } from '@/application/ports/queues/email-queue.js';

import { createRedisClient, type ApplicationRedisClient } from '../cache/redis-client.js';
import { BcryptPasswordHasher } from '../crypto/bcrypt-password-hasher.js';
import { CryptoTokenService } from '../crypto/crypto-token-service.js';
import { createPrismaClient, type ApplicationPrismaClient } from '../database/prisma-client.js';
import { CryptoIdGenerator } from '../system/crypto-id-generator.js';
import { SystemClock } from '../system/system-clock.js';
import { BullMqEmailQueue } from '../queue/bullmq-email.queue.js';

export interface InfrastructureContainer {
  prisma: ApplicationPrismaClient;
  redis: ApplicationRedisClient;
  passwordHasher: PasswordHasher;
  secureTokenService: SecureTokenService;
  clock: Clock;
  idGenerator: IdGenerator;
  emailQueue: EmailQueue;
}

export function createInfrastructureContainer(): InfrastructureContainer {
  return {
    prisma: createPrismaClient(),
    redis: createRedisClient(),
    passwordHasher: new BcryptPasswordHasher(),
    secureTokenService: new CryptoTokenService(),
    clock: new SystemClock(),
    idGenerator: new CryptoIdGenerator(),
    emailQueue: new BullMqEmailQueue(),
  };
}
