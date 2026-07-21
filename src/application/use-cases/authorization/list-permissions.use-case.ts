import type {
  AuthorizationCatalogQueryRepository,
  AuthorizationPermissionRecord,
} from '@/application/ports/repositories/authorization-catalog-query.repository.js';

export interface ListPermissionsCommand {
  applicationId: string;
}

export interface ListPermissionsResult {
  permissions: AuthorizationPermissionRecord[];
}

export class ListPermissionsUseCase {
  private readonly repository: AuthorizationCatalogQueryRepository;

  public constructor(repository: AuthorizationCatalogQueryRepository) {
    this.repository = repository;
  }

  public async execute(command: ListPermissionsCommand): Promise<ListPermissionsResult> {
    const permissions = await this.repository.findPermissions({
      applicationId: command.applicationId,
    });

    return {
      permissions,
    };
  }
}
