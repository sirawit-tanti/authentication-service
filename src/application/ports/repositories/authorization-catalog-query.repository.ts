export interface FindAuthorizationCatalogInput {
  applicationId: string;
}

export interface AuthorizationPermissionRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  isActive: boolean;
}

export interface AuthorizationRoleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: AuthorizationPermissionRecord[];
}

export interface AuthorizationCatalogQueryRepository {
  findRoles(input: FindAuthorizationCatalogInput): Promise<AuthorizationRoleRecord[]>;

  findPermissions(input: FindAuthorizationCatalogInput): Promise<AuthorizationPermissionRecord[]>;
}
