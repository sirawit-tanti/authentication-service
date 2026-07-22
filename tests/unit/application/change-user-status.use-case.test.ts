import {
  CannotChangeOwnStatusError,
  UserStatusConflictError,
} from '../../../src/application/errors/user-status-management.error.js';
import type {
  ChangeUserStatusInput,
  ChangeUserStatusPersistenceResult,
  UserStatusManagementRepository,
} from '../../../src/application/ports/repositories/user-status-management.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { ChangeUserStatusUseCase } from '../../../src/application/use-cases/users/change-user-status.use-case.js';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const ACTOR_USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const TARGET_USER_ID = 'a863a7a7-ef58-4101-a65f-b454cf82f302';

const NOW = new Date('2026-07-21T08:00:00.000Z');

class FixedClock implements Clock {
  public now(): Date {
    return NOW;
  }
}

class FakeRepository implements UserStatusManagementRepository {
  public input: ChangeUserStatusInput | null = null;

  public result: ChangeUserStatusPersistenceResult = {
    status: 'UPDATED',

    userId: TARGET_USER_ID,

    email: 'target@example.com',

    previousStatus: 'ACTIVE',

    currentStatus: 'SUSPENDED',

    version: 3,

    revokedSessionCount: 2,

    updatedAt: NOW,
  };

  public changeStatus(input: ChangeUserStatusInput): Promise<ChangeUserStatusPersistenceResult> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

describe('ChangeUserStatusUseCase', () => {
  it('changes status with audit context', async () => {
    const repository = new FakeRepository();

    const useCase = new ChangeUserStatusUseCase({
      repository,

      clock: new FixedClock(),
    });

    const result = await useCase.execute({
      applicationId: APPLICATION_ID,

      actorUserId: ACTOR_USER_ID,

      targetUserId: TARGET_USER_ID,

      status: 'SUSPENDED',

      expectedVersion: 2,

      requestId: 'request-1',
    });

    expect(repository.input).toEqual({
      applicationId: APPLICATION_ID,

      actorUserId: ACTOR_USER_ID,

      targetUserId: TARGET_USER_ID,

      status: 'SUSPENDED',

      expectedVersion: 2,

      changedAt: NOW,

      revokeReason: 'User account status changed by administrator',

      requestId: 'request-1',
    });

    expect(result.user.revokedSessionCount).toBe(2);
  });

  it('rejects changing the current administrator status', async () => {
    const useCase = new ChangeUserStatusUseCase({
      repository: new FakeRepository(),

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        applicationId: APPLICATION_ID,

        actorUserId: ACTOR_USER_ID,

        targetUserId: ACTOR_USER_ID,

        status: 'DISABLED',

        expectedVersion: 2,
      }),
    ).rejects.toBeInstanceOf(CannotChangeOwnStatusError);
  });

  it('maps optimistic concurrency conflicts', async () => {
    const repository = new FakeRepository();

    repository.result = {
      status: 'CONFLICT',
    };

    const useCase = new ChangeUserStatusUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        applicationId: APPLICATION_ID,

        actorUserId: ACTOR_USER_ID,

        targetUserId: TARGET_USER_ID,

        status: 'SUSPENDED',

        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(UserStatusConflictError);
  });
});
