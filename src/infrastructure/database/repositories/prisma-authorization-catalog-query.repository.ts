import type {
  AuthorizationCatalogQueryRepository,
  AuthorizationPermissionRecord,
  AuthorizationRoleRecord,
  FindAuthorizationCatalogInput,
} from '@/application/ports/repositories/authorization-catalog-query.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

export class PrismaAuthorizationCatalogQueryRepository implements AuthorizationCatalogQueryRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findRoles(input: FindAuthorizationCatalogInput): Promise<AuthorizationRoleRecord[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        applicationId: input.applicationId,
      },

      orderBy: [
        {
          isActive: 'desc',
        },
        {
          code: 'asc',
        },
      ],

      select: {
        id: true,

        code: true,

        name: true,

        description: true,

        isSystem: true,

        isActive: true,

        rolePermissions: {
          where: {
            permission: {
              applicationId: input.applicationId,
            },
          },

          orderBy: {
            permission: {
              code: 'asc',
            },
          },

          select: {
            permission: {
              select: {
                id: true,

                code: true,

                name: true,

                description: true,

                resource: true,

                action: true,

                isActive: true,
              },
            },
          },
        },
      },
    });

    return roles.map((role): AuthorizationRoleRecord => ({
      id: role.id,

      code: role.code,

      name: role.name,

      description: role.description,

      isSystem: role.isSystem,

      isActive: role.isActive,

      permissions: role.rolePermissions.map(({ permission }): AuthorizationPermissionRecord => ({
        id: permission.id,

        code: permission.code,

        name: permission.name,

        description: permission.description,

        resource: permission.resource,

        action: permission.action,

        isActive: permission.isActive,
      })),
    }));
  }

  public async findPermissions(
    input: FindAuthorizationCatalogInput,
  ): Promise<AuthorizationPermissionRecord[]> {
    const permissions = await this.prisma.permission.findMany({
      where: {
        applicationId: input.applicationId,
      },

      orderBy: [
        {
          resource: 'asc',
        },
        {
          action: 'asc',
        },
        {
          code: 'asc',
        },
      ],

      select: {
        id: true,

        code: true,

        name: true,

        description: true,

        resource: true,

        action: true,

        isActive: true,
      },
    });

    return permissions;
  }
}
