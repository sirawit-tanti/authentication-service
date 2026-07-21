import type {
  FindUserAuthorizationInput,
  UserAuthorizationQueryRepository,
  UserAuthorizationRecord,
} from '@/application/ports/repositories/user-authorization-query.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

export class PrismaUserAuthorizationQueryRepository implements UserAuthorizationQueryRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findForUser(input: FindUserAuthorizationInput): Promise<UserAuthorizationRecord> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: input.userId,
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
        role: {
          applicationId: input.applicationId,
          isActive: true,
        },
      },
      orderBy: {
        role: {
          code: 'asc',
        },
      },
      select: {
        role: {
          select: {
            code: true,
            rolePermissions: {
              where: {
                permission: {
                  applicationId: input.applicationId,
                  isActive: true,
                },
              },
              select: {
                permission: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const roles = new Set<string>();

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      roles.add(userRole.role.code);

      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    return {
      roles: [...roles],
      permissions: [...permissions],
    };
  }
}
