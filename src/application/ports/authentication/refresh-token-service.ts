export interface GeneratedRefreshToken {
  rawToken: string;
  tokenHash: string;
  jti: string;
}

export interface RefreshTokenService {
  generate(): GeneratedRefreshToken;

  hash(rawToken: string): string;
}
