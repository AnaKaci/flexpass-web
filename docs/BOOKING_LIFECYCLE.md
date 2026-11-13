# FlexPass booking lifecycle (B2C pilot)

This introduces booking holds, FIFO waitlists and cancellation corrections without changing the personal-credit model. Historical bookings and credit ledger entries are not rewritten.

## Holds and waitlists

Selecting a future session can create a 5-minute temporary hold. Holds reserve capacity but never deduct credits. Confirming a booking consumes the hold and atomically writes one reservation plus the credit debit. The Client can release the hold by closing the modal.

When a session is full, Clients can join a first-in-first-out waitlist. When a place is released, the first eligible waiter gets a 10-minute held offer and an in-app notification. Confirming the offer books and charges the session. Leaving or expiring an offer releases capacity.

IMPORTANT: Expired offers progress on later hold, cancellation, booking and waitlist API interactions. No independent background scheduler or automatic email is configured. A worker is needed for time-accurate promotions in production.

## Pilot cancellation rules (NEW cancellations only)

- 24 hours or more before the start: 100% credit refund.
- 6 to under 24 hours: 50% refund, rounded to whole credits.
- Under 6 hours but before start: 0% refund.
- At or after the start: self-service cancellation not allowed.

Configure the thresholds with FLEXPASS_CANCELLATION_FULL_REFUND_HOURS, FLEXPASS_CANCELLATION_PARTIAL_REFUND_HOURS, FLEXPASS_CANCELLATION_PARTIAL_REFUND_PERCENT and legacy FLEXPASS_CANCELLATION_CUTOFF_HOURS. These are pilot defaults, NOT commercially approved cancellation terms. Review before using customer-paid credits.

The Client receives a cancellation quote and confirms before the server recalculates the refund. Only the actually refunded amount is returned to the credit ledger. Unrefunded credits are NOT automatically partner payouts.

## Admin adjustments

Admin Booking Corrections allows a reasoned booking cancellation or additional refund. The total refund cannot exceed the original debit or be reduced below the amount already returned. Completed visits cannot be corrected by this endpoint. Replaying the same total cannot issue a second refund. Actions are audited.

## Schema and release requirements

Three new additive SQLAlchemy tables: slot_holds, waitlist_entries and booking_cancellations. The MVP uses Base.metadata.create_all to create missing tables, not versioned production migrations. Before processing real payments, review backups, adopt versioned migrations, verify concurrent booking behavior in PostgreSQL and independently test the Render deployment.

GitHub Pages is a read-only preview; booking features require the full-stack application.
