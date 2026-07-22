# Authentication Service Operations

## Health endpoints

### Liveness

```http
GET /api/v1/health/live
```

Liveness confirms that the Node.js process and Fastify HTTP server can respond.

It does not check PostgreSQL, Redis, BullMQ, email delivery, or background workers.

Expected healthy response:

```json
{
  "success": true,
  "data": {
    "status": "alive",
    "timestamp": "2026-07-22T08:00:00.000Z",
    "uptimeSeconds": 120
  }
}
```

Expected HTTP status:

```text
200 OK
```

A liveness failure should normally cause the container or orchestrator to restart the process.

## Readiness

```http
GET /api/v1/health/ready
```

Readiness checks:

- PostgreSQL with `SELECT 1`
- Redis with `PING`
- A separate timeout for each dependency

Expected healthy response:

```json
{
  "success": true,
  "data": {
    "status": "ready",
    "timestamp": "2026-07-22T08:00:00.000Z",
    "dependencies": {
      "postgresql": {
        "status": "connected",
        "responseTimeMilliseconds": 3
      },
      "redis": {
        "status": "connected",
        "responseTimeMilliseconds": 1
      }
    }
  }
}
```

Expected HTTP status:

```text
200 OK
```

An unavailable dependency returns:

```text
503 Service Unavailable
```

Possible dependency states:

- `connected`
- `unavailable`
- `timeout`
- `not_checked`

Dependency exception messages are not returned to clients.

## Legacy health endpoint

```http
GET /api/v1/health
```

This endpoint is retained as a compatibility alias for readiness.

New infrastructure integrations should use:

```text
/api/v1/health/live
/api/v1/health/ready
```

## Docker health check

The application container uses:

```text
GET /api/v1/health/ready
```

Check container health:

```bash
docker compose ps

docker inspect \
  --format='{{json .State.Health}}' \
  authentication-service-app
```

Inspect application logs:

```bash
docker compose logs \
  --tail 200 \
  app
```

Follow application logs:

```bash
docker compose logs \
  --follow \
  app
```

## Graceful shutdown

The HTTP server handles:

```text
SIGTERM
SIGINT
```

Shutdown sequence:

1. Fastify stops accepting new requests.
2. Fastify waits for active requests according to its close behavior.
3. The infrastructure `onClose` hook closes the BullMQ producer queue.
4. Prisma disconnects from PostgreSQL.
5. Redis closes gracefully.
6. The process exit code is set.

The application graceful-shutdown timeout is 15 seconds.

Docker gives the application 20 seconds through:

```yaml
stop_grace_period: 20s
```

This leaves approximately five seconds for Docker to complete container termination after the application timeout.

Test shutdown locally:

```bash
docker compose stop app
```

Then inspect the logs for:

```text
Authentication service shutdown started
Authentication service stopped gracefully
```

## Readiness troubleshooting

### PostgreSQL unavailable

Check the container:

```bash
docker compose ps postgres

docker compose logs \
  --tail 100 \
  postgres
```

Verify PostgreSQL from the application container:

```bash
docker compose exec app \
  node -e \
  "import('pg').then(async ({ Client }) => { const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect(); console.log(await client.query('SELECT 1')); await client.end(); })"
```

### Redis unavailable

Check the container:

```bash
docker compose ps redis

docker compose logs \
  --tail 100 \
  redis
```

Verify Redis from the Redis container:

```bash
docker compose exec redis \
  sh -lc \
  'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
```

Expected result:

```text
PONG
```

## Deployment verification

After deployment:

```bash
curl --fail \
  http://localhost:3000/api/v1/health/live

curl --fail \
  http://localhost:3000/api/v1/health/ready
```

Then verify a protected endpoint with a valid access token.

## Failure policy

- Liveness failure: restart the process.
- Readiness failure: stop routing new requests to the instance.
- PostgreSQL failure: the service is not ready.
- Redis failure: the service is not ready.
- Email worker failure: investigate the worker separately.
- Outbox worker failure: investigate the worker separately.

Worker health endpoints are not part of the HTTP application. Monitor workers through process state, container state, structured logs, and queue metrics.
