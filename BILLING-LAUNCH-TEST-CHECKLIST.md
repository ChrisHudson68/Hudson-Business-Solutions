# Billing Launch Test Checklist

Run this checklist before onboarding real customers.

## 1. Trial tenant
- Create a new tenant and confirm the initial billing state is `trialing`.
- Confirm app access is allowed.
- Confirm the tenant sees the billing warning banner when the trial is within 7 days of ending.
- Confirm the Billing page shows the trial end date correctly.

## 2. Paid checkout
- Start billing from the tenant Billing page.
- Complete Stripe Checkout successfully.
- Confirm the workspace becomes `active`.
- Confirm app access remains allowed.
- Confirm the Billing page reflects saved Stripe customer and subscription IDs.

## 3. Billing portal recovery
- Open the Stripe Billing Portal from an active tenant.
- Confirm the portal opens without error.
- Return to the app and confirm the return notice is shown.

## 4. Payment issue flow
- Put a test subscription into a failed / past_due state in Stripe.
- Confirm the workspace shows a warning banner and Billing page callout.
- Confirm app access follows your grace-period policy.
- Confirm the Billing page instructs the user to update payment details.

## 5. Grace expiry
- Move a tenant past the grace window.
- Confirm protected routes redirect to `/billing`.
- Confirm `/billing`, `/support`, `/login`, and `/logout` still work.

## 6. Canceled subscription
- Cancel a subscription in Stripe.
- Confirm the billing state changes appropriately after webhook sync or admin refresh.
- Confirm workspace access matches your cancellation policy.

## 7. Platform-admin recovery
- Open the platform-admin tenant detail page.
- Use **Refresh from Stripe** on:
  - an active paid tenant
  - a tenant with payment issues
  - a tenant with no Stripe IDs
  - an internal / exempt tenant
- Confirm each case returns a friendly status instead of a server error.

## 8. Security spot checks
- Confirm a blocked tenant cannot access:
  - dashboard
  - jobs
  - invoices
  - timesheets
  - reports
  - protected POST actions
- Confirm public estimate-link behavior matches your intended launch policy.

## 9. Final go-live checks
- Confirm live Stripe keys are correct on the server.
- Confirm webhook signing secret is set on the server.
- Confirm backups are current before onboarding the first customer.
- Confirm PM2 restart and smoke test pass on production.
