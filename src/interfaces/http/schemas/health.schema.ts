export const healthRouteSchema = {
  description: 'Return the application and infrastructure health status',

  tags: ['Health'],

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
          required: ['status', 'timestamp', 'dependencies'],

          properties: {
            status: {
              type: 'string',
              enum: ['ok'],
            },

            timestamp: {
              type: 'string',
            },

            dependencies: {
              type: 'object',
              additionalProperties: false,
              required: ['postgresql', 'redis'],

              properties: {
                postgresql: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['status'],

                  properties: {
                    status: {
                      type: 'string',
                      enum: ['connected', 'not_checked'],
                    },
                  },
                },

                redis: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['status'],

                  properties: {
                    status: {
                      type: 'string',
                      enum: ['connected', 'not_checked'],
                    },
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
