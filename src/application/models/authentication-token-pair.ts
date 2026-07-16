export interface AuthenticationTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresAt: Date;
}
