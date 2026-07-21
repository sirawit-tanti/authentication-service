export type AdministrativeUserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface AdministrativeUserRoleRecord {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  assignedAt: Date;
  expiresAt: Date | null;
}

export interface AdministrativeUserRecord {
  id: string;
  email: string;
  status: AdministrativeUserStatus;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  roles: AdministrativeUserRoleRecord[];
}

export interface ListAdministrativeUsersInput {
  applicationId: string;
  page: number;
  limit: number;
  search?: string;
  status?: AdministrativeUserStatus;
  checkedAt: Date;
}

export interface ListAdministrativeUsersResult {
  users: AdministrativeUserRecord[];
  total: number;
}

export interface FindAdministrativeUserInput {
  applicationId: string;
  userId: string;
  checkedAt: Date;
}

export interface UserAdministrationQueryRepository {
  list(input: ListAdministrativeUsersInput): Promise<ListAdministrativeUsersResult>;

  findById(input: FindAdministrativeUserInput): Promise<AdministrativeUserRecord | null>;
}
