import type {
  AdministrativeUserRecord,
  AdministrativeUserRoleRecord,
  FindAdministrativeUserInput,
  ListAdministrativeUsersInput,
  ListAdministrativeUsersResult,
  UserAdministrationQueryRepository,
} from '@/application/ports/repositories/user-administration-query.repository.js';
import type { Prisma } from '@/generated/prisma/client.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

interface PrismaAdministrativeUserRoleRecord {
  assignedAt: Date;
  expiresAt: Date | null;

  role: {
    id: string;
    code: string;
    name: string;
    isSystem: boolean;
    isActive: boolean;
  };
}

interface PrismaAdministrativeUserRecord {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  userRoles: PrismaAdministrativeUserRoleRecord[];
}

function mapRole(assignment: PrismaAdministrativeUserRoleRecord): AdministrativeUserRoleRecord {
  return {
    id: assignment.role.id,
    code: assignment.role.code,
    name: assignment.role.name,
    isSystem: assignment.role.isSystem,
    isActive: assignment.role.isActive,
    assignedAt: assignment.assignedAt,
    expiresAt: assignment.expiresAt,
  };
}

function mapUser(user: PrismaAdministrativeUserRecord): AdministrativeUserRecord {
  if (
    user.status !== 'PENDING_VERIFICATION' &&
    user.status !== 'ACTIVE' &&
    user.status !== 'SUSPENDED' &&
    user.status !== 'DISABLED'
  ) {
    throw new Error(`Unsupported administrative user status: ${user.status}`);
  }

  return {
    id: user.id,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    passwordChangedAt: user.passwordChangedAt,
    lastLoginAt: user.lastLoginAt,
    version: user.version,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.userRoles.map(mapRole),
  };
}

const administrativeUserSelect = {
  id: true,
  email: true,
  status: true,
  emailVerified: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  passwordChangedAt: true,
  lastLoginAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,

  userRoles: {
    orderBy: {
      role: {
        code: 'asc' as const,
      },
    },

    select: {
      assignedAt: true,
      expiresAt: true,

      role: {
        select: {
          id: true,
          code: true,
          name: true,
          isSystem: true,
          isActive: true,
        },
      },
    },
  },
} as const;

export class PrismaUserAdministrationQueryRepository implements UserAdministrationQueryRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async list(input: ListAdministrativeUsersInput): Promise<ListAdministrativeUsersResult> {
    const skip = (input.page - 1) * input.limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,

      ...(input.search === undefined
        ? {}
        : {
            OR: [
              {
                email: {
                  contains: input.search,
                  mode: 'insensitive',
                },
              },
              {
                normalizedEmail: {
                  contains: input.search.toLowerCase(),
                },
              },
            ],
          }),

      ...(input.status === undefined
        ? {}
        : {
            status: input.status,
          }),

      userRoles: {
        some: {
          role: {
            applicationId: input.applicationId,
          },

          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: input.checkedAt,
              },
            },
          ],
        },
      },
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,

        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],

        skip,

        take: input.limit,

        select: {
          ...administrativeUserSelect,

          userRoles: {
            where: {
              role: {
                applicationId: input.applicationId,
              },

              OR: [
                {
                  expiresAt: null,
                },
                {
                  expiresAt: {
                    gt: input.checkedAt,
                  },
                },
              ],
            },

            orderBy: {
              role: {
                code: 'asc',
              },
            },

            select: administrativeUserSelect.userRoles.select,
          },
        },
      }),

      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      users: users.map(mapUser),
      total,
    };
  }

  public async findById(
    input: FindAdministrativeUserInput,
  ): Promise<AdministrativeUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        deletedAt: null,

        userRoles: {
          some: {
            role: {
              applicationId: input.applicationId,
            },

            OR: [
              {
                expiresAt: null,
              },
              {
                expiresAt: {
                  gt: input.checkedAt,
                },
              },
            ],
          },
        },
      },

      select: {
        ...administrativeUserSelect,

        userRoles: {
          where: {
            role: {
              applicationId: input.applicationId,
            },

            OR: [
              {
                expiresAt: null,
              },
              {
                expiresAt: {
                  gt: input.checkedAt,
                },
              },
            ],
          },

          orderBy: {
            role: {
              code: 'asc',
            },
          },

          select: administrativeUserSelect.userRoles.select,
        },
      },
    });

    return user === null ? null : mapUser(user);
  }
}
