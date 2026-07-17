export interface DomainValidationIssue {
  code: string;
  field?: string;
  message: string;
}

export class DomainValidationError extends Error {
  public readonly issues: DomainValidationIssue[];

  public constructor(message: string, issues: DomainValidationIssue[]) {
    super(message);

    this.name = 'DomainValidationError';
    this.issues = issues;

    Error.captureStackTrace(this, new.target);
  }
}
