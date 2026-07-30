# Authentication Service

A production-oriented authentication and authorization service built with Node.js, Fastify, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Prometheus, and OpenTelemetry.

The project is designed as a realistic backend service rather than a basic CRUD example. It includes authentication flows, role-based authorization, audit logging, background jobs, an outbox pattern, observability, security controls, automated tests, and CI-ready quality gates.

## Features

### Authentication

- User registration
- Email verification
- Login and logout
- Access and refresh token rotation
- Forgot-password and reset-password flows
- Password change
- Session listing and revocation
- Current-user endpoint
- Login rate limiting

### Authorization

- Role-based access control
- Permission catalog
- User role assignment
- Custom role management
- Application-scoped authorization

### Administration and Auditing

- User administration
- User status management
- Audit log storage and querying
- Request metadata tracking
- Cursor-based audit-log pagination

### Background Processing

- PostgreSQL transactional outbox
- BullMQ email queue
- Dedicated outbox worker
- Dedicated email worker
- Retry and exponential backoff
- Idempotent custom job IDs
- Graceful shutdown

### Security

- Strict request validation
- Sensitive log redaction
- Secure HTTP headers
- Configurable CORS policy
- Trusted-proxy configuration
- Password hashing
- Token hashing
- Secret validation
- Request-size boundaries
- Rate limiting

### Observability

- Prometheus metrics
- OpenAPI and Swagger documentation
- OpenTelemetry tracing
- OTLP Collector
- Jaeger trace visualization
- HTTP, Redis, PostgreSQL, BullMQ, outbox, and email spans
- Trace correlation in structured logs
- Privacy-conscious span attributes

## Technology Stack

| Area                      | Technology                |
| ------------------------- | ------------------------- |
| Runtime                   | Node.js 22                |
| Language                  | TypeScript                |
| HTTP framework            | Fastify 5                 |
| Database                  | PostgreSQL                |
| ORM                       | Prisma 7                  |
| Cache and queue transport | Redis                     |
| Background jobs           | BullMQ                    |
| Validation                | Fastify JSON Schema / AJV |
| Logging                   | Pino                      |
| Metrics                   | Prometheus                |
| Tracing                   | OpenTelemetry             |
| Trace backend             | Jaeger                    |
| Testing                   | Vitest                    |
| Containers                | Docker Compose            |
| CI                        | GitHub Actions            |

## Architecture

The service follows a layered architecture:

```text
src/
├── application/
│   ├── jobs/
│   ├── ports/
│   ├── services/
│   └── use-cases/
├── domain/
├── infrastructure/
│   ├── database/
│   ├── email/
│   ├── observability/
│   ├── queue/
│   └── system/
├── interfaces/
│   └── http/
├── shared/
└── workers/
```

Main responsibilities:

- `domain`: business entities and domain rules
- `application`: use cases, ports, jobs, and orchestration
- `infrastructure`: Prisma, Redis, BullMQ, email providers, metrics, and tracing
- `interfaces`: HTTP controllers, routes, guards, and request handling
- `shared`: configuration, logging, errors, and runtime utilities
- `workers`: outbox and email worker bootstraps

## Request and Event Flow

A typical asynchronous password-reset flow:

```text
HTTP request
└── Forgot-password use case
    └── PostgreSQL transaction
        ├── Store reset-token data
        └── Insert outbox message
            └── Outbox worker
                └── BullMQ publish
                    └── Email worker
                        └── Email provider
```

Trace context is propagated through the BullMQ payload so HTTP, outbox, queue, and email processing can be correlated in Jaeger and structured logs.

## Requirements

