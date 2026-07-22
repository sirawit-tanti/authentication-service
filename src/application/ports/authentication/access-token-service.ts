export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  applicationId: string;
  email: string;
}

export interface CreateAccessTokenInput {
  claims: AccessTokenClaims;
  issuedAt: Date;
}

export interface VerifyAccessTokenInput {
  token: string;
  verifiedAt?: Date;
}

export interface VerifyAccessTokenResult {
  jti: string;
  userId: string;
  sessionId: string;
  applicationId: string;
  email: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface AccessTokenService {
  create(input: CreateAccessTokenInput): Promise<string>;

  verify(input: VerifyAccessTokenInput): Promise<VerifyAccessTokenResult>;
}
