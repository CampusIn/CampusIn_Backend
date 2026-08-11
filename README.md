# CAMPUS OUT

Campus Out is a backend platform for campus food ordering and marketplace operations.

## What I Have Built So Far

- User authentication with email OTP verification, JWT sessions, profile management, password reset, and Google login.
- Role-based flows for `user`, `vendor`, `admin`, and `delivery_partner`.
- Vendor restaurant management with create, update, open/close status, and ownership controls.
- Menu management with image uploads, item availability updates, soft delete, and menu suggestions.
- User cart flow with quantity updates, single-restaurant cart handling, and total recalculation.
- Food order flow with order creation, history, cancellation, vendor-side order management, and status tracking.
- Review system for restaurants with create, update, delete, and rating updates.
- Vendor dashboard features including overview stats, revenue insights, order breakdowns, stock updates, low-stock tracking, bulk menu upload, and invoice generation.
- Admin dashboard tools for user/vendor visibility, restaurant moderation, blocking, suspension, settings, and full order oversight.
- Delivery partner workflow for profile creation, assigned order handling, pickup, and delivery updates.
- Marketplace module with categories, products, cart, order placement, cancellation, and delivery tracking.
- Homepage CMS support for banners and announcements.
- Coupons, platform settings, cached services, Redis integration, email queue workers, and Bull Board queue monitoring.

## Stack

- Node.js
- Express
- MongoDB
- Mongoose
- Redis
- BullMQ
- Cloudinary
- Nodemailer

## Redis Deployment (Self-Hosted Docker)

The backend now uses a self-hosted Redis instance running in Docker instead of Upstash.

- Redis image: `redis:7-alpine`
- Persistence: AOF enabled (`appendonly yes`) + named volume `redis-data`
- Security: Redis requires `REDIS_PASSWORD`
- Network: backend and redis communicate on a private Docker network (`backend_private`)
- Redis port exposure: Redis is **not** published to host (`6379` is not exposed)

### Architecture

`backend container` -> `redis:6379` (private Docker network) -> `redis-data` volume

MongoDB remains the primary persistent application database, and this setup expects MongoDB Atlas via `MONGO_URI`.

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

Required Redis vars:

- `REDIS_HOST` (use `redis` in Docker)
- `REDIS_PORT` (default `6379`)
- `REDIS_PASSWORD` (strong secret)

Required database var:

- `MONGO_URI` (MongoDB Atlas connection string)

Notes:

- Never commit `.env` to version control.

## Local Run (Docker)

1. Copy env file:

```bash
cp .env.example .env
```

Set `MONGO_URI` in `.env` to your MongoDB Atlas URI before startup.

2. Start services:

```bash
docker compose up -d --build
```

To scale printing upload workers (example: 3 replicas):

```bash
docker compose up -d --scale worker-upload=3
```

3. Check container health:

```bash
docker compose ps
```

4. Tail backend logs:

```bash
docker compose logs -f backend
```

Tail worker logs:

```bash
docker compose logs -f worker-upload
docker compose logs -f worker-email
docker compose logs -f worker-maintenance
```

5. Stop services:

```bash
docker compose down
```

## Redis Operations

Inspect Redis inside container:

```bash
docker compose exec redis redis-cli -a "$REDIS_PASSWORD"
```

Quick connectivity check:

```bash
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping
```

Restart Redis:

```bash
docker compose restart redis
```

## Backup and Restore (AOF)

Redis data persists in the named volume `redis-data`.

Find the actual Docker volume name:

```bash
docker volume ls
```

Create backup from host:

```bash
docker run --rm -v <redis_volume_name>:/data -v "$PWD":/backup alpine tar czf /backup/redis-data-backup.tgz -C /data .
```

Restore backup (service stopped):

```bash
docker compose stop redis
docker run --rm -v <redis_volume_name>:/data -v "$PWD":/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/redis-data-backup.tgz -C /data"
docker compose start redis
```

## Production Security Notes

- Do not expose Redis to the public internet.
- Do not add `6379:6379` in production compose.
- Keep `REDIS_PASSWORD` strong and secret.
- Use VM firewall rules to restrict public access to backend/API ports only.
