import type {
  AuthorizationCatalogQueryRepository,
  AuthorizationPermissionRecord,
  AuthorizationRoleRecord,
  FindAuthorizationCatalogInput,
} from '../../../src/application/ports/repositories/authorization-catalog-query.repository.js';
import { ListPermissionsUseCase } from '../../../src/application/use-cases/authorization/list-permissions.use-case.js';
import { ListRolesUseCase } from '../../../src/application/use-cases/authorization/list-roles.use-case.js';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const ROLE_ID = '22baecdc-c7f4-459b-b8e3-b72db02b87bb';

const PERMISSION_ID = '64d8d356-fe13-45e9-906f-2cc4c00c4599';

class FakeAuthorizationCatalogRepository implements AuthorizationCatalogQueryRepository {
  public rolesInput: FindAuthorizationCatalogInput | null = null;

  public permissionsInput: FindAuthorizationCatalogInput | null = null;

  public roles: AuthorizationRoleRecord[] = [
    {
      id: ROLE_ID,

      code: 'ADMINISTRATOR',

      name: 'Administrator',

      description: 'Full administrative access',

      isSystem: true,

      isActive: true,

      permissions: [
        {
          id: PERMISSION_ID,

          code: 'roles.read',

          name: 'Read roles',

          description: null,

          resource: 'roles',

          action: 'read',

          isActive: true,
        },
      ],
    },
  ];

  public permissions: AuthorizationPermissionRecord[] = this.roles[0]?.permissions ?? [];

  public findRoles(input: FindAuthorizationCatalogInput): Promise<AuthorizationRoleRecord[]> {
    this.rolesInput = input;

    return Promise.resolve(this.roles);
  }

  public findPermissions(
    input: FindAuthorizationCatalogInput,
  ): Promise<AuthorizationPermissionRecord[]> {
    this.permissionsInput = input;

    return Promise.resolve(this.permissions);
  }
}

describe('Authorization catalog use cases', () => {
  it('lists roles for the selected application', async () => {
    const repository = new FakeAuthorizationCatalogRepository();

    const useCase = new ListRolesUseCase(repository);

    const result = await useCase.execute({
      applicationId: APPLICATION_ID,
    });

    expect(repository.rolesInput).toEqual({
      applicationId: APPLICATION_ID,
    });

    expect(result.roles).toEqual(repository.roles);
  });

  it('lists permissions for the selected application', async () => {
    const repository = new FakeAuthorizationCatalogRepository();

    const useCase = new ListPermissionsUseCase(repository);

    const result = await useCase.execute({
      applicationId: APPLICATION_ID,
    });

    expect(repository.permissionsInput).toEqual({
      applicationId: APPLICATION_ID,
    });

    expect(result.permissions).toEqual(repository.permissions);
  });
});