- Node.js 22
- npm
- Docker Desktop or Docker Engine with Docker Compose
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd authentication-service
```

### 2. Create the environment file

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update the values in `.env` before starting the application.

Never commit production secrets.

### 3. Install dependencies

```bash
npm ci
```

### 4. Start infrastructure and services

```bash
docker compose up --build --detach
```

Check service status:

```bash
docker compose ps
```

### 5. Generate Prisma Client

```bash
npm run generate
```

### 6. Apply database migrations

```bash
npx prisma migrate deploy
```

For local development where a new migration is required:

```bash
npx prisma migrate dev
```

## Running Locally

Start the API in development mode using the script defined in `package.json`:

```bash
npm run dev
```

The Docker Compose stack includes:

- API service
- PostgreSQL
- Redis
- Outbox worker
- Email worker
- OpenTelemetry Collector
- Jaeger

## API Endpoints

Important authentication endpoints include:

| Method | Endpoint                       | Description                        |
| ------ | ------------------------------ | ---------------------------------- |
| `POST` | `/api/v1/auth/register`        | Register a user                    |
| `POST` | `/api/v1/auth/verify-email`    | Verify an email address            |
| `POST` | `/api/v1/auth/login`           | Authenticate a user                |
| `POST` | `/api/v1/auth/refresh`         | Rotate a refresh token             |
| `POST` | `/api/v1/auth/logout`          | Revoke the current session         |
| `POST` | `/api/v1/auth/forgot-password` | Request a password reset           |
| `POST` | `/api/v1/auth/reset-password`  | Reset a password                   |
| `GET`  | `/api/v1/auth/me`              | Return the authenticated principal |
| `GET`  | `/api/v1/health/live`          | Liveness check                     |
| `GET`  | `/api/v1/health/ready`         | Readiness check                    |
| `GET`  | `/metrics`                     | Prometheus metrics                 |

Some endpoints require an `applicationId` because users, roles, permissions, and audit data are application-scoped.

## API Documentation

When Swagger is enabled, open the documentation endpoint configured by the application.

The generated OpenAPI document includes bearer authentication and request/response schemas.

## Example Login Request

```bash
curl \
  --request POST \
  --header "content-type: application/json" \
  --data '{
    "applicationId": "00000000-0000-0000-0000-000000000000",
    "email": "sirawit@example.com",
    "password": "ExamplePassword#2026"
  }' \
  http://localhost:3000/api/v1/auth/login
```

Replace the sample application ID and credentials with records from your local database.

## Quality Checks

Run the complete local quality gate:

```bash
npm run check
```

Build the application:

```bash
npm run build
```

Run the security-focused test suite:

```bash
npm run test:security
```

The quality gate covers:

- Prisma Client generation
- TypeScript type checking
- ESLint
- Prettier validation
- Unit tests
- Integration tests

## Testing

Run all tests:

```bash
npm test
```

Run a single test file:

```bash
npx vitest run path/to/file.test.ts
```

Repository integration tests that require a real database may be skipped unless the required test environment is enabled.

## Observability

### Prometheus

Metrics are exposed from:

```text
GET /metrics
```

Access can be protected using the configured metrics bearer token.

### Jaeger

With the Docker Compose observability stack running, open:

```text
http://localhost:16686
```

Expected services include:

```text
authentication-service
authentication-service-outbox-worker
authentication-service-email-worker
```

Typical traces include:

```text
HTTP request
├── PostgreSQL
├── Redis
└── application operation
```

and:

```text
outbox.dispatch
└── messaging.publish
    └── messaging.process
        └── email.send
```

### Structured Log Correlation

Logs written inside an active span include:

```json
{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "traceSampled": true
}
```

Sensitive values such as passwords, tokens, cookies, authorization headers, and email-job secrets are redacted.

## Graceful Shutdown

The API and workers handle `SIGINT` and `SIGTERM`.

Worker shutdown waits for active processing to finish before closing Redis, BullMQ, Prisma, and tracing resources.

## Docker Commands

Start all services:

```bash
docker compose up --build --detach
```

View logs:

```bash
docker compose logs --follow
```

View selected service logs:

```bash
docker compose logs --follow app email-worker outbox-worker
```

Stop services without deleting data volumes:

```bash
docker compose down
```

Avoid `docker compose down -v` unless deleting PostgreSQL and Redis volumes is intentional.

## Continuous Integration

The GitHub Actions workflow runs on pushes and pull requests and performs:

```text
npm ci
npm run check
npm run build
npm run test:security
```

```markdown
[![Continuous Integration](https://github.com/sirawit-tanti/authentication-service/actions/workflows/ci.yml/badge.svg)](https://github.com/sirawit-tanti/authentication-service/actions/workflows/ci.yml)
```

## Project Status

Implemented:

- Authentication and session management
- Application-scoped RBAC
- User administration
- Audit logs
- PostgreSQL outbox
- BullMQ workers
- Prometheus metrics
- OpenAPI documentation
- OpenTelemetry distributed tracing
- Structured-log trace correlation
- Automated quality and security tests
- Docker Compose development stack

## Portfolio Highlights

This project demonstrates:

- Clean separation between domain, application, infrastructure, and interface layers
- Secure authentication and authorization design
- Transactional consistency using the outbox pattern
- Asynchronous processing with retry behavior
- Observability across HTTP, database, cache, queue, and workers
- Privacy-aware logging and tracing
- Automated testing and CI quality gates
- Production-oriented shutdown and configuration handling

## License

This project is currently intended for portfolio and educational use.

Add an explicit license before distributing or using it commercially.
