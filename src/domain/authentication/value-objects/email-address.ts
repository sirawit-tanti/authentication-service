import { DomainValidationError } from '@/domain/errors/domain-validation.error.js';

const MAXIMUM_EMAIL_LENGTH = 320;
const MAXIMUM_LOCAL_PART_LENGTH = 64;
const MAXIMUM_DOMAIN_LENGTH = 255;

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

interface EmailValidationIssue {
  code: string;
  field: string;
  message: string;
}

export class EmailAddress {
  public readonly value: string;

  public readonly normalizedValue: string;

  private constructor(value: string, normalizedValue: string) {
    this.value = value;
    this.normalizedValue = normalizedValue;
  }

  public static create(input: string): EmailAddress {
    const value = input.trim();
    const issues = EmailAddress.validate(value);

    if (issues.length > 0) {
      throw new DomainValidationError('Email address is invalid', issues);
    }

    return new EmailAddress(value, value.toLowerCase());
  }

  public equals(other: EmailAddress): boolean {
    return this.normalizedValue === other.normalizedValue;
  }

  public toString(): string {
    return this.value;
  }

  private static validate(value: string): EmailValidationIssue[] {
    const issues: EmailValidationIssue[] = [];

    if (value.length === 0) {
      issues.push({
        code: 'EMAIL_REQUIRED',
        field: 'email',
        message: 'Email is required',
      });

      return issues;
    }

    if (value.length > MAXIMUM_EMAIL_LENGTH) {
      issues.push({
        code: 'EMAIL_TOO_LONG',
        field: 'email',
        message: `Email must not exceed ${String(MAXIMUM_EMAIL_LENGTH)} characters`,
      });
    }

    if (/\s/.test(value)) {
      issues.push({
        code: 'EMAIL_CONTAINS_WHITESPACE',
        field: 'email',
        message: 'Email must not contain whitespace',
      });
    }

    const atSymbolIndex = value.lastIndexOf('@');

    if (atSymbolIndex <= 0 || atSymbolIndex === value.length - 1) {
      issues.push({
        code: 'EMAIL_INVALID_FORMAT',
        field: 'email',
        message: 'Email format is invalid',
      });

      return issues;
    }

    const localPart = value.slice(0, atSymbolIndex);
    const domain = value.slice(atSymbolIndex + 1);

    if (localPart.length > MAXIMUM_LOCAL_PART_LENGTH) {
      issues.push({
        code: 'EMAIL_LOCAL_PART_TOO_LONG',
        field: 'email',
        message: `Email local part must not exceed ${String(MAXIMUM_LOCAL_PART_LENGTH)} characters`,
      });
    }

    if (domain.length > MAXIMUM_DOMAIN_LENGTH) {
      issues.push({
        code: 'EMAIL_DOMAIN_TOO_LONG',
        field: 'email',
        message: `Email domain must not exceed ${String(MAXIMUM_DOMAIN_LENGTH)} characters`,
      });
    }

    if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
      issues.push({
        code: 'EMAIL_INVALID_LOCAL_PART',
        field: 'email',
        message: 'Email local part contains an invalid dot position',
      });
    }

    if (!EMAIL_PATTERN.test(value)) {
      issues.push({
        code: 'EMAIL_INVALID_FORMAT',
        field: 'email',
        message: 'Email format is invalid',
      });
    }

    return issues;
  }
}
