export const meRouteSchema = {
  description: 'Return the currently authenticated user',

  tags: ['Authentication'],

  security: [
    {
      bearerAuth: [],
    },
  ],

  response: {
    200: {
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

          required: ['userId', 'email', 'applicationId', 'sessionId'],

          properties: {
            userId: {
              type: 'string',
              format: 'uuid',
            },

            email: {
              type: 'string',
            },

            applicationId: {
              type: 'string',
              format: 'uuid',
            },

            sessionId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
      },
    },

    401: {
      type: 'object',
      additionalProperties: true,
    },
  },
} as const;
