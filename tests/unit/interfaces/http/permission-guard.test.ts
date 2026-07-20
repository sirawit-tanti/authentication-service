import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  CheckPermissionInput,
  PermissionChecker,
} from '../../../../src/application/ports/authorization/permission-checker.js';
import type { Clock } from '../../../../src/application/ports/system/clock.js';
import {
  createPermissionGuard,
  type PermissionGuard,
} from '../../../../src/interfaces/http/authorization/permission-guard.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const FIXED_NOW = new Date('2026-07-20T00:00:00.000Z');

const PERMISSION_CODE = 'audit_logs.read';

class FakePermissionChecker implements PermissionChecker {
  public permitted = true;

  public input: CheckPermissionInput | null = null;

  public hasPermission(input: CheckPermissionInput): Promise<boolean> {
    this.input = input;

    return Promise.resolve(this.permitted);
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

interface ReplyState {
  statusCode: number | null;
  payload: unknown;
  sent: boolean;
}

interface ReplyDouble {
  status(statusCode: number): ReplyDouble;
  send(payload: unknown): ReplyDouble;
}

function createRequest(authenticated: boolean): FastifyRequest {
  return {
    authenticatedPrincipal: authenticated
      ? {
          userId: USER_ID,

          email: 'sirawit@example.com',

          applicationId: APPLICATION_ID,

          sessionId: SESSION_ID,
        }
      : null,
  } as unknown as FastifyRequest;
}

function createReply(): {
  reply: FastifyReply;
  state: ReplyState;
} {
  const state: ReplyState = {
    statusCode: null,
    payload: null,
    sent: false,
  };

  const replyDouble: ReplyDouble = {
    status(statusCode: number): ReplyDouble {
      state.statusCode = statusCode;

      return replyDouble;
    },

    send(payload: unknown): ReplyDouble {
      state.payload = payload;

      state.sent = true;

      return replyDouble;
    },
  };

  return {
    reply: replyDouble as unknown as FastifyReply,

    state,
  };
}

function createGuard(permissionChecker: PermissionChecker): PermissionGuard {
  return createPermissionGuard({
    permissionChecker,

    clock: new FixedClock(),

    permissionCode: PERMISSION_CODE,
  });
}

describe('PermissionGuard', () => {
  it('allows a principal with the required permission', async () => {
    const permissionChecker = new FakePermissionChecker();

    const permissionGuard = createGuard(permissionChecker);

    const request = createRequest(true);

    const { reply, state } = createReply();

    await permissionGuard(request, reply);

    expect(state.sent).toBe(false);

    expect(state.statusCode).toBeNull();

    expect(state.payload).toBeNull();

    expect(permissionChecker.input).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      permissionCode: PERMISSION_CODE,

      checkedAt: FIXED_NOW,
    });
  });

  it('returns 403 when permission is missing', async () => {
    const permissionChecker = new FakePermissionChecker();

    permissionChecker.permitted = false;

    const permissionGuard = createGuard(permissionChecker);

    const request = createRequest(true);

    const { reply, state } = createReply();

    await permissionGuard(request, reply);

    expect(state.statusCode).toBe(403);

    expect(state.sent).toBe(true);

    expect(state.payload).toEqual({
      success: false,

      error: {
        code: 'FORBIDDEN',

        message: 'You do not have permission to perform this action',
      },
    });

    expect(permissionChecker.input).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      permissionCode: PERMISSION_CODE,

      checkedAt: FIXED_NOW,
    });
  });

  it('returns 401 when authentication is missing', async () => {
    const permissionChecker = new FakePermissionChecker();

    const permissionGuard = createGuard(permissionChecker);

    const request = createRequest(false);

    const { reply, state } = createReply();

    await permissionGuard(request, reply);

    expect(state.statusCode).toBe(401);

    expect(state.sent).toBe(true);

    expect(state.payload).toEqual({
      success: false,

      error: {
        code: 'UNAUTHORIZED',

        message: 'Authentication is required',
      },
    });

    expect(permissionChecker.input).toBeNull();
  });
});
