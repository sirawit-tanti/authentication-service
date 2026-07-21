import type {
  AssignedRoleRecord,
  UserRoleAssignmentRepository,
} from '@/application/ports/repositories/user-role-assignment.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

export interface GetUserRolesCommand {
  userId: string;
  applicationId: string;
}

export interface GetUserRolesResult {
  roles: AssignedRoleRecord[];
}

export interface GetUserRolesUseCaseDependencies {
  repository: UserRoleAssignmentRepository;

  clock: Clock;
}

export class GetUserRolesUseCase {
  private readonly repository: UserRoleAssignmentRepository;

  private readonly clock: Clock;

  public constructor(dependencies: GetUserRolesUseCaseDependencies) {
    this.repository = dependencies.repository;

    this.clock = dependencies.clock;
  }

  public async execute(command: GetUserRolesCommand): Promise<GetUserRolesResult> {
    const roles = await this.repository.findForUser({
      userId: command.userId,

      applicationId: command.applicationId,

      checkedAt: this.clock.now(),
    });

    return {
      roles,
    };
  }
}
