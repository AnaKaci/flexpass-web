# FlexPass — browser-based web application (MVP)

**React 18 + TypeScript + Vite**, with a **FastAPI + SQLAlchemy** API. The web interface and API can be served together from **one HTTPS origin** using the supplied Dockerfile. It is a browser application, not a native Windows/macOS/mobile application.

This is an **MVP/pilot codebase**, not a finished commercial service. The frontend supports three roles (Client, Partner and Admin), and the API includes reservations, a credit ledger, personal purchase requests and financial tracking logic. It **does not** include online card payment processing, automated payment verification, complete financial compliance, production database migrations, or an independent security/privacy review. Do not store real employee/customer financial or personal information in it before those tasks are completed.

## Live application

**[Open FlexPass](https://flexpass-web.onrender.com/)**

The main application is hosted on Render.

## Functional scope — revised personal Client model

| Role | Features |
|---|---|
| Client | Self-registration with email activation, personal credit packages, purchase requests, wallet, reservations, cancellations and purchase history |
| Partner (Business) | Admin invitation/activation, manage services/slots, review reservations, confirm attendance and review settlements |
| Admin | Register partner businesses, configure credit products, view personal clients and orders, manually confirm externally verified payment, settlement/audit |

**Credit purchase limitations:** This MVP does **not** charge cards, collect funds, or confirm payment automatically. Selecting a package creates a `PENDING` order and **does not issue credits**. Only an authorized Admin can confirm a payment reference after verifying an external payment, which creates one ledger allocation and marks the order `CONFIRMED`. Do not mark test orders paid on live financial records. Product prices shown in local fictional demo data are illustrative.

The previous employer-funded Employee model remains in the database for compatibility with existing records and transactions. New customer accounts have `role='client'`, without company or employer plan associations. Legacy records render in the new Client interface but retain their historical ledger/company references. Public B2C registration differs from the earlier supplied corporate-benefits MVP requirements and is implemented here on the user's explicit revised instructions.

**Email delivery:** Production registration requires `FLEXPASS_APP_URL`, `FLEXPASS_RESEND_API_KEY`, and `FLEXPASS_EMAIL_FROM` configured on Render with a verified sender. Account activation uses one-time expiring links. The hosted GitHub Pages frontend is informational only; working registration requires the full-stack Render deployment.

## Local development

Requires Python 3.10+, Node.js 20+ and npm with access to its package registry. From the root directory:

Terminal 1:

```bash
python -m pip install -r backend/requirements.txt
python run.py
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The frontend proxies `/api` to the backend. Backend API docs: **http://127.0.0.1:8000/docs**.

### Local fictional accounts

| Role | Email | Password |
|---|---|---|
| Employee | employee@flexpass.demo | Demo123! |
| Partner | partner@flexpass.demo | Demo123! |
| Admin | admin@flexpass.demo | Demo123! |

These fixed credentials are enabled in *development demo mode only* by default, and **must never be exposed in a public hosting configuration**. Set `FLEXPASS_ENV=production` when hosting. In production the application defaults to `FLEXPASS_DEMO_MODE=false` and does **not** seed the known demonstration credentials.

## Deploy as a web application

- `Dockerfile`: builds Vite frontend and serves it from FastAPI alongside `/api`.
- `render.yaml`: Render Blueprint defining a web service plus PostgreSQL database. Uses an auto-generated signing key; asks for administrator credentials during provisioning. **Review Render's current pricing before creating resources.**
- `DEPLOYMENT.md`: GitHub and Render deployment walkthrough.
- `.github/workflows/ci.yml`: runs Python tests and TypeScript build on every push and pull request.

Hosted production requires `FLEXPASS_ENV=production`, `FLEXPASS_SECRET` (32+ random characters), `DATABASE_URL` (prefer PostgreSQL), `FLEXPASS_ADMIN_EMAIL`, and `FLEXPASS_ADMIN_PASSWORD` (12+ characters). These are private environment values, **not source-controlled variables**. On first initialization only an administrator is created. The commercial plans, partners, invitation activation and credential setup must be implemented/approved before onboarding real users.

A separate **hosted demo** can be enabled with `FLEXPASS_DEMO_MODE=true`, but requires three strong *distinct* passwords in `FLEXPASS_DEMO_ADMIN_PASSWORD`, `FLEXPASS_DEMO_PARTNER_PASSWORD`, and `FLEXPASS_DEMO_EMPLOYEE_PASSWORD`. The hosted UI never displays these passwords. Use fictional data only.

## Tests

```bash
python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
python -m pytest -q tests
cd frontend
npm install
npm run typecheck
npm run build
```

Checked in the delivery environment: **5 backend tests passed**, a production-mode API smoke test passed, and all seven TypeScript source files parsed/transpiled without syntax diagnostics. **The npm registry was unreachable (`EAI_AGAIN`), so dependency-based frontend type-check, Vite build, Docker build, visual browser tests and hosted deployment have not been verified.** GitHub Actions will rerun the frontend checks after the code is uploaded.

## MVP limitations

The feature scope and acceptance criteria are derived from the supplied FlexPass MVP document. Important unfinished functions include email invitations, CSV import, partner user provisioning, package effective dates, approved cancellation policy, wallet expiry/rollover, audit coverage, concurrency verification on production PostgreSQL, partner invoice file uploads, production database migrations, bank-payment verification, privacy controls and independent security review.

The specification document is excluded from Git by `.gitignore` because it is marked confidential. It is not necessary for the app to run.
