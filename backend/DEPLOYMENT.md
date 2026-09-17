# RentSafe Backend — Production Deployment Guide

This guide details the requirements, configuration, and verification steps necessary to deploy the RentSafe Next.js 16 backend into staging or production environments.

---

## 1. Prerequisites
- **Node.js**: `v20.x` or higher (verified on `v24.19.0`)
- **Package Manager**: `npm` (v10.x+)
- **Database**: PostgreSQL 15+ instance (Supabase PostgreSQL pooler + direct connection)
- **Supabase Project**: Active project with Supabase Auth enabled

---

## 2. Environment Variables Configuration

Configure the following environment variables in your deployment environment (e.g. host environment variables, container secrets, or production `.env`):

### Database Configuration (Server-Only)
- `DATABASE_URL`: Transaction pooler connection string (port 6543) with `?pgbouncer=true`. Used by the Next.js runtime.
- `DIRECT_URL`: Direct PostgreSQL connection string (port 5432). Used by Prisma CLI for applying migrations.

### Supabase Authentication
- `NEXT_PUBLIC_SUPABASE_URL`: Public HTTPS URL of your Supabase project (e.g., `https://[PROJECT-REF].supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public client anon key for browser session exchange and JWT validation.
- `SUPABASE_SERVICE_ROLE_KEY` *(Optional, Server-Only)*: Admin key for administrative auth operations. Never expose to client!

### Production Security & CORS
- `ALLOWED_ORIGIN`: Comma-separated list of permitted frontend origins (e.g., `https://rentsafe.vercel.app,http://localhost:3000`). Used by CORS preflight and restricted header validation.
- `NODE_ENV`: Set to `production`.

> [!CAUTION]
> Never commit `.env` files with actual secrets to Git. Maintain variables in your production deployment platform's secret manager.

---

## 3. Production Deployment Lifecycle

Run the following commands in the `backend/` directory in sequence:

```bash
# 1. Install exact dependencies
npm ci

# 2. Generate Prisma Client
npx prisma generate

# 3. Apply committed database migrations
npx prisma migrate deploy

# 4. Build Next.js application
npm run build

# 5. Start production server
npm start
```

---

## 4. Health Check & Monitoring
- **Endpoint**: `GET /api/health`
- **Authentication**: Public (no credentials required)
- **Payload**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "database": "connected",
      "timestamp": "2026-09-17T13:51:16.000Z",
      "uptimeSeconds": 120
    }
  }
  ```
- **Use Cases**: Load balancer liveness probe, container health check, uptime monitors.

---

## 5. Security & Rate Limiting Architecture

### Security Headers
Configured natively in `next.config.ts` and enforced via `src/middleware.ts`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `poweredByHeader: false` (removes `X-Powered-By: Next.js`)

### Rate Limiting Scope
- **Current Mechanism**: In-memory sliding window cache located in `backend/lib/security/rate-limit.ts`.
- **Thresholds**:
  - `AUTH` (`/api/auth/signin`, `/api/auth/signup`): 10 req/min
  - `PAYMENT` (`/api/bookings/*/payment`): 10 req/min
  - `WRITE` (all mutation methods): 40 req/min
  - `READ` (all query methods): 120 req/min
- **Production Architecture Note**: The in-memory limiter is designed for single-instance, serverless edge, and local/evaluation deployments. If horizontally scaling across multiple container instances (e.g. Kubernetes, AWS ECS cluster), an external distributed key-value store such as Redis or Upstash should be integrated.

---

## 6. Frontend Integration Contract

For teammate's frontend configuration:
- **Base API URL**: Set your frontend API client base to the deployed backend URL (e.g. `https://api.rentsafe.example.com`).
- **Endpoint Prefix**: All endpoints reside under `/api/` (e.g. `/api/properties`, `/api/bookings`).
- **CORS Credentials**: Frontend fetch/axios requests must include credentials (`credentials: 'include'`) to pass session cookies across origins.
- **Allowed Origin**: The deployed frontend domain must match one of the entries in `ALLOWED_ORIGIN`.

---

## 7. Post-Deployment Smoke Test

Immediately following production startup, run these non-destructive smoke checks:
1. `GET /api/health` &rarr; Expect `200 OK` with `status: "ok"` and `database: "connected"`.
2. `GET /api/properties` &rarr; Expect `200 OK` returning property listings array.
3. `GET /api/amenities` &rarr; Expect `200 OK` returning amenity catalog.
4. `GET /api/auth/me` without cookies &rarr; Expect `401 UNAUTHORIZED`.

---

## 8. Rollback Procedure
If a critical production fault occurs after deployment:
1. Re-deploy the previous known stable production build/container image.
2. If database migrations were applied, inspect migration history via `npx prisma migrate status`.
3. Do not run `prisma migrate reset` on production databases.
