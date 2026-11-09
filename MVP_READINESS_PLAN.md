# FlexPass revised pilot — personal Clients, Business Partners and Admin

## Requirement change (2026-11-09)

The previous supplied technical document describes employer-funded employees, company plans, and a later B2C rollout. The project owner now clarifies that Client is an **independent customer who purchases FlexPass products**, not an employee assigned an employer plan. This overrides the old *role and sales model* for the current prototype. The existing company-funded tables and historical transactions remain in the database for compatibility; they are no longer promoted in the primary Admin or Client navigation.

### Three role-specific flows

- **Client:** create a personal account, receive an email activation link, sign in, browse credit products and experiences, request a credit package, track the pending order, receive credits after a **verified** payment is manually recorded, and book/cancel experiences against confirmed balance.
- **Business/Partner:** accounts are created only by Admin; the partner uses a one-time email activation link to choose a password; partner can create services and slots, manage bookings/check-ins and review settlements.
- **Admin:** has a separate login and controls partner invitations, credit-product pricing, client/order overview, external payment verification and settlement/audit workflows.

### Simulated bank transfer (demo-only)

- In `FLEXPASS_ENV=development`, `test` or `staging` with `FLEXPASS_DEMO_MODE=true`, the Client order view displays explicitly fictional bank details and enables **Simulate bank payment**. This records `DEMO_PAID`, assigns credits once with ledger source `DEMO_BANK`, and writes an audit entry. No actual funds, banking APIs, or real transfers are involved.
- In `FLEXPASS_ENV=production`, simulated transfers are disabled regardless of `FLEXPASS_DEMO_MODE`. Clients may submit pending orders; Admin verifies real incoming bank payments separately before confirming an order and allocating actual credits.
- For production bank instructions, set `FLEXPASS_BANK_NAME`, `FLEXPASS_BANK_BENEFICIARY`, `FLEXPASS_BANK_IBAN` only when actual approved details exist. Absent them, the UI must say bank information is not configured and warn the user not to send funds.
- Demo tests must run on an **isolated sandbox database**. Never run fictional-credit transactions in the production account database.

### Deliberately not implemented yet

- Live card checkout, payment gateway integrations or webhooks, refunds to payment instruments, automatic payments to partners, fiscal invoice generation, formal credit rollover/expiry.
- Public admin or business self-registration, HR portal, migration of historical employer-funded records, SMS OTP and production-grade self-service password reset.
- Real inventory or physical product shipping; current catalog is experiences/services redeemed with credits. If "products" includes tangible goods, their inventory/tax/shipping models still require separate requirements.

### Existing code in this change

- New `role='client'` account without `company_id`/`plan_id`.
- Email-activated self-registration with existing single-use expiring activation token.
- `credit_products` and `client_orders` tables with price/credit snapshots, a unique request key, and pending/confirmed status.
- `/api/client/products`, `/api/client/orders`, `/api/admin/client-products`, `/api/admin/client-orders`, and an Admin-only confirmation endpoint.
- A pending request **never issues credits**. A single Admin confirmation with a payment reference allocates credits **once** through the ledger. Double confirmation returns a conflict.
- Branded Client storefront, account registration, purchase history, wallet and booking pages; Admin personal Client list, credit products and orders.
- Existing business partner login and Admin-managed partner invitation flow remain.
- Legacy `employee` users continue authenticating through Client UI with the unchanged underlying role, historical company/plan fields and ledger.

## Before merging into main or deploying to real users

1. Review the change request: decide whether sellable products are **credit bundles**, **individual experiences**, **physical products** or a combination. Current branch assumes **credit bundles + experience booking**, because this is closest to the existing booking/ledger API.
2. Review/approve package names, credits, prices, currencies and sales terms; fictional local packages are not offers.
3. Decide whether live bank transfers will be manually reconciled or supported with a banking API. Until then, Admin confirmation must only follow independently verified incoming funds, not an arbitrary reference typed into a prompt.
4. Add rate limits and anti-abuse to public registration, customer email verification, notification monitoring, expired-link resend/recovery and CSRF review.
5. Add Alembic migrations and staging PostgreSQL test database; `create_all` is not a substitute for versioned migrations.
6. Run concurrency and idempotency tests under PostgreSQL, role/tenant authorization and end-to-end booking/settlement tests; test new users cannot reserve until funds are confirmed.
7. Review legal/commercial requirements, consumer privacy, invoices, order cancellation/refunds and partner payouts.
8. Verify deployment environment variables and backups, test in staging with fictional clients and businesses.

**Deployment status:** This branch is for review. Do not treat it as a verified production checkout. Do not auto-deploy by merging until integration/security tests are complete.
