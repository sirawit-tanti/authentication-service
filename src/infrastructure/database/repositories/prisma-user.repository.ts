import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import type { UserRepository } from '@/application/ports/repositories/user.repository.js';
import type { User } from '@/domain/users/entities/user.entity.js';
import {
  mapPrismaUserToDomain,
  mapUserToPrismaCreateData,
  mapUserToPrismaUpdateData,
} from '../mapper/prisma-user.mapper.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

export class PrismaUserRepository implements UserRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findById(userId: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    return record === null ? null : mapPrismaUserToDomain(record);
  }

  public async findByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: {
        normalizedEmail,
        deletedAt: null,
      },
    });

    return record === null ? null : mapPrismaUserToDomain(record);
  }

  public async existsByNormalizedEmail(normalizedEmail: string): Promise<boolean> {
    const record = await this.prisma.user.findFirst({
      where: {
        normalizedEmail,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return record !== null;
  }

  public async create(user: User): Promise<void> {
    const data = mapUserToPrismaCreateData(user);

    await this.prisma.user.create({
      data,
    });
  }

  public async update(user: User, expectedVersion: number): Promise<void> {
    const data = mapUserToPrismaUpdateData(user);

    const result = await this.prisma.user.updateMany({
      where: {
        id: user.getId(),
        version: expectedVersion,
        deletedAt: null,
      },
      data,
    });

    if (result.count === 0) {
      throw new OptimisticConcurrencyError('User', user.getId());
    }
  }
}
