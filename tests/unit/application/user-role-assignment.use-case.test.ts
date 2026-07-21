import type {
  AssignedRoleRecord,
  FindUserRolesInput,
  ReplaceUserRolesInput,
  ReplaceUserRolesResult,
  UserRoleAssignmentRepository,
} from '../../../src/application/ports/repositories/user-role-assignment.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { InvalidRoleAssignmentError } from '../../../src/application/errors/invalid-role-assignment.error.js';
import { GetUserRolesUseCase } from '../../../src/application/use-cases/authorization/get-user-roles.use-case.js';
import { ReplaceUserRolesUseCase } from '../../../src/application/use-cases/authorization/replace-user-roles.use-case.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const ADMIN_USER_ID = 'a863a7a7-ef58-4101-a65f-b454cf82f302';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const ROLE_ID = '22baecdc-c7f4-459b-b8e3-b72db02b87bb';

const NOW = new Date('2026-07-21T05:00:00.000Z');

const ROLE: AssignedRoleRecord = {
  id: ROLE_ID,

  code: 'VIEWER',

  name: 'Viewer',

  description: null,

  isSystem: true,

  isActive: true,

  assignedAt: NOW,

  expiresAt: null,
};

class FixedClock implements Clock {
  public now(): Date {
    return NOW;
  }
}

class FakeRepository implements UserRoleAssignmentRepository {
  public findInput: FindUserRolesInput | null = null;

  public replaceInput: ReplaceUserRolesInput | null = null;

  public replaceResult: ReplaceUserRolesResult = {
    status: 'UPDATED',

    roles: [ROLE],
  };

  public findForUser(input: FindUserRolesInput): Promise<AssignedRoleRecord[]> {
    this.findInput = input;

    return Promise.resolve([ROLE]);
  }

  public replace(input: ReplaceUserRolesInput): Promise<ReplaceUserRolesResult> {
    this.replaceInput = input;

    return Promise.resolve(this.replaceResult);
  }
}

describe('User role assignment use cases', () => {
  it('gets active roles for the current application', async () => {
    const repository = new FakeRepository();

    const useCase = new GetUserRolesUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        userId: USER_ID,

        applicationId: APPLICATION_ID,
      }),
    ).resolves.toEqual({
      roles: [ROLE],
    });

    expect(repository.findInput).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      checkedAt: NOW,
    });
  });

  it('deduplicates role IDs before replacing assignments', async () => {
    const repository = new FakeRepository();

    const useCase = new ReplaceUserRolesUseCase({
      repository,

      clock: new FixedClock(),
    });

    await useCase.execute({
      targetUserId: USER_ID,

      applicationId: APPLICATION_ID,

      roleIds: [ROLE_ID, ROLE_ID],

      assignedByUserId: ADMIN_USER_ID,

      requestId: 'request-123',
    });

    expect(repository.replaceInput).toEqual({
      targetUserId: USER_ID,

      applicationId: APPLICATION_ID,

      roleIds: [ROLE_ID],

      assignedByUserId: ADMIN_USER_ID,

      assignedAt: NOW,

      requestId: 'request-123',
    });
  });

  it('rejects roles outside the current application', async () => {
    const repository = new FakeRepository();

    repository.replaceResult = {
      status: 'INVALID_ROLES',

      invalidRoleIds: [ROLE_ID],
    };

    const useCase = new ReplaceUserRolesUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        targetUserId: USER_ID,

        applicationId: APPLICATION_ID,

        roleIds: [ROLE_ID],

        assignedByUserId: ADMIN_USER_ID,
      }),
    ).rejects.toBeInstanceOf(InvalidRoleAssignmentError);
  });
});
