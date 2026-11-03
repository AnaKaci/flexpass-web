# FlexPass on GitHub Pages (read-only preview)

Public preview URL after a successful Pages deployment: https://anakaci.github.io/flexpass-web/

## Publishing
1. In this GitHub repo, open **Settings → Pages** and choose **GitHub Actions** as the build/deployment source. This one-time setting is necessary if Pages is not already configured.
2. Workflow `.github/workflows/pages.yml` builds `frontend/` with `VITE_GITHUB_PAGES=true` and deploys `frontend/dist` on pushes to `main` that modify frontend files or the workflow. It can also run manually under **Actions**.
3. Watch the workflow status and check the URL above once GitHub reports a successful deployment.

## What works on Pages
- Landing page and navigation
- Browse/search/filter **fictional** sample services from the original local backend seed
- Service details without real schedules or bookings
- Static About, Privacy and Terms pages

## What requires separate hosting
The project uses FastAPI and PostgreSQL for authentication, dashboards, credit ledgers, transactions, availability and bookings. **These do not run on GitHub Pages.** Sign-in and real operations are intentionally disabled in the Pages preview. When a real API is hosted, deploy the full app with Docker/Render or configure a secured separate API origin with CORS, authentication and HTTPS. Never embed credentials or database connections in the browser bundle.

The Pages build is deliberately read-only and contains no real company/employee records.
