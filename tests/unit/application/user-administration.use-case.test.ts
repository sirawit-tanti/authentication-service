import { AdministrativeUserNotFoundError } from '../../../src/application/errors/administrative-user-not-found.error.js';
import type {
  AdministrativeUserRecord,
  FindAdministrativeUserInput,
  ListAdministrativeUsersInput,
  ListAdministrativeUsersResult,
  UserAdministrationQueryRepository,
} from '../../../src/application/ports/repositories/user-administration-query.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { GetAdministrativeUserUseCase } from '../../../src/application/use-cases/users/get-administrative-user.use-case.js';
import { ListAdministrativeUsersUseCase } from '../../../src/application/use-cases/users/list-administrative-users.use-case.js';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const NOW = new Date('2026-07-21T07:00:00.000Z');

const USER: AdministrativeUserRecord = {
  id: USER_ID,

  email: 'sirawit@example.com',

  status: 'ACTIVE',

  emailVerified: true,

  failedLoginAttempts: 0,

  lockedUntil: null,

  passwordChangedAt: NOW,

  lastLoginAt: NOW,

  version: 2,

  createdAt: NOW,

  updatedAt: NOW,

  roles: [],
};

class FixedClock implements Clock {
  public now(): Date {
    return NOW;
  }
}

class FakeRepository implements UserAdministrationQueryRepository {
  public listInput: ListAdministrativeUsersInput | null = null;

  public findInput: FindAdministrativeUserInput | null = null;

  public findResult: AdministrativeUserRecord | null = USER;

  public list(input: ListAdministrativeUsersInput): Promise<ListAdministrativeUsersResult> {
    this.listInput = input;

    return Promise.resolve({
      users: [USER],

      total: 1,
    });
  }

  public findById(input: FindAdministrativeUserInput): Promise<AdministrativeUserRecord | null> {
    this.findInput = input;

    return Promise.resolve(this.findResult);
  }
}

describe('User administration query use cases', () => {
  it('normalizes list pagination and search', async () => {
    const repository = new FakeRepository();

    const useCase = new ListAdministrativeUsersUseCase({
      repository,

      clock: new FixedClock(),
    });

    const result = await useCase.execute({
      applicationId: APPLICATION_ID,

      page: 2,

      limit: 10,

      search: ' sirawit ',

      status: 'ACTIVE',
    });

    expect(repository.listInput).toEqual({
      applicationId: APPLICATION_ID,

      page: 2,

      limit: 10,

      search: 'sirawit',

      status: 'ACTIVE',

      checkedAt: NOW,
    });

    expect(result.pagination).toEqual({
      page: 2,

      limit: 10,

      total: 1,

      totalPages: 1,
    });
  });

  it('gets a user in the current application', async () => {
    const repository = new FakeRepository();

    const useCase = new GetAdministrativeUserUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        applicationId: APPLICATION_ID,

        userId: USER_ID,
      }),
    ).resolves.toEqual({
      user: USER,
    });

    expect(repository.findInput).toEqual({
      applicationId: APPLICATION_ID,

      userId: USER_ID,

      checkedAt: NOW,
    });
  });

  it('rejects users outside the current application', async () => {
    const repository = new FakeRepository();

    repository.findResult = null;

    const useCase = new GetAdministrativeUserUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        applicationId: APPLICATION_ID,

        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(AdministrativeUserNotFoundError);
  });
});
