import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import {
  InvalidRolePermissionsError,
  RoleNotFoundError,
  SystemRoleProtectedError,
} from '@/application/errors/role-management.error.js';
import type {
  ManagedRoleRecord,
  RoleManagementRepository,
} from '@/application/ports/repositories/role-management.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

export interface ReplaceRolePermissionsCommand extends AuditRequestContext {
  applicationId: string;
  actorUserId: string;
  roleId: string;
  permissionIds: string[];
}

export interface ReplaceRolePermissionsResult {
  role: ManagedRoleRecord;
}

export interface ReplaceRolePermissionsUseCaseDependencies {
  repository: RoleManagementRepository;
  clock: Clock;
}

export class ReplaceRolePermissionsUseCase {
  private readonly repository: RoleManagementRepository;
  private readonly clock: Clock;

  public constructor(dependencies: ReplaceRolePermissionsUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.clock = dependencies.clock;
  }

  public async execute(
    command: ReplaceRolePermissionsCommand,
  ): Promise<ReplaceRolePermissionsResult> {
    const permissionIds = [...new Set(command.permissionIds)];

    const result = await this.repository.replacePermissions({
      applicationId: command.applicationId,
      actorUserId: command.actorUserId,
      roleId: command.roleId,
      permissionIds,
      updatedAt: this.clock.now(),
      ...(command.requestId === undefined
        ? {}
        : {
            requestId: command.requestId,
          }),
      ...(command.ipAddress === undefined
        ? {}
        : {
            ipAddress: command.ipAddress,
          }),
      ...(command.userAgent === undefined
        ? {}
        : {
            userAgent: command.userAgent,
          }),
    });

    if (result.status === 'NOT_FOUND') {
      throw new RoleNotFoundError();
    }

    if (result.status === 'SYSTEM_ROLE_PROTECTED') {
      throw new SystemRoleProtectedError();
    }

    if (result.status === 'INVALID_PERMISSIONS') {
      throw new InvalidRolePermissionsError(result.invalidPermissionIds);
    }

    return {
      role: result.role,
    };
  }
}
