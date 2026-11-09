# FlexPass — Fictional businesses and demo catalog

## What this adds

**Opt-in only**: Set `FLEXPASS_SEED_SHOWCASE_CATALOG=true` on the FlexPass web service and deploy/restart it. The startup seed creates fictional providers, services, available session slots and credit products, preserving existing business and financial records. Re-running does not duplicate these exact demo fixtures. The application continues to use the existing PostgreSQL database.

| Demo business | Area | Demo experiences |
|---|---|---|
| FlexPass Demo Studio [DEMO] | Blloku | Reformer Pilates, Morning Yoga Flow, Stretch & Recover |
| CityMotion Fitness [DEMO] | Komuna e Parisit | Gym Day Pass, Zumba Class |
| BlueWave Sports [DEMO] | Liqeni i Thate | Swimming Session, Tennis Coaching |
| Serenity Wellness [DEMO] | Pazari i Ri | Relaxing Massage, Spa & Sauna |
| Glow Corner [DEMO] | Myslym Shyri | Facial Treatment, Express Beauty Session |

All service titles end with `[DEMO]`, are explicitly fictional, and have descriptive warnings that they are not real offers. Each new service gets five future bookable sessions (eight places per session); existing sessions are never modified.

Three clearly fictional credit products, sold for display/practice only, are added: Starter 10 credits, Everyday 25 credits, Flex 50 credits, with placeholder ALL values. Product records are independent of business services: a Client requests a credit package, completes a separately controlled demo or bank workflow, then spends credits booking fictional business sessions.

### One business activation

- The seed creates an **INVITED** partner account `akaci@ccs.al` for **FlexPass Demo Studio [DEMO]** only if no account with that address already exists. Existing accounts are never overwritten or re-assigned.
- It does **not** assign a known password, send credentials, or activate the account without email ownership verification.
- In the Admin portal → **Business partners**, locate the demo studio and press **Send activation email** after configuring email delivery. The recipient then creates their own password using the one-time activation email.
- After activation, the Business login gives access to exactly that studio's services, sessions and bookings.
- If `akaci@ccs.al` is already present under another partner or role, correct the association through a reviewed admin process. Do not silently overwrite it.

## Verify on Render

1. In Render, check logs for `FLEXPASS_SHOWCASE_SEED` and counts (expected on first deployment: 5 partners, 11 services, 55 slots, 3 credit products, up to 1 invited account).
2. Log in as a Client, go to Explore experiences, view demo businesses, select a future slot. Clients need confirmed credits to complete booking.
3. Sign in as Admin, inspect **Business partners** and **Credit products**. Send activation email only when configured and intended.
4. Activate the Business account and sign in to see its own three services and future reservations. A Client booking appears there; check-in is partner-scoped.
5. Demo bank payment simulation is disabled in Render production mode. Don't treat sample pricing or transactions as real payments.

## Controls

- Production mode does **not** allow simulated bank payments; seeding fictional records does not enable that functionality.
- The seed never changes existing products, slots, credentials, bookings, payments or settlements.
- To stop future seeding, set `FLEXPASS_SEED_SHOWCASE_CATALOG=false`. Existing demo records will remain until explicitly removed.
- **Important**: These fixtures are created on the real Render database when the opt-in is enabled. Do not use this procedure for a customer-facing production launch. Disable or remove fictional catalog items before go-live.
