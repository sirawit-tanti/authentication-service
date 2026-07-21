import type {
  AdministrativeUserRecord,
  AdministrativeUserStatus,
  UserAdministrationQueryRepository,
} from '@/application/ports/repositories/user-administration-query.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const DEFAULT_PAGE = 1;

const DEFAULT_LIMIT = 20;

const MAXIMUM_LIMIT = 100;

export interface ListAdministrativeUsersCommand {
  applicationId: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: AdministrativeUserStatus;
}

export interface ListAdministrativeUsersResult {
  users: AdministrativeUserRecord[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListAdministrativeUsersUseCaseDependencies {
  repository: UserAdministrationQueryRepository;
  clock: Clock;
}

export class ListAdministrativeUsersUseCase {
  private readonly repository: UserAdministrationQueryRepository;

  private readonly clock: Clock;

  public constructor(dependencies: ListAdministrativeUsersUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.clock = dependencies.clock;
  }

  public async execute(
    command: ListAdministrativeUsersCommand,
  ): Promise<ListAdministrativeUsersResult> {
    const page = Math.max(DEFAULT_PAGE, command.page ?? DEFAULT_PAGE);

    const limit = Math.min(MAXIMUM_LIMIT, Math.max(1, command.limit ?? DEFAULT_LIMIT));

    const normalizedSearch = command.search === undefined ? undefined : command.search.trim();

    const result = await this.repository.list({
      applicationId: command.applicationId,
      page,
      limit,
      checkedAt: this.clock.now(),

      ...(normalizedSearch === undefined || normalizedSearch.length === 0
        ? {}
        : {
            search: normalizedSearch,
          }),

      ...(command.status === undefined
        ? {}
        : {
            status: command.status,
          }),
    });

    return {
      users: result.users,

      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / limit),
      },
    };
  }
}
