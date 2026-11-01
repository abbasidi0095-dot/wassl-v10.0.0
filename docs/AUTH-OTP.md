# Email and SMS verification (OTP)

Wassl confirms every new self-service account twice before opening a session:

1. **Email** — a six-digit code sent through Brevo.
2. **Moroccan mobile** — a six-digit code sent by SMS through Aion Messaging.

Both are mandatory for accounts created after this flow shipped. Legacy, seeded
and staff-provisioned accounts without the flags keep their access.

## Flow

```
signup form
  → POST /api/auth/signup
      create account (emailVerified: false, phoneVerified: false)
      issue email code (HMAC stored, 10 min TTL)
      send email through Brevo
      redirect to /verify-email
  → /verify-email
      POST /api/auth/verify/confirm
      on success: no session yet
      issue SMS code + signed phone ticket
      redirect to /verify-phone?email=…&ticket=…
  → /verify-phone
      POST /api/auth/verify/phone/confirm
      on success: session cookie + redirect
          customer  → /account
          merchant  → /pending
          driver    → /pending
```

Password sign-in follows the same gates:

- unverified email → fresh email code, no session;
- verified email but unverified mobile → fresh SMS code, no session;
- both verified → normal session.

## Security properties

| Property | Implementation |
| --- | --- |
| Code storage | HMAC-SHA256 with `WASSL_SECRET`; plaintext is never stored or logged |
| Comparison | `timingSafeEqual` |
| Lifetime | 10 minutes |
| Attempts | 5 per challenge, then deleted |
| Resend | 60-second cooldown |
| Send volume | 3 codes per account per 10 minutes |
| Single use | Challenge deleted on success |
| Phone ticket | 15-minute HMAC ticket issued only after email confirmation or a correct password |
| Enumeration | Unknown/already-verified addresses get generic success from resend |
| Session | Only `/verify/phone/confirm` (or normal login after both checks) creates one |
| Legacy accounts | Missing flags are treated as verified; new accounts are explicitly `false` |

All challenges are written inside the serialized `mutate()` transaction, so
concurrent requests cannot bypass limits.

## Phone formats

`normalizeMoroccanPhone()` accepts `0612345678`, `06 12 34 56 78`,
`+212612345678`, `00212612345678` and `212612345678`, then stores
`+212612345678`. Only Moroccan mobile prefixes `06` and `07` are accepted.

## Requirements

- **Brevo** sender for email.
- **Aion Messaging** API key and an **approved sender ID** for SMS.
- A funded Aion wallet with Morocco SMS credit.
- `WASSL_SECRET` stable across restarts.

Environment:

```text
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=...
BREVO_SENDER_NAME=Wassl

AION_API_KEY=...
AION_SENDER_ID=WASSL
# AION_BASE_URL=https://aionmessaging.com/api/v1
```

Never commit the Aion key. It is stored in `/etc/wassl.env` on the production
host and sent only from the server.

## Checking the Aion account

```bash
curl -H "X-API-Key: $AION_API_KEY" \
  https://aionmessaging.com/api/v1/senderids

curl -H "X-API-Key: $AION_API_KEY" \
  https://aionmessaging.com/api/v1/balance
```

If `sender_ids` is empty, create/approve `WASSL` in the Aion dashboard before
expecting SMS delivery. If the balance is near zero, top up the wallet. The API
returns `Sender ID not found or not approved` or an insufficient-balance error
until both are fixed.

## Local and e2e

`WASSL_OTP_TEST_MODE=1` skips Brevo and Aion. It returns `devCode` for email and
`devPhoneCode` after email confirmation; the Playwright suite uses these. It
must never be enabled on a public deployment.

## Operational checks

- A 401 from Aion means the API key is missing or rotated.
- A 422 mentioning the sender means `AION_SENDER_ID` is not approved.
- A 422 mentioning balance means the Aion wallet needs credit.
- The phone step shows a resend button and a clear warning; the account is not
  given a session until the SMS code is confirmed.
- Support should trigger a resend, never read or ask for a code.
