export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
}

export interface ApiErrorDetail {
  code: string;
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;

  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export function createSuccessResponse<TData>(data: TData): ApiSuccessResponse<TData> {
  return {
    success: true,
    data,
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: ApiErrorDetail[],
): ApiErrorResponse {
  if (details === undefined || details.length === 0) {
    return {
      success: false,

      error: {
        code,
        message,
      },
    };
  }

  return {
    success: false,

    error: {
      code,
      message,
      details,
    },
  };
}
