import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import {
  RoleNotFoundError,
  SystemRoleProtectedError,
} from '@/application/errors/role-management.error.js';
import type {
  ManagedRoleRecord,
  RoleManagementRepository,
} from '@/application/ports/repositories/role-management.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

export interface UpdateRoleCommand extends AuditRequestContext {
  applicationId: string;
  actorUserId: string;
  roleId: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateRoleResult {
  role: ManagedRoleRecord;
}

export interface UpdateRoleUseCaseDependencies {
  repository: RoleManagementRepository;
  clock: Clock;
}

export class UpdateRoleUseCase {
  private readonly repository: RoleManagementRepository;
  private readonly clock: Clock;

  public constructor(dependencies: UpdateRoleUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.clock = dependencies.clock;
  }

  public async execute(command: UpdateRoleCommand): Promise<UpdateRoleResult> {
    const result = await this.repository.update({
      applicationId: command.applicationId,
      actorUserId: command.actorUserId,
      roleId: command.roleId,
      updatedAt: this.clock.now(),
      ...(command.name === undefined
        ? {}
        : {
            name: command.name.trim(),
          }),
      ...(command.description === undefined
        ? {}
        : {
            description: command.description === null ? null : command.description.trim(),
          }),
      ...(command.isActive === undefined
        ? {}
        : {
            isActive: command.isActive,
          }),
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

    return {
      role: result.role,
    };
  }
}
