export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'message', 'data'],

  properties: {
    success: {
      type: 'boolean',
      enum: [true],
    },

    message: {
      type: 'string',
    },

    data: {
      type: 'object',
      additionalProperties: false,
      required: ['service', 'status', 'timestamp', 'uptime'],

      properties: {
        service: {
          type: 'string',
        },

        status: {
          type: 'string',
          enum: ['healthy'],
        },

        timestamp: {
          type: 'string',
          format: 'date-time',
        },

        uptime: {
          type: 'number',
          minimum: 0,
        },
      },
    },
  },
} as const;
