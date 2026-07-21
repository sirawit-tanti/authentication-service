import type {
  CheckPermissionInput,
  PermissionChecker,
} from '../../../src/application/ports/authorization/permission-checker.js';
import { PrismaPermissionChecker } from '../../../src/infrastructure/authorization/prisma-permission-checker.js';
import type { ApplicationPrismaClient } from '../../../src/infrastructure/database/prisma-client.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const USER_ROLE_ID = '23af3c18-fe60-45ef-83bb-48e804839659';

const CHECKED_AT = new Date('2026-07-21T10:00:00.000Z');

const PERMISSION_CODE = 'audit_logs.read';

interface UserRoleFindFirstArguments {
  where: unknown;
  select: unknown;
}

class FakeUserRoleDelegate {
  public arguments: UserRoleFindFirstArguments | null = null;

  public result: {
    id: string;
  } | null = {
    id: USER_ROLE_ID,
  };

  public findFirst(arguments_: UserRoleFindFirstArguments): Promise<{
    id: string;
  } | null> {
    this.arguments = arguments_;

    return Promise.resolve(this.result);
  }
}

interface FakePrismaClient {
  userRole: FakeUserRoleDelegate;
}

function createPermissionChecker(): {
  permissionChecker: PermissionChecker;
  userRoleDelegate: FakeUserRoleDelegate;
} {
  const userRoleDelegate = new FakeUserRoleDelegate();

  const prisma: FakePrismaClient = {
    userRole: userRoleDelegate,
  };

  return {
    permissionChecker: new PrismaPermissionChecker(prisma as unknown as ApplicationPrismaClient),

    userRoleDelegate,
  };
}

function createInput(): CheckPermissionInput {
  return {
    userId: USER_ID,

    applicationId: APPLICATION_ID,

    permissionCode: PERMISSION_CODE,

    checkedAt: CHECKED_AT,
  };
}

describe('PrismaPermissionChecker', () => {
  it('returns true when the user has the required active permission', async () => {
    const { permissionChecker } = createPermissionChecker();

    const result = await permissionChecker.hasPermission(createInput());

    expect(result).toBe(true);
  });

  it('returns false when no matching role assignment exists', async () => {
    const { permissionChecker, userRoleDelegate } = createPermissionChecker();

    userRoleDelegate.result = null;

    const result = await permissionChecker.hasPermission(createInput());

    expect(result).toBe(false);
  });

  it('queries by user, application, active role, active permission, and assignment expiry', async () => {
    const { permissionChecker, userRoleDelegate } = createPermissionChecker();

    await permissionChecker.hasPermission(createInput());

    expect(userRoleDelegate.arguments).toEqual({
      where: {
        userId: USER_ID,

        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: CHECKED_AT,
            },
          },
        ],

        role: {
          applicationId: APPLICATION_ID,

          isActive: true,

          rolePermissions: {
            some: {
              permission: {
                applicationId: APPLICATION_ID,

                code: PERMISSION_CODE,

                isActive: true,
              },
            },
          },
        },
      },

      select: {
        id: true,
      },
    });
  });
});
