import type { Prisma } from '@/generated/prisma/client.js';

export interface RevokeSessionsInput {
  sessionIds: string[];

  revokedAt: Date;

  reason: string;

  userId?: string;

  applicationId?: string;
}

export interface RevokeSessionsResult {
  revokedSessionCount: number;
}

function normalizeSessionIds(sessionIds: string[]): string[] {
  return [...new Set(sessionIds.filter((sessionId): boolean => sessionId.length > 0))];
}

export async function revokeSessions(
  transaction: Prisma.TransactionClient,
  input: RevokeSessionsInput,
): Promise<RevokeSessionsResult> {
  const sessionIds = normalizeSessionIds(input.sessionIds);

  if (sessionIds.length === 0) {
    return {
      revokedSessionCount: 0,
    };
  }

  const sessionUpdate = await transaction.session.updateMany({
    where: {
      id: {
        in: sessionIds,
      },

      status: 'ACTIVE',

      revokedAt: null,

      ...(input.userId === undefined
        ? {}
        : {
            userId: input.userId,
          }),

      ...(input.applicationId === undefined
        ? {}
        : {
            applicationId: input.applicationId,
          }),
    },

    data: {
      status: 'REVOKED',

      revokedAt: input.revokedAt,

      revokeReason: input.reason,

      lastActivityAt: input.revokedAt,

      updatedAt: input.revokedAt,
    },
  });

  /*
   * Revoke refresh tokens even when the session update count is zero.
   *
   * Another concurrent transaction may have revoked the session after
   * it was selected but before this update. Revoking any remaining active
   * refresh tokens keeps the two persistence states consistent.
   */
  await transaction.refreshToken.updateMany({
    where: {
      sessionId: {
        in: sessionIds,
      },

      revokedAt: null,
    },

    data: {
      revokedAt: input.revokedAt,

      revokeReason: input.reason,
    },
  });

  return {
    revokedSessionCount: sessionUpdate.count,
  };
}
