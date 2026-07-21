import { InvalidRoleAssignmentError } from '@/application/errors/invalid-role-assignment.error.js';
import { RoleAssignmentUserNotFoundError } from '@/application/errors/role-assignment-user-not-found.error.js';
import type {
  AssignedRoleRecord,
  UserRoleAssignmentRepository,
} from '@/application/ports/repositories/user-role-assignment.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface ReplaceUserRolesCommand extends AuditRequestContext {
  targetUserId: string;
  applicationId: string;
  roleIds: string[];
  assignedByUserId: string;
}

export interface ReplaceUserRolesResult {
  roles: AssignedRoleRecord[];
}

export interface ReplaceUserRolesUseCaseDependencies {
  repository: UserRoleAssignmentRepository;

  clock: Clock;
}

export class ReplaceUserRolesUseCase {
  private readonly repository: UserRoleAssignmentRepository;

  private readonly clock: Clock;

  public constructor(dependencies: ReplaceUserRolesUseCaseDependencies) {
    this.repository = dependencies.repository;

    this.clock = dependencies.clock;
  }

  public async execute(command: ReplaceUserRolesCommand): Promise<ReplaceUserRolesResult> {
    const roleIds = [...new Set(command.roleIds)];

    const result = await this.repository.replace({
      targetUserId: command.targetUserId,

      applicationId: command.applicationId,

      roleIds,

      assignedByUserId: command.assignedByUserId,

      assignedAt: this.clock.now(),

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

    if (result.status === 'USER_NOT_FOUND') {
      throw new RoleAssignmentUserNotFoundError();
    }

    if (result.status === 'INVALID_ROLES') {
      throw new InvalidRoleAssignmentError(result.invalidRoleIds);
    }

    return {
      roles: result.roles,
    };
  }
}
