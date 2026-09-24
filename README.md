# MONEYLEAD

Simple U.S. checking. Built for you.

MONEYLEAD is a consumer banking product: checking, payments, cards, identity verification, statements, support, and an operations Control Center. Account numbers, balances, and identity decisions come from the banking partner — they are never invented locally.

## Product

- Customer app: signup, verification, home, payments, cards, activity, profile, support
- Control Center: customers, KYC, accounts, transfers, risk, staff, and configuration
- Auth: email/password plus connected sign-in providers
- Data: Postgres (or local PGLite in development)

## Development

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run build
```

Production banking access is enabled only after the required program, compliance, underwriting, and partner approvals are completed.
