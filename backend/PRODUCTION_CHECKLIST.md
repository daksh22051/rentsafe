# RentSafe Backend — Production Readiness Checklist

This checklist tracks the verification status for deploying the RentSafe backend into production.

---

### Environment & Secret Management
- [x] Environment variables validated via centralized schema (`lib/env.ts`)
- [x] `NEXT_PUBLIC_SUPABASE_URL` configured
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured
- [x] `DATABASE_URL` pooler connection configured
- [x] `DIRECT_URL` migration connection configured
- [x] `ALLOWED_ORIGIN` configured with restricted domain support
- [x] Production `NODE_ENV="production"` configured
- [x] No secrets committed to source control or repository history

---

### Database & Migrations
- [x] Prisma schema passes validation (`npx prisma validate`)
- [x] Prisma migration status verified up-to-date (`npx prisma migrate status`)
- [x] Prisma client generated successfully (`npx prisma generate`)
- [x] Zero destructive database operations (no resets or drop commands)

---

### Build & Code Quality
- [x] TypeScript compilation passes with 0 errors (`npx tsc --noEmit`)
- [x] ESLint passes with 0 errors and 0 warnings (`npm run lint`)
- [x] Next.js production build succeeds (`npm run build`, 29/29 routes compiled)
- [x] Debug logging disabled in production error handlers

---

### Runtime, Health & Monitoring
- [x] Health check endpoint operational (`GET /api/health` returns HTTP 200 with database status)
- [x] Request ID correlation header (`X-Request-Id`) attached to all responses
- [x] Error responses sanitized (zero leakage of stack traces, connection strings, or SQL)

---

### API Security & Access Controls
- [x] Production security headers active (`nosniff`, `DENY`, `HSTS`, `Permissions-Policy`)
- [x] `X-Powered-By` header disabled in Next.js config
- [x] CORS preflight (`OPTIONS`) handling operational with restricted credentials
- [x] Centralized rate limiting active (`AUTH`, `PAYMENT`, `WRITE`, `READ` thresholds)
- [x] Rate limiting limitation understood (in-memory; Redis required for multi-instance clusters)
- [x] Protected endpoints reject unauthenticated requests with HTTP 401
- [x] Role-based access control verified (Student, Owner, Admin role separation)
- [x] IDOR protection verified across all private entities

---

### Deployment & Frontend Coordination
- [x] Automated QA test suite passing 100% (`npx tsx tests/run-all-tests.ts`, 65/65 checks)
- [ ] Post-deployment live smoke test completed on cloud host
- [ ] Frontend base URL pointed to deployed backend domain
- [ ] Production payment gateway credentials configured (deferred to future payment integration step)
