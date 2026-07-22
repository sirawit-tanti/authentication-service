import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import type { AdministrativeUserStatus } from './user-administration-query.repository.js';

export interface ChangeUserStatusInput extends AuditRequestContext {
  applicationId: string;
  actorUserId: string;
  targetUserId: string;
  expectedVersion: number;
  status: Exclude<AdministrativeUserStatus, 'PENDING_VERIFICATION'>;
  changedAt: Date;
  revokeReason: string;
}

export type ChangeUserStatusPersistenceResult =
  | {
      status: 'UPDATED';
      userId: string;
      email: string;
      previousStatus: AdministrativeUserStatus;
      currentStatus: AdministrativeUserStatus;
      version: number;
      revokedSessionCount: number;
      updatedAt: Date;
    }
  | {
      status: 'NOT_FOUND';
    }
  | {
      status: 'CONFLICT';
    }
  | {
      status: 'DISABLED_USER';
    }
  | {
      status: 'EMAIL_NOT_VERIFIED';
    };

export interface UserStatusManagementRepository {
  changeStatus(input: ChangeUserStatusInput): Promise<ChangeUserStatusPersistenceResult>;
}
