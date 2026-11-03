# FlexPass MVP backlog (proposed GitHub Issues)

This list describes **remaining work**; it is not a claim that the features already exist. The priorities follow the six-page FlexPass MVP scope. Review business policies with FlexPass before implementing.

## P0 — Required for a safe hosted pilot

- [ ] Complete frontend dependency build, Vite production build and end-to-end browser smoke tests.
- [ ] Implement real invitation lifecycle (issued, activation, expired, revoked), user password reset and role-scoped account provisioning (do not accept claimed organization IDs from the browser).
- [ ] Create partner onboarding and service approval workflow, and company-admin plan setup with business-approved prices/credits.
- [ ] Add database migrations, PostgreSQL integration tests, transactional booking/reversal stress tests and database backup/restore verification.
- [ ] Introduce authentication hardening, login rate limits, session invalidation and independent security/privacy review.
- [ ] Define cancellation cutoffs, plan effective dates, credit rollover/expiry and ledger correction policy before live use.

## P1 — MVP completion

- [ ] CSV import for employee lists, duplicate avoidance and employee suspension/termination workflow.
- [ ] Partner invoice upload, financial reconciliation disputes, payment proof and audit fields for manual bank transfers.
- [ ] Confirmed booking list check-in with complete audit metadata and optional QR only after server-side validation.
- [ ] Role/organization data isolation tests and aggregated HR reporting rules.
- [ ] Publish genuine privacy and terms notices and perform accessibility/mobile testing.

## P2 — After MVP

- [ ] Optional QR experience, mobile app, public B2C onboarding, payment gateway and individual top-ups.
- [ ] Automated partner payouts and payroll integration.

## Suggested GitHub workflow

Open one issue per task, label with `P0`, `P1` or `P2`, and use a pull request to link implementation to issue. The GitHub Actions workflow in this repository checks backend tests and frontend typecheck/build whenever code is pushed or a PR is opened. Deployment still needs its own staging validation.
