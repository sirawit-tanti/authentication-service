import type {
  CheckPermissionInput,
  PermissionChecker,
} from '@/application/ports/authorization/permission-checker.js';
import type { ApplicationPrismaClient } from '@/infrastructure/database/prisma-client.js';

export class PrismaPermissionChecker implements PermissionChecker {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async hasPermission(input: CheckPermissionInput): Promise<boolean> {
    const userRole = await this.prisma.userRole.findFirst({
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

          rolePermissions: {
            some: {
              permission: {
                applicationId: input.applicationId,

                code: input.permissionCode,

                isActive: true,
              },
            },
          },
        },
      },

      select: {
        id: true,
      },
    });

    return userRole !== null;
  }
}
