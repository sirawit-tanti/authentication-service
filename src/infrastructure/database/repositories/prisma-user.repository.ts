import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import type {
  RecordFailedLoginInput,
  UserRepository,
} from '@/application/ports/repositories/user.repository.js';
import type { User } from '@/domain/users/entities/user.entity.js';
import {
  mapPrismaUserToDomain,
  mapUserToPrismaCreateData,
  mapUserToPrismaUpdateData,
} from '../mapper/prisma-user.mapper.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const USER_RESOURCE_TYPE = 'USER';

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

  public async recordFailedLogin(input: RecordFailedLoginInput): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const userState = input.user.toState();

        const updateResult = await transaction.user.updateMany({
          where: {
            id: input.user.getId(),

            version: input.expectedVersion,

            status: 'ACTIVE',
            emailVerified: true,
            deletedAt: null,
          },

          data: {
            failedLoginAttempts: userState.failedLoginAttempts,

            lockedUntil: userState.lockedUntil,

            version: userState.version,

            updatedAt: userState.updatedAt,
          },
        });

        if (updateResult.count === 0) {
          throw new OptimisticConcurrencyError('User', input.user.getId());
        }

        await transaction.auditLog.create({
          data: {
            actorUserId: input.user.getId(),

            action: SECURITY_AUDIT_ACTIONS.LOGIN_FAILED,

            resourceType: USER_RESOURCE_TYPE,

            resourceId: input.user.getId(),

            outcome: 'FAILURE',

            createdAt: input.failedAt,

            metadata: {
              applicationId: input.applicationId,

              failedLoginAttempts: userState.failedLoginAttempts,

              accountLocked: input.accountLocked,

              ...(userState.lockedUntil === null
                ? {}
                : {
                    lockedUntil: userState.lockedUntil.toISOString(),
                  }),
            },

            errorMessage: 'Invalid login credentials',

            ...(input.requestId === undefined
              ? {}
              : {
                  requestId: input.requestId,
                }),

            ...(input.ipAddress === undefined
              ? {}
              : {
                  ipAddress: input.ipAddress,
                }),

            ...(input.userAgent === undefined
              ? {}
              : {
                  userAgent: input.userAgent,
                }),
          },
        });

        if (input.accountLocked) {
          await transaction.auditLog.create({
            data: {
              actorUserId: input.user.getId(),

              action: SECURITY_AUDIT_ACTIONS.ACCOUNT_LOCKED,

              resourceType: USER_RESOURCE_TYPE,

              resourceId: input.user.getId(),

              outcome: 'SUCCESS',

              createdAt: input.failedAt,

              metadata: {
                applicationId: input.applicationId,

                failedLoginAttempts: userState.failedLoginAttempts,

                ...(userState.lockedUntil === null
                  ? {}
                  : {
                      lockedUntil: userState.lockedUntil.toISOString(),
                    }),
              },

              ...(input.requestId === undefined
                ? {}
                : {
                    requestId: input.requestId,
                  }),

              ...(input.ipAddress === undefined
                ? {}
                : {
                    ipAddress: input.ipAddress,
                  }),

              ...(input.userAgent === undefined
                ? {}
                : {
                    userAgent: input.userAgent,
                  }),
            },
          });
        }
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
