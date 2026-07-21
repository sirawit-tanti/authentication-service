import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import { DuplicateRoleCodeError } from '@/application/errors/role-management.error.js';
import type {
  ManagedRoleRecord,
  RoleManagementRepository,
} from '@/application/ports/repositories/role-management.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

export interface CreateRoleCommand extends AuditRequestContext {
  applicationId: string;
  actorUserId: string;
  code: string;
  name: string;
  description: string | null;
}

export interface CreateRoleResult {
  role: ManagedRoleRecord;
}

export interface CreateRoleUseCaseDependencies {
  repository: RoleManagementRepository;
  clock: Clock;
}

function normalizeRoleCode(code: string): string {
  return code.trim().toUpperCase();
}

export class CreateRoleUseCase {
  private readonly repository: RoleManagementRepository;
  private readonly clock: Clock;

  public constructor(dependencies: CreateRoleUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.clock = dependencies.clock;
  }

  public async execute(command: CreateRoleCommand): Promise<CreateRoleResult> {
    const code = normalizeRoleCode(command.code);

    const result = await this.repository.create({
      applicationId: command.applicationId,
      actorUserId: command.actorUserId,
      code,
      name: command.name.trim(),
      description: command.description === null ? null : command.description.trim(),
      createdAt: this.clock.now(),
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

    if (result.status === 'DUPLICATE_CODE') {
      throw new DuplicateRoleCodeError(code);
    }

    return {
      role: result.role,
    };
  }
}
