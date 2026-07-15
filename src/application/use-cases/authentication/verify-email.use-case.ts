import type { SecureTokenService } from '@/application/ports/crypto/secure-token-service.js';
import type {
  EmailVerificationRepository,
  VerifyEmailResult,
} from '@/application/ports/repositories/email-verification.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

export interface VerifyEmailCommand {
  token: string;
}

export interface VerifyEmailUseCaseDependencies {
  emailVerificationRepository: EmailVerificationRepository;
  secureTokenService: SecureTokenService;
  clock: Clock;
}

export class VerifyEmailUseCase {
  private readonly emailVerificationRepository: EmailVerificationRepository;

  private readonly secureTokenService: SecureTokenService;

  private readonly clock: Clock;

  public constructor(dependencies: VerifyEmailUseCaseDependencies) {
    this.emailVerificationRepository = dependencies.emailVerificationRepository;

    this.secureTokenService = dependencies.secureTokenService;

    this.clock = dependencies.clock;
  }

  public execute(command: VerifyEmailCommand): Promise<VerifyEmailResult> {
    const token = command.token.trim();

    if (token.length === 0) {
      return Promise.reject(new TypeError('Verification token is required'));
    }

    const tokenHash = this.secureTokenService.hash(token);

    return this.emailVerificationRepository.verifyEmail({
      tokenHash,
      verifiedAt: this.clock.now(),
    });
  }
}
