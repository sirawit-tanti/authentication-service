export interface SuccessResponse<TData> {
  success: true;
  message: string;
  data: TData;
}

export interface ApiErrorDetail {
  code: string;
  field?: string;
  message: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors: ApiErrorDetail[];
}

export function createSuccessResponse<TData>(message: string, data: TData): SuccessResponse<TData> {
  return {
    success: true,
    message,
    data,
  };
}

export function createErrorResponse(message: string, errors: ApiErrorDetail[] = []): ErrorResponse {
  return { success: false, message, errors };
}
