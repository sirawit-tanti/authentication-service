import { AdministrativeUserNotFoundError } from '@/application/errors/administrative-user-not-found.error.js';
import type {
  AdministrativeUserRecord,
  UserAdministrationQueryRepository,
} from '@/application/ports/repositories/user-administration-query.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

export interface GetAdministrativeUserCommand {
  applicationId: string;
  userId: string;
}

export interface GetAdministrativeUserResult {
  user: AdministrativeUserRecord;
}

export interface GetAdministrativeUserUseCaseDependencies {
  repository: UserAdministrationQueryRepository;
  clock: Clock;
}

export class GetAdministrativeUserUseCase {
  private readonly repository: UserAdministrationQueryRepository;

  private readonly clock: Clock;

  public constructor(dependencies: GetAdministrativeUserUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.clock = dependencies.clock;
  }

  public async execute(
    command: GetAdministrativeUserCommand,
  ): Promise<GetAdministrativeUserResult> {
    const user = await this.repository.findById({
      applicationId: command.applicationId,
      userId: command.userId,
      checkedAt: this.clock.now(),
    });

    if (user === null) {
      throw new AdministrativeUserNotFoundError();
    }

    return {
      user,
    };
  }
}
