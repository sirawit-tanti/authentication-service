import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import type {
  CreateLoginSessionInput,
  LoginSessionRepository,
} from '@/application/ports/repositories/login-session.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const SESSION_RESOURCE_TYPE = 'SESSION';

export class PrismaLoginSessionRepository implements LoginSessionRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async create(input: CreateLoginSessionInput): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const userState = input.user.toState();

        const updateResult = await transaction.user.updateMany({
          where: {
            id: input.user.getId(),

            version: input.expectedUserVersion,

            deletedAt: null,
          },

          data: {
            failedLoginAttempts: userState.failedLoginAttempts,

            lockedUntil: userState.lockedUntil,

            lastLoginAt: userState.lastLoginAt,

            version: userState.version,

            updatedAt: userState.updatedAt,
          },
        });

        if (updateResult.count === 0) {
          throw new OptimisticConcurrencyError('User', input.user.getId());
        }

        await transaction.session.create({
          data: {
            id: input.sessionId,

            userId: input.user.getId(),

            applicationId: input.applicationId,

            status: 'ACTIVE',

            lastActivityAt: input.createdAt,

            expiresAt: input.sessionExpiresAt,

            createdAt: input.createdAt,
            updatedAt: input.createdAt,

            refreshTokens: {
              create: {
                id: input.refreshTokenId,

                familyId: input.refreshTokenFamilyId,

                tokenHash: input.refreshTokenHash,

                jti: input.refreshTokenJti,

                expiresAt: input.refreshTokenExpiresAt,

                createdAt: input.createdAt,
              },
            },

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

        await transaction.auditLog.create({
          data: {
            actorUserId: input.user.getId(),

            action: SECURITY_AUDIT_ACTIONS.LOGIN_SUCCEEDED,

            resourceType: SESSION_RESOURCE_TYPE,

            resourceId: input.sessionId,

            outcome: 'SUCCESS',

            createdAt: input.createdAt,

            metadata: {
              applicationId: input.applicationId,

              sessionId: input.sessionId,
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
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
