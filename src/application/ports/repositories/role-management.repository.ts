import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface ManagedRolePermissionRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  isActive: boolean;
}

export interface ManagedRoleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: ManagedRolePermissionRecord[];
}

export interface CreateRoleInput extends AuditRequestContext {
  applicationId: string;
  actorUserId: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

export type CreateRoleResult =
  | {
      status: 'CREATED';
      role: ManagedRoleRecord;
    }
  | {
      status: 'DUPLICATE_CODE';
    };

export interface UpdateRoleInput extends AuditRequestContext {
  applicationId: string;
  actorUserId: string;
  roleId: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
  updatedAt: Date;
}

export type UpdateRoleResult =
  | {
      status: 'UPDATED';
      role: ManagedRoleRecord;
    }
  | {
      status: 'NOT_FOUND';
    }
  | {
      status: 'SYSTEM_ROLE_PROTECTED';
    };

export interface ReplaceRolePermissionsInput extends AuditRequestContext {
  applicationId: string;
  actorUserId: string;
  roleId: string;
  permissionIds: string[];
  updatedAt: Date;
}

export type ReplaceRolePermissionsResult =
  | {
      status: 'UPDATED';
      role: ManagedRoleRecord;
    }
  | {
      status: 'NOT_FOUND';
    }
  | {
      status: 'SYSTEM_ROLE_PROTECTED';
    }
  | {
      status: 'INVALID_PERMISSIONS';
      invalidPermissionIds: string[];
    };

export interface RoleManagementRepository {
  create(input: CreateRoleInput): Promise<CreateRoleResult>;

  update(input: UpdateRoleInput): Promise<UpdateRoleResult>;

  replacePermissions(input: ReplaceRolePermissionsInput): Promise<ReplaceRolePermissionsResult>;
}
