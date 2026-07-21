import type {
  UserAuthorizationQueryRepository,
  UserAuthorizationRecord,
} from '@/application/ports/repositories/user-authorization-query.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

export interface GetUserAuthorizationCommand {
  userId: string;
  applicationId: string;
}

export interface GetUserAuthorizationResult {
  roles: string[];
  permissions: string[];
}

export interface GetUserAuthorizationUseCaseDependencies {
  repository: UserAuthorizationQueryRepository;
  clock: Clock;
}

export class GetUserAuthorizationUseCase {
  private readonly repository: UserAuthorizationQueryRepository;
  private readonly clock: Clock;

  public constructor(dependencies: GetUserAuthorizationUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.clock = dependencies.clock;
  }

  public async execute(command: GetUserAuthorizationCommand): Promise<GetUserAuthorizationResult> {
    const authorization: UserAuthorizationRecord = await this.repository.findForUser({
      userId: command.userId,
      applicationId: command.applicationId,
      checkedAt: this.clock.now(),
    });

    return {
      roles: [...authorization.roles].sort(),
      permissions: [...authorization.permissions].sort(),
    };
  }
}
