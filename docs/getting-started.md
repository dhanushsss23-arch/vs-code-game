# EDUVERSE local setup

## Requirements

- Node.js 20.9 or later
- PostgreSQL 15 or later

## Configure and run

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to a local PostgreSQL database. Generate two independent
   secrets of at least 32 characters and set `SESSION_SECRET` and
   `AUTH_RATE_LIMIT_SECRET`. Do not use the example placeholder values.
3. Install dependencies with `npm install`.
4. Create and apply the initial migration with `npm run db:migrate:dev`.
   Review and keep the generated migration in source control.
5. Generate the Prisma client with `npm run db:generate` if the migrate command
   did not generate it.
6. Run `npm run dev`, then visit `http://localhost:3000`.

The registration endpoint creates a student, profile, and zero-balance wallet
in a single PostgreSQL transaction. Login sessions are opaque random tokens;
only keyed hashes are stored in the database. Session cookies are HTTP-only,
SameSite Lax, and Secure in production. Passwords are hashed with Argon2id.
Authentication routes require a same-origin `Origin` header and use database
rate-limit buckets scoped by normalized email and client address.

The `x-real-ip` and `x-forwarded-for` headers must be set or sanitized by the
trusted reverse proxy in production. Do not expose the app directly behind an
untrusted proxy configuration. Expired session and rate-limit bucket cleanup,
email verification, account recovery, and production deployment policy are
follow-up work; registration is currently active immediately.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm run db:validate`
- `npm run build`

Database-backed auth tests and an end-to-end browser test should be added and
run after the initial migration is generated and dependencies are available.
Do not treat an un-migrated database or demo user as a successful setup.
