# Authentication Service Security

This document describes the security controls implemented by the Authentication Service and the checks required before deployment.

## Authentication Controls

### Password Hashing

Passwords are hashed with bcrypt.

The work factor is configured through:

```text
BCRYPT_COST
```

Production deployments should use a value appropriate for the available hardware while keeping login latency within the accepted service-level objective.

### Generic Authentication Failures

Login failures return the same public response for:

- Unknown email addresses
- Incorrect passwords
- Inactive users
- Unverified users
- Locked accounts

This reduces account-enumeration risks.

A dummy password hash is verified when the email address does not belong to an existing user.

### Failed-Login Lockout

The lockout policy is configured through:

```text
LOGIN_MAX_FAILED_ATTEMPTS
LOGIN_LOCK_DURATION_MINUTES
```

Failed attempts are persisted using optimistic concurrency control.

## Refresh Token Security

Refresh tokens are:

- Stored as hashes
- Rotated after successful use
- Grouped into token families
- Marked as used when replaced
- Rejected after expiration or revocation

Reuse of an old refresh token causes:

- The refresh-token family to be revoked
- The associated session to be revoked
- A `REFRESH_TOKEN_REUSE_DETECTED` audit event
- A generic `INVALID_REFRESH_TOKEN` response

Successful rotation produces a `REFRESH_TOKEN_ROTATED` audit event.

Raw refresh tokens, token hashes, and token identifiers must not be stored in audit metadata.

## Session Security

A session becomes unavailable when:

- It expires
- It is explicitly revoked
- Its refresh-token family is compromised
- Its user is suspended or disabled
- Its user is deleted
- The user's email is not verified

Access-token validation and refresh-token validation must both enforce session availability.

## Rate Limiting

Authentication endpoints use separate rate-limit policies for:

- Login
- Registration
- Email actions
- Password actions
- Refresh-token rotation

Configuration:

```text
AUTH_RATE_LIMIT_LOGIN_MAX
AUTH_RATE_LIMIT_LOGIN_WINDOW_MS

AUTH_RATE_LIMIT_REGISTER_MAX
AUTH_RATE_LIMIT_REGISTER_WINDOW_MS

AUTH_RATE_LIMIT_EMAIL_MAX
AUTH_RATE_LIMIT_EMAIL_WINDOW_MS

AUTH_RATE_LIMIT_PASSWORD_MAX
AUTH_RATE_LIMIT_PASSWORD_WINDOW_MS

AUTH_RATE_LIMIT_REFRESH_MAX
AUTH_RATE_LIMIT_REFRESH_WINDOW_MS
```

Rate-limit responses use:

```text
429 RATE_LIMIT_EXCEEDED
```

## HTTP Request Boundaries

The maximum request body size is configured through:

```text
HTTP_BODY_LIMIT_BYTES
```

Boundary failures produce standardized responses:

| Condition                 | HTTP Status | Error Code               |
| ------------------------- | ----------: | ------------------------ |
| Malformed JSON            |         400 | `INVALID_JSON`           |
| Schema validation failure |         400 | `INVALID_REQUEST`        |
| Unsupported media type    |         415 | `UNSUPPORTED_MEDIA_TYPE` |
| Body limit exceeded       |         413 | `PAYLOAD_TOO_LARGE`      |
| Rate limit exceeded       |         429 | `RATE_LIMIT_EXCEEDED`    |

Error responses must not reflect password, token, secret, or API-key values supplied by clients.

JSON schemas use:

```text
additionalProperties: false
```

Fastify AJV configuration uses:

```text
removeAdditional: false
```

Unknown properties are rejected instead of silently removed.

## CORS

Allowed browser origins are configured through:

```text
CORS_ALLOWED_ORIGINS
```

Multiple origins are comma-separated.

Credentialed CORS is controlled by:

```text
CORS_ALLOW_CREDENTIALS
```

Requests without an `Origin` header remain available for server-to-server communication.

Untrusted browser origins are rejected and must not be reflected in response headers.

## HTTP Security Headers

Helmet applies the following protections:

- Content Security Policy
- Frame denial
- MIME sniffing protection
- Referrer policy
- Cross-domain policy restrictions
- HSTS in production

Authentication responses additionally include:

```text
Cache-Control: no-store, max-age=0
Pragma: no-cache
Expires: 0
```

## Trusted Proxy Configuration

The number of trusted reverse-proxy hops is configured through:

```text
HTTP_TRUST_PROXY_HOPS
```

Use:

```text
0
```

when clients connect directly to the application.

Use:

```text
1
```

only when exactly one trusted reverse proxy or load balancer is in front of the application.

An incorrect value can cause spoofed `X-Forwarded-For` values to be accepted as client IP addresses.

## Sensitive Log Redaction

The logger redacts:

- Authorization headers
- Cookies
- Passwords
- Password hashes
- Access tokens
- Refresh tokens
- Verification tokens
- Password-reset tokens
- OAuth client secrets
- API keys
- Token hashes
- Key hashes

Redacted values appear as:

```text
[REDACTED]
```

Errors must be logged using Pino's `err` field:

```typescript
request.log.error(
  {
    err: error,
  },
  'Unhandled application error',
);
```

Do not log complete request bodies manually unless structured redaction paths cover every sensitive field.

## Audit Events

Security-relevant events include:

```text
LOGIN_SUCCEEDED
LOGIN_FAILED
ACCOUNT_LOCKED
PASSWORD_CHANGED
PASSWORD_RESET_REQUESTED
PASSWORD_RESET_COMPLETED
LOGOUT_SUCCEEDED
SESSION_REVOKED
OTHER_SESSIONS_REVOKED
EMAIL_VERIFIED
REFRESH_TOKEN_ROTATED
REFRESH_TOKEN_REUSE_DETECTED
ROLE_ASSIGNMENTS_REPLACED
ROLE_CREATED
ROLE_UPDATED
ROLE_PERMISSIONS_REPLACED
USER_STATUS_CHANGED
```

Audit entries may include:

- Application ID
- Actor user ID
- Resource type
- Resource ID
- Request ID
- Client IP address
- User agent
- Non-sensitive metadata
- Outcome

Audit entries must not include raw passwords, raw tokens, token hashes, client secrets, or API keys.

## Production Checklist

Before deployment:

- [ ] Use a unique JWT signing secret
- [ ] Do not use example or development secrets
- [ ] Enable HTTPS at the edge
- [ ] Verify HSTS is enabled
- [ ] Configure exact CORS origins
- [ ] Verify credentialed CORS policy
- [ ] Set the correct trusted-proxy hop count
- [ ] Configure PostgreSQL authentication and TLS
- [ ] Configure Redis authentication and TLS when required
- [ ] Verify body limits
- [ ] Verify rate limits
- [ ] Run security integration tests
- [ ] Confirm log redaction
- [ ] Test refresh-token reuse detection
- [ ] Confirm audit-log retention
- [ ] Confirm database backups and restoration procedures

## Verification Commands

Run all static and automated checks:

```bash
npm run check
npm run build
```

Run HTTP security tests:

```bash
npm run test:security
```

Run the complete security gate:

```bash
npm run check:security
```

Run database-backed repository tests:

```bash
npm run test:database
```
