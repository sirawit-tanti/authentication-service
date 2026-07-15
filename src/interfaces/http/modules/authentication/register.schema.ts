import { z } from 'zod';

export const registerRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, {
        error: 'Email is required',
      })
      .max(320, {
        error: 'Email must not exceed 320 characters',
      })
      .pipe(z.email()),

    password: z
      .string()
      .min(1, {
        error: 'Password is required',
      })
      .max(128, {
        error: 'Password must not exceed 128 characters',
      }),
  })
  .strict();

export type RegisterRequestBody = z.infer<typeof registerRequestSchema>;

export interface RegisterResponseData {
  userId: string;
  email: string;
  status: 'PENDING_VERIFICATION';
}

export const registerRouteSchema = {
  description: 'Register a new user account',
  tags: ['Authentication'],

  body: {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password'],

    properties: {
      email: {
        type: 'string',
        minLength: 1,
        maxLength: 320,
      },

      password: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
      },
    },
  },

  response: {
    201: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'data'],

      properties: {
        success: {
          type: 'boolean',
          enum: [true],
        },

        data: {
          type: 'object',
          additionalProperties: false,
          required: ['userId', 'email', 'status'],

          properties: {
            userId: {
              type: 'string',
            },

            email: {
              type: 'string',
            },

            status: {
              type: 'string',
              enum: ['PENDING_VERIFICATION'],
            },
          },
        },
      },
    },

    400: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'error'],

      properties: {
        success: {
          type: 'boolean',
          enum: [false],
        },

        error: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'message'],

          properties: {
            code: {
              type: 'string',
            },

            message: {
              type: 'string',
            },

            details: {
              type: 'array',

              items: {
                type: 'object',
                additionalProperties: false,
                required: ['code', 'message'],

                properties: {
                  code: {
                    type: 'string',
                  },

                  field: {
                    type: 'string',
                  },

                  message: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    },

    409: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'error'],

      properties: {
        success: {
          type: 'boolean',
          enum: [false],
        },

        error: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'message'],

          properties: {
            code: {
              type: 'string',
            },

            message: {
              type: 'string',
            },
          },
        },
      },
    },

    422: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'error'],

      properties: {
        success: {
          type: 'boolean',
          enum: [false],
        },

        error: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'message'],

          properties: {
            code: {
              type: 'string',
            },

            message: {
              type: 'string',
            },

            details: {
              type: 'array',

              items: {
                type: 'object',
                additionalProperties: false,
                required: ['code', 'message'],

                properties: {
                  code: {
                    type: 'string',
                  },

                  field: {
                    type: 'string',
                  },

                  message: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
