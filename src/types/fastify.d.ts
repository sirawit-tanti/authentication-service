import type { AuthenticatedPrincipal } from '@/interfaces/http/authentication/authenticated-principal.ts';

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedPrincipal: AuthenticatedPrincipal | null;
  }
}
