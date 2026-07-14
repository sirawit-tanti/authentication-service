import type { DomainValidationIssue } from '@/shared/errors/domain-validation.error.js';

const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 128;

export interface PasswordPolicyContext {
  normalizedEmail?: string;
}

export interface PasswordPolicyResult {
  valid: boolean;
  issues: DomainValidationIssue[];
}

export class PasswordPolicy {
  public validate(password: string, context: PasswordPolicyContext = {}): PasswordPolicyResult {
    const issues: DomainValidationIssue[] = [];

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      issues.push({
        code: 'PASSWORD_TOO_SHORT',
        field: 'password',
        message: `Password must contain at least ${String(MINIMUM_PASSWORD_LENGTH)} characters`,
      });
    }

    if (password.length > MAXIMUM_PASSWORD_LENGTH) {
      issues.push({
        code: 'PASSWORD_TOO_LONG',
        field: 'password',
        message: `Password must not exceed ${String(MAXIMUM_PASSWORD_LENGTH)} characters`,
      });
    }

    if (!/[a-z]/.test(password)) {
      issues.push({
        code: 'PASSWORD_LOWERCASE_REQUIRED',
        field: 'password',
        message: 'Password must contain at least one lowercase letter',
      });
    }

    if (!/[A-Z]/.test(password)) {
      issues.push({
        code: 'PASSWORD_UPPERCASE_REQUIRED',
        field: 'password',
        message: 'Password must contain at least one uppercase letter',
      });
    }

    if (!/\d/.test(password)) {
      issues.push({
        code: 'PASSWORD_NUMBER_REQUIRED',
        field: 'password',
        message: 'Password must contain at least one number',
      });
    }

    if (!/[^a-zA-Z0-9\s]/.test(password)) {
      issues.push({
        code: 'PASSWORD_SPECIAL_CHARACTER_REQUIRED',
        field: 'password',
        message: 'Password must contain at least one special character',
      });
    }

    if (/\s/.test(password)) {
      issues.push({
        code: 'PASSWORD_WHITESPACE_NOT_ALLOWED',
        field: 'password',
        message: 'Password must not contain whitespace',
      });
    }

    const normalizedEmail = context.normalizedEmail;

    if (normalizedEmail !== undefined) {
      const emailLocalPart = normalizedEmail.split('@')[0];

      if (
        emailLocalPart !== undefined &&
        emailLocalPart.length >= 3 &&
        password.toLowerCase().includes(emailLocalPart.toLowerCase())
      ) {
        issues.push({
          code: 'PASSWORD_CONTAINS_EMAIL',
          field: 'password',
          message: 'Password must not contain the email local part',
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
