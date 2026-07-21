import type {
  AuthorizationCatalogQueryRepository,
  AuthorizationRoleRecord,
} from '@/application/ports/repositories/authorization-catalog-query.repository.js';

export interface ListRolesCommand {
  applicationId: string;
}

export interface ListRolesResult {
  roles: AuthorizationRoleRecord[];
}

export class ListRolesUseCase {
  private readonly repository: AuthorizationCatalogQueryRepository;

  public constructor(repository: AuthorizationCatalogQueryRepository) {
    this.repository = repository;
  }

  public async execute(command: ListRolesCommand): Promise<ListRolesResult> {
    const roles = await this.repository.findRoles({
      applicationId: command.applicationId,
    });

    return {
      roles,
    };
  }
}
