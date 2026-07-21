import {
  DuplicateRoleCodeError,
  InvalidRolePermissionsError,
  SystemRoleProtectedError,
} from '../../../src/application/errors/role-management.error.js';
import type {
  CreateRoleInput,
  CreateRoleResult,
  ManagedRoleRecord,
  ReplaceRolePermissionsInput,
  ReplaceRolePermissionsResult,
  RoleManagementRepository,
  UpdateRoleInput,
  UpdateRoleResult,
} from '../../../src/application/ports/repositories/role-management.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { CreateRoleUseCase } from '../../../src/application/use-cases/authorization/create-role.use-case.js';
import { ReplaceRolePermissionsUseCase } from '../../../src/application/use-cases/authorization/replace-role-permissions.use-case.js';
import { UpdateRoleUseCase } from '../../../src/application/use-cases/authorization/update-role.use-case.js';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const ACTOR_USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const ROLE_ID = '22baecdc-c7f4-459b-b8e3-b72db02b87bb';

const PERMISSION_ID = '64d8d356-fe13-45e9-906f-2cc4c00c4599';

const NOW = new Date('2026-07-21T06:00:00.000Z');

const ROLE: ManagedRoleRecord = {
  id: ROLE_ID,

  code: 'SUPPORT_AGENT',

  name: 'Support Agent',

  description: null,

  isSystem: false,

  isActive: true,

  permissions: [],
};

class FixedClock implements Clock {
  public now(): Date {
    return NOW;
  }
}

class FakeRoleManagementRepository implements RoleManagementRepository {
  public createInput: CreateRoleInput | null = null;

  public updateInput: UpdateRoleInput | null = null;

  public replaceInput: ReplaceRolePermissionsInput | null = null;

  public createResult: CreateRoleResult = {
    status: 'CREATED',

    role: ROLE,
  };

  public updateResult: UpdateRoleResult = {
    status: 'UPDATED',

    role: ROLE,
  };

  public replaceResult: ReplaceRolePermissionsResult = {
    status: 'UPDATED',

    role: ROLE,
  };

  public create(input: CreateRoleInput): Promise<CreateRoleResult> {
    this.createInput = input;

    return Promise.resolve(this.createResult);
  }

  public update(input: UpdateRoleInput): Promise<UpdateRoleResult> {
    this.updateInput = input;

    return Promise.resolve(this.updateResult);
  }

  public replacePermissions(
    input: ReplaceRolePermissionsInput,
  ): Promise<ReplaceRolePermissionsResult> {
    this.replaceInput = input;

    return Promise.resolve(this.replaceResult);
  }
}

describe('Role management use cases', () => {
  it('normalizes a role code before creation', async () => {
    const repository = new FakeRoleManagementRepository();

    const useCase = new CreateRoleUseCase({
      repository,

      clock: new FixedClock(),
    });

    await useCase.execute({
      applicationId: APPLICATION_ID,

      actorUserId: ACTOR_USER_ID,

      code: ' support_agent ',

      name: ' Support Agent ',

      description: null,
    });

    expect(repository.createInput).toEqual({
      applicationId: APPLICATION_ID,

      actorUserId: ACTOR_USER_ID,

      code: 'SUPPORT_AGENT',

      name: 'Support Agent',

      description: null,

      createdAt: NOW,
    });
  });

  it('rejects a duplicate role code', async () => {
    const repository = new FakeRoleManagementRepository();

    repository.createResult = {
      status: 'DUPLICATE_CODE',
    };

    const useCase = new CreateRoleUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        applicationId: APPLICATION_ID,

        actorUserId: ACTOR_USER_ID,

        code: 'SUPPORT_AGENT',

        name: 'Support Agent',

        description: null,
      }),
    ).rejects.toBeInstanceOf(DuplicateRoleCodeError);
  });

  it('rejects changes to a system role', async () => {
    const repository = new FakeRoleManagementRepository();

    repository.updateResult = {
      status: 'SYSTEM_ROLE_PROTECTED',
    };

    const useCase = new UpdateRoleUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        applicationId: APPLICATION_ID,

        actorUserId: ACTOR_USER_ID,

        roleId: ROLE_ID,

        name: 'Changed role',
      }),
    ).rejects.toBeInstanceOf(SystemRoleProtectedError);
  });

  it('deduplicates permissions before replacing role permissions', async () => {
    const repository = new FakeRoleManagementRepository();

    const useCase = new ReplaceRolePermissionsUseCase({
      repository,

      clock: new FixedClock(),
    });

    await useCase.execute({
      applicationId: APPLICATION_ID,

      actorUserId: ACTOR_USER_ID,

      roleId: ROLE_ID,

      permissionIds: [PERMISSION_ID, PERMISSION_ID],
    });

    expect(repository.replaceInput).toEqual({
      applicationId: APPLICATION_ID,

      actorUserId: ACTOR_USER_ID,

      roleId: ROLE_ID,

      permissionIds: [PERMISSION_ID],

      updatedAt: NOW,
    });
  });

  it('rejects permissions outside the application', async () => {
    const repository = new FakeRoleManagementRepository();

    repository.replaceResult = {
      status: 'INVALID_PERMISSIONS',

      invalidPermissionIds: [PERMISSION_ID],
    };

    const useCase = new ReplaceRolePermissionsUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        applicationId: APPLICATION_ID,

        actorUserId: ACTOR_USER_ID,

        roleId: ROLE_ID,

        permissionIds: [PERMISSION_ID],
      }),
    ).rejects.toBeInstanceOf(InvalidRolePermissionsError);
  });
});
