import { UserRepository } from '@/application/ports/repositories/user.repository.js';
import { ApplicationPrismaClient } from '../prisma-client.js';
import { PrismaUserMapper } from '../mapper/prisma-user.mapper.js';
import { User } from '@/domain/users/entities/user.entity.js';
import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';

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

    return record === null ? null : PrismaUserMapper.toDomain(record);
  }

  public async findByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: {
        normalizedEmail,
        deletedAt: null,
      },
    });

    return record === null ? null : PrismaUserMapper.toDomain(record);
  }

  public async existsByNormalizedEmail(normalizedEmail: string): Promise<boolean> {
    const userCount = await this.prisma.user.count({
      where: {
        normalizedEmail,
        deletedAt: null,
      },
    });

    return userCount > 0;
  }

  public async create(user: User): Promise<void> {
    const data = PrismaUserMapper.toCreateData(user);

    await this.prisma.user.create({
      data,
    });
  }

  public async update(user: User, expectedVersion: number): Promise<void> {
    const data = PrismaUserMapper.toUpdateData(user);

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
