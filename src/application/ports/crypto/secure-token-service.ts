export interface SecureTokenService {
  generate(): string;

  hash(token: string): string;
}
