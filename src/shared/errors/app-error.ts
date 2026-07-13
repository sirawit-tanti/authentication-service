import type { ApiErrorDetail } from '../http/api-response.js';

interface AppErrorOptions {
  code: string;
  message: string;
  statusCode: number;
  errors?: ApiErrorDetail[];
  cause?: unknown;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly errors: ApiErrorDetail[];
  public readonly isOperational: boolean;
  public override readonly cause?: unknown;

  public constructor(options: AppErrorOptions) {
    super(options.message);

    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.errors = options.errors ?? [];
    this.isOperational = options.isOperational ?? true;
    this.cause = options.cause;

    Error.captureStackTrace(this, new.target);
  }
}
