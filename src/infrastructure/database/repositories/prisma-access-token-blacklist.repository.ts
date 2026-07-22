import type {
  AccessTokenBlacklistRepository,
  BlacklistAccessTokenInput,
  CheckAccessTokenBlacklistInput,
} from '@/application/ports/repositories/access-token-blacklist.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const ACCESS_TOKEN_TYPE = 'ACCESS_TOKEN';

export class PrismaAccessTokenBlacklistRepository implements AccessTokenBlacklistRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async isBlacklisted(input: CheckAccessTokenBlacklistInput): Promise<boolean> {
    const token = await this.prisma.tokenBlacklist.findFirst({
      where: {
        jti: input.jti,
        tokenType: ACCESS_TOKEN_TYPE,
        expiresAt: {
          gt: input.checkedAt,
        },
      },

      select: {
        id: true,
      },
    });

    return token !== null;
  }

  public async blacklist(input: BlacklistAccessTokenInput): Promise<void> {
    if (input.expiresAt <= input.blacklistedAt) {
      return;
    }

    await this.prisma.tokenBlacklist.upsert({
      where: {
        jti: input.jti,
      },

      create: {
        jti: input.jti,
        tokenType: ACCESS_TOKEN_TYPE,
        reason: input.reason,
        expiresAt: input.expiresAt,
        createdAt: input.blacklistedAt,
      },

      update: {
        tokenType: ACCESS_TOKEN_TYPE,
        reason: input.reason,
        expiresAt: input.expiresAt,
      },
    });
  }
}
