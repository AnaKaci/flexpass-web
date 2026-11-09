# FlexPass — MVP hardening and controlled-pilot plan

Source of requirements: `FlexPass_Pergjigje_Teknike_dhe_MVP(1).docx` (supplied privately for review) and `FlexPass_Brand_Guide(1).pdf`. These source files are not committed to the repository.

## Delivery rules

- **Exactly three roles:** Employee (Client), Partner (Business), Admin. No HR portal.
- **No public application data:** the home page offers entry to Client and Business sign-ins only; admin sign-in is at `/admin/login` and not advertised publicly.
- **Authority remains on the server:** React route guards improve UX, but FastAPI must enforce role and tenant authorization for every protected endpoint.
- **No unsanctioned payments or B2C:** credit top-ups, public registration, automated bank payouts, and card processing stay disabled for the MVP.
- **Brand fidelity:** Deep Teal #10565C, Warm Ivory #F5EFE4, Burgundy #AA1350, Soft Blush #F3DEDF, Mist Blue #C9DDE2; Bodoni Moda headings, Cormorant Garamond accents, Inter copy.
- **Two isolated deployments:** staging/demo with fictional data and production with independent credentials, database and migrations.

## Already in the codebase (verify end to end on Render)

| Domain | Existing functionality | Acceptance check |
|---|---|---|
| Workspaces | Admin, Employee, Partner dashboards | Roles cannot navigate into each other's workspace |
| Catalog | Categories, filters, subcategories, zones, credits and sessions | Only authenticated members access catalog data |
| Wallet | Ledger and employee credit history | Debits/refunds match bookings |
| Bookings | Capacity, credit validation, cancellation/refund and idempotency key | Last seat and double-click tests |
| Partner | Partner-scoped bookings, check-in, service/slot entry | Partner cannot see another partner's reservations |
| Finance | Invoice and settlement records, manual status changes, CSV payout export | Period totals equal confirmed visits and frozen payout amounts |
| UI | Brandbook design and role-specific gateway | Mobile, keyboard and desktop QA |

## P0 — Complete before inviting any real pilot users

1. **Account invitation and activation** — Admin CSV import with validation/deduplication, email invite or approved external Auth provider, expiring activation link, verified company and plan assignment, resending/revocation; no shared demo passwords. Acceptance: uninvited users cannot activate or acquire company credits, and only Admin can assign plans.
2. **Tenant and permission isolation** — Test all employee/company and partner boundaries against direct API requests, URLs and manipulated IDs. Admin access must be audited; use HTTPS and rate limits on authentication.
3. **Database and deployment reliability** — Alembic migrations, secrets management, separate staging/prod PostgreSQL, backup/restore exercise, health and error logs, no auto-seeded fictional data in production.
4. **Financial rules approval** — Confirm plan credits and prices, monthly funding trigger, expiry/rollover, cancellation/no-show windows, payout amounts, settlement disputes, currencies and fiscal workflows; reject launches until business policy is settled.
5. **Invoice reconciliation and partner invoice submission** — Securely upload or reference invoices, access-controlled download, file size/type limits, malware scanning, settlement dispute workflow, and audit entries.
6. **End-to-end tests** — Run integration suite against PostgreSQL, including concurrent last-seat booking, repeated cancel/refund, repeated check-in, historical payout snapshots, and manual invoice status transitions.

## P1 — Before broader rollout

- Effective-dated membership and plan changes; employee suspension/exit with retained accounting history.
- Partner service approval and versioned credit/payout prices rather than unrestricted live publication.
- Partner daily/weekly reservations filters, optional CSV exports with a date range.
- Admin correction approvals for sensitive financial actions and complete append-only audit records.
- Accessibility, responsive QA, empty states, input validation, privacy/terms review and retention policies.
- Monitoring, structured logs and privacy-safe support diagnostics.

## Later (not this MVP)

Public B2C signup, card purchases/top-ups, automated bank payouts, QR check-in, mobile apps, payroll integrations, and advanced personalization.

## Immediate rollout sequence

1. Review and merge the feature branch after its CI is green; do not deploy to live without checking current Render branch/auto-deploy settings.
2. Deploy to staging Render with isolated PostgreSQL and fictional accounts; verify `/api/health`, `/admin/login`, `/login/client`, `/login/business` and the three dashboards.
3. Verify anonymous `GET /api/catalog` is rejected and wrong-portal credentials cannot log in.
4. Perform a complete employee booking → credit debit → partner check-in → settlement report walkthrough, including cancellation.
5. Resolve P0 items before treating the application as ready for a real operational pilot.

**Status:** The branded gateway, route guards, role-scoped authentication and private catalog are implemented in the feature branch. This does not mean invitation onboarding, full production security, or real-pilot financial policies have been implemented. GitHub Pages remains an unauthenticated static visual entry preview; use the Render full-stack deployment for functional login.
