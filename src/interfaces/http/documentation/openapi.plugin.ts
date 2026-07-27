import { createHash, timingSafeEqual } from 'node:crypto';

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync, FastifyRequest, onRequestHookHandler } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

export interface OpenApiPluginOptions {
  enabled: boolean;
  environment: 'development' | 'test' | 'production';
  applicationName: string;
  applicationVersion: string;
  bearerToken?: string;
}

function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (authorizationHeader === undefined) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/iu.exec(authorizationHeader.trim());

  const token = match?.[1]?.trim();

  if (token === undefined || token.length === 0) {
    return undefined;
  }

  return token;
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

function secureTokensMatch(receivedToken: string, expectedToken: string): boolean {
  return timingSafeEqual(hashToken(receivedToken), hashToken(expectedToken));
}

function createDocumentationAuthorizationHook(input: {
  authenticationRequired: boolean;
  expectedBearerToken: string | undefined;
}): onRequestHookHandler {
  return (request, reply, done): void => {
    if (!input.authenticationRequired) {
      done();

      return;
    }

    const receivedToken = extractBearerToken(request.headers.authorization);

    const authorized =
      input.expectedBearerToken !== undefined &&
      receivedToken !== undefined &&
      secureTokensMatch(receivedToken, input.expectedBearerToken);

    if (!authorized) {
      void reply.status(401).send({
        success: false,

        error: {
          code: 'UNAUTHORIZED',
          message: 'Documentation authentication is required',
        },
      });

      return;
    }

    done();
  };
}

function resolveServerUrl(request: FastifyRequest): string {
  return `${request.protocol}://${request.host}`;
}

const openApiPluginImplementation: FastifyPluginAsync<OpenApiPluginOptions> = async (
  fastify,
  options,
): Promise<void> => {
  if (!options.enabled) {
    return;
  }

  const expectedBearerToken = options.bearerToken?.trim();

  const authenticationRequired =
    options.environment === 'production' || expectedBearerToken !== undefined;

  const authorizationHook = createDocumentationAuthorizationHook({
    authenticationRequired,
    expectedBearerToken,
  });

  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',

      info: {
        title: 'Authentication Service API',

        description:
          'Central authentication, session management, authorization, user administration, and auditing service.',

        version: options.applicationVersion,
      },

      tags: [
        {
          name: 'Authentication',

          description: 'Registration, login, tokens, password management, and user sessions',
        },

        {
          name: 'Authorization',

          description: 'Roles, permissions, and user-role assignments',
        },

        {
          name: 'Users',

          description: 'Administrative user management',
        },

        {
          name: 'Auditing',

          description: 'Security audit log access',
        },

        {
          name: 'Operations',

          description: 'Service health and operational endpoints',
        },
      ],

      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',

            description: 'JWT access token issued by the login or refresh endpoint',
          },
        },
      },
    },

    exposeHeadRoutes: false,
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',

    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: false,

      tryItOutEnabled: options.environment !== 'production',
    },

    staticCSP: true,

    transformStaticCSP(header): string {
      return header;
    },

    transformSpecification(openApiObject, request) {
      return {
        ...openApiObject,

        servers: [
          {
            url: resolveServerUrl(request),

            description: 'Current authentication service instance',
          },
        ],
      };
    },

    transformSpecificationClone: true,

    uiHooks: {
      onRequest: authorizationHook,
    },

    logLevel: 'silent',
  });
};

export const openApiPlugin = fastifyPlugin(openApiPluginImplementation, {
  name: 'openapi-plugin',
});
