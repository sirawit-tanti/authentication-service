const permissionSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['id', 'code', 'name', 'description', 'resource', 'action', 'isActive'],

  properties: {
    id: {
      type: 'string',

      format: 'uuid',
    },

    code: {
      type: 'string',
    },

    name: {
      type: 'string',
    },

    description: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },

    resource: {
      type: 'string',
    },

    action: {
      type: 'string',
    },

    isActive: {
      type: 'boolean',
    },
  },
} as const;

const roleSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['id', 'code', 'name', 'description', 'isSystem', 'isActive', 'permissions'],

  properties: {
    id: {
      type: 'string',

      format: 'uuid',
    },

    code: {
      type: 'string',
    },

    name: {
      type: 'string',
    },

    description: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },

    isSystem: {
      type: 'boolean',
    },

    isActive: {
      type: 'boolean',
    },

    permissions: {
      type: 'array',

      items: permissionSchema,
    },
  },
} as const;

const errorResponseSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['success', 'error'],

  properties: {
    success: {
      type: 'boolean',

      const: false,
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
} as const;

export const listRolesRouteSchema = {
  tags: ['Authorization'],

  summary: 'List application roles',

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

          const: true,
        },

        data: {
          type: 'object',

          additionalProperties: false,

          required: ['roles'],

          properties: {
            roles: {
              type: 'array',

              items: roleSchema,
            },
          },
        },
      },
    },

    401: errorResponseSchema,

    403: errorResponseSchema,
  },
} as const;

export const listPermissionsRouteSchema = {
  tags: ['Authorization'],

  summary: 'List application permissions',

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

          const: true,
        },

        data: {
          type: 'object',

          additionalProperties: false,

          required: ['permissions'],

          properties: {
            permissions: {
              type: 'array',

              items: permissionSchema,
            },
          },
        },
      },
    },

    401: errorResponseSchema,

    403: errorResponseSchema,
  },
} as const;
