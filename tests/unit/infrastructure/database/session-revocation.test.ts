import type { Prisma } from '@/generated/prisma/client.js';
import { revokeSessions } from '@/infrastructure/database/repositories/session-revocation.js';

const SESSION_ID_A = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const SESSION_ID_B = '401a82b5-dbf1-4e76-b084-dce1da232008';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const REVOKED_AT = new Date('2026-07-22T08:00:00.000Z');

const REVOKE_REASON = 'Security state changed';

interface FakeTransaction {
  session: {
    updateMany: ReturnType<typeof vi.fn>;
  };

  refreshToken: {
    updateMany: ReturnType<typeof vi.fn>;
  };
}

function createTransaction(revokedSessionCount = 2): FakeTransaction {
  return {
    session: {
      updateMany: vi.fn().mockResolvedValue({
        count: revokedSessionCount,
      }),
    },

    refreshToken: {
      updateMany: vi.fn().mockResolvedValue({
        count: 2,
      }),
    },
  };
}

function asPrismaTransaction(transaction: FakeTransaction): Prisma.TransactionClient {
  return transaction as unknown as Prisma.TransactionClient;
}

describe('revokeSessions', () => {
  it('revokes sessions and their active refresh tokens', async () => {
    const transaction = createTransaction();

    const result = await revokeSessions(asPrismaTransaction(transaction), {
      sessionIds: [SESSION_ID_A, SESSION_ID_B],

      revokedAt: REVOKED_AT,

      reason: REVOKE_REASON,
    });

    expect(transaction.session.updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [SESSION_ID_A, SESSION_ID_B],
        },

        status: 'ACTIVE',

        revokedAt: null,
      },

      data: {
        status: 'REVOKED',

        revokedAt: REVOKED_AT,

        revokeReason: REVOKE_REASON,

        lastActivityAt: REVOKED_AT,

        updatedAt: REVOKED_AT,
      },
    });

    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId: {
          in: [SESSION_ID_A, SESSION_ID_B],
        },

        revokedAt: null,
      },

      data: {
        revokedAt: REVOKED_AT,

        revokeReason: REVOKE_REASON,
      },
    });

    expect(result).toEqual({
      revokedSessionCount: 2,
    });
  });

  it('scopes session updates to the supplied user and application', async () => {
    const transaction = createTransaction(1);

    await revokeSessions(asPrismaTransaction(transaction), {
      sessionIds: [SESSION_ID_A],

      userId: USER_ID,

      applicationId: APPLICATION_ID,

      revokedAt: REVOKED_AT,

      reason: REVOKE_REASON,
    });

    expect(transaction.session.updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [SESSION_ID_A],
        },

        status: 'ACTIVE',

        revokedAt: null,

        userId: USER_ID,

        applicationId: APPLICATION_ID,
      },

      data: {
        status: 'REVOKED',

        revokedAt: REVOKED_AT,

        revokeReason: REVOKE_REASON,

        lastActivityAt: REVOKED_AT,

        updatedAt: REVOKED_AT,
      },
    });
  });

  it('removes duplicate and empty session identifiers', async () => {
    const transaction = createTransaction(2);

    await revokeSessions(asPrismaTransaction(transaction), {
      sessionIds: [SESSION_ID_A, '', SESSION_ID_A, SESSION_ID_B],

      revokedAt: REVOKED_AT,

      reason: REVOKE_REASON,
    });

    expect(transaction.session.updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [SESSION_ID_A, SESSION_ID_B],
        },

        status: 'ACTIVE',

        revokedAt: null,
      },

      data: {
        status: 'REVOKED',

        revokedAt: REVOKED_AT,

        revokeReason: REVOKE_REASON,

        lastActivityAt: REVOKED_AT,

        updatedAt: REVOKED_AT,
      },
    });

    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId: {
          in: [SESSION_ID_A, SESSION_ID_B],
        },

        revokedAt: null,
      },

      data: {
        revokedAt: REVOKED_AT,

        revokeReason: REVOKE_REASON,
      },
    });
  });

  it('does not access the database for an empty session collection', async () => {
    const transaction = createTransaction();

    const result = await revokeSessions(asPrismaTransaction(transaction), {
      sessionIds: [],

      revokedAt: REVOKED_AT,

      reason: REVOKE_REASON,
    });

    expect(transaction.session.updateMany).not.toHaveBeenCalled();

    expect(transaction.refreshToken.updateMany).not.toHaveBeenCalled();

    expect(result).toEqual({
      revokedSessionCount: 0,
    });
  });

  it('revokes remaining refresh tokens after a concurrent session revocation', async () => {
    const transaction = createTransaction(0);

    const result = await revokeSessions(asPrismaTransaction(transaction), {
      sessionIds: [SESSION_ID_A],

      revokedAt: REVOKED_AT,

      reason: REVOKE_REASON,
    });

    expect(result).toEqual({
      revokedSessionCount: 0,
    });

    expect(transaction.refreshToken.updateMany).toHaveBeenCalledOnce();
  });
});
