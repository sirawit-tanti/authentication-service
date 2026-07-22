export interface CheckAccessTokenBlacklistInput {
  jti: string;
  checkedAt: Date;
}

export interface BlacklistAccessTokenInput {
  jti: string;
  expiresAt: Date;
  reason: string;
  blacklistedAt: Date;
}

export interface AccessTokenBlacklistRepository {
  isBlacklisted(input: CheckAccessTokenBlacklistInput): Promise<boolean>;

  blacklist(input: BlacklistAccessTokenInput): Promise<void>;
}
