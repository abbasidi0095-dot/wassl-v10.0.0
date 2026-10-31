# Email verification (OTP)

Wassl confirms every new self-service email address with a six-digit one-time
code before it opens a session. Transactional delivery uses **Brevo**.

## Flow

```
signup form
  → POST /api/auth/signup
      create account (emailVerified: false)
      issue code (HMAC stored, 10 min TTL)
      send email through Brevo
      returns needsVerification + /verify-email?email=…
  → /verify-email
      six single-digit inputs, paste, auto-submit
      POST /api/auth/verify/confirm
      on success: session cookie + redirect
          customer  → /account
          merchant  → /pending
          driver    → /pending
```

Password sign-in for an unverified account follows the same path: the password
is checked first, then a fresh code is sent and no session is created until the
code is confirmed. Verified accounts sign in as before.

## Security properties

| Property | Implementation |
| --- | --- |
| Code storage | HMAC-SHA256 of `email + code` with `WASSL_SECRET`; plaintext never stored or logged |
| Comparison | `timingSafeEqual` |
| Lifetime | 10 minutes (`OTP_TTL_MS`) |
| Attempts | 5 per challenge, then the challenge is deleted |
| Resend | 60-second cooldown |
| Send volume | 3 codes per address per 10 minutes |
| Single use | Challenge deleted on success |
| Enumeration | `/api/auth/verify/send` returns the same generic success for unknown and already-verified addresses |
| Session | Only issued by `/api/auth/verify/confirm` (or a normal login after verification) |
| Legacy accounts | `emailVerified === undefined` is treated as verified; only new accounts are `false` |

All challenge writes go through the serialized `mutate()` transaction, so two
concurrent requests cannot bypass the cooldown or issue two codes.

## Requirements

- A Brevo account with a verified sender.
- Fly secrets:
  - `BREVO_API_KEY`
  - `BREVO_SENDER_EMAIL`
  - `BREVO_SENDER_NAME` (optional, defaults to `Wassl`)
  - `BREVO_REPLY_TO` (optional)
- `WASSL_SECRET` must be set and stable. Changing it invalidates outstanding
  codes (users simply request a new one).

Set them without committing:

```bash
flyctl secrets set BREVO_API_KEY=… BREVO_SENDER_EMAIL=… BREVO_SENDER_NAME=Wassl
```

## Local and e2e

`WASSL_OTP_TEST_MODE=1` skips the Brevo call and includes `devCode` in the
signup/send/login JSON. It must **never** be set on a public deployment. The
Playwright suite enables it in `playwright.config.ts` and reads the code from the
signup response.

## Deliverability

The current sender is a verified Gmail address on the Brevo account. That works
for the pilot but Gmail's DMARC policy limits brand control and can affect
placement. Before launch, verify `wassl.ma` in Brevo, publish SPF/DKIM/DMARC and
switch `BREVO_SENDER_EMAIL` to `no-reply@wassl.ma`.

## Operational checks

- Brevo dashboard → Transactional → Logs: search `wassl-transactional`.
- A 401 from Brevo means the API key was rotated or revoked.
- A 400 “sender not valid” means `BREVO_SENDER_EMAIL` is not verified.
- If `BREVO_API_KEY` is missing, signup still creates the account but the verify
  screen shows the resend warning; fixing the secret and resending recovers it.
- Codes are not recoverable from the database by design. Support should trigger
  a resend, never read a code.
