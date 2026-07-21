import {
  decodeAuditLogCursor,
  encodeAuditLogCursor,
  InvalidAuditLogCursorError,
} from '../../../../src/interfaces/http/modules/auditing/audit-log-cursor.js';

const AUDIT_LOG_ID = 'a0f72720-71ee-4b52-81ef-b999014fa23f';

const CREATED_AT = new Date('2026-07-20T10:00:00.000Z');

describe('AuditLogCursor', () => {
  it('encodes and decodes an audit log cursor', () => {
    const encodedCursor = encodeAuditLogCursor({
      createdAt: CREATED_AT,
      id: AUDIT_LOG_ID,
    });

    const decodedCursor = decodeAuditLogCursor(encodedCursor);

    expect(decodedCursor).toEqual({
      createdAt: CREATED_AT,
      id: AUDIT_LOG_ID,
    });
  });

  it('creates a URL-safe cursor', () => {
    const encodedCursor = encodeAuditLogCursor({
      createdAt: CREATED_AT,
      id: AUDIT_LOG_ID,
    });

    expect(encodedCursor).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it('rejects a cursor that is not valid JSON', () => {
    const invalidCursor = Buffer.from('not-json', 'utf8').toString('base64url');

    expect(() => decodeAuditLogCursor(invalidCursor)).toThrow(InvalidAuditLogCursorError);
  });

  it('rejects a cursor with an invalid UUID', () => {
    const invalidCursor = Buffer.from(
      JSON.stringify({
        createdAt: CREATED_AT.toISOString(),
        id: 'invalid-id',
      }),
      'utf8',
    ).toString('base64url');

    expect(() => decodeAuditLogCursor(invalidCursor)).toThrow(InvalidAuditLogCursorError);
  });

  it('rejects a cursor with an invalid date', () => {
    const invalidCursor = Buffer.from(
      JSON.stringify({
        createdAt: 'invalid-date',
        id: AUDIT_LOG_ID,
      }),
      'utf8',
    ).toString('base64url');

    expect(() => decodeAuditLogCursor(invalidCursor)).toThrow(InvalidAuditLogCursorError);
  });

  it('rejects a cursor with additional properties', () => {
    const invalidCursor = Buffer.from(
      JSON.stringify({
        createdAt: CREATED_AT.toISOString(),
        id: AUDIT_LOG_ID,
        applicationId: 'd797d3eb-41ce-40cf-9d79-30b15fe49042',
      }),
      'utf8',
    ).toString('base64url');

    expect(() => decodeAuditLogCursor(invalidCursor)).toThrow(InvalidAuditLogCursorError);
  });

  it('rejects an empty cursor', () => {
    expect(() => decodeAuditLogCursor('')).toThrow(InvalidAuditLogCursorError);
  });
});
