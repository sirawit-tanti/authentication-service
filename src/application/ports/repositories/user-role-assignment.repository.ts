import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface AssignedRoleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  assignedAt: Date;
  expiresAt: Date | null;
}

export interface FindUserRolesInput {
  userId: string;
  applicationId: string;
  checkedAt: Date;
}

export interface ReplaceUserRolesInput extends AuditRequestContext {
  targetUserId: string;
  applicationId: string;
  roleIds: string[];
  assignedByUserId: string;
  assignedAt: Date;
}

export type ReplaceUserRolesResult =
  | {
      status: 'UPDATED';
      roles: AssignedRoleRecord[];
    }
  | {
      status: 'USER_NOT_FOUND';
    }
  | {
      status: 'INVALID_ROLES';
      invalidRoleIds: string[];
    };

export interface UserRoleAssignmentRepository {
  findForUser(input: FindUserRolesInput): Promise<AssignedRoleRecord[]>;

  replace(input: ReplaceUserRolesInput): Promise<ReplaceUserRolesResult>;
}
