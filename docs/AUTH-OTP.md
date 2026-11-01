# Email and phone verification (OTP)

Wassl confirms every new self-service account with:

1. **Email** — a six-digit code sent through Brevo.
2. **Phone** — a six-digit code sent by **SMS or WhatsApp**, chosen by the customer.

Both are mandatory only when `PHONE_VERIFICATION_REQUIRED=1`. With the flag off,
signup completes after email verification while the phone channels are prepared.

## Flow when phone verification is enabled

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
      issue a signed phone ticket
      redirect to /verify-phone?email=…&ticket=…
  → /verify-phone
      choose SMS or WhatsApp
      POST /api/auth/verify/phone/send
      POST /api/auth/verify/phone/confirm
      on success: session cookie + redirect
          customer  → /account
          merchant  → /pending
          driver    → /pending
```

Password sign-in follows the same gates. When phone verification is off, email
confirmation and login open a session immediately.

## Channels

| Channel | Provider | Requirements |
| --- | --- | --- |
| SMS | Aion Messaging | Server key, approved sender ID, funded wallet |
| WhatsApp | OpenWA (self-hosted) | Running gateway, API key, linked dedicated session |

A customer can switch channels before confirming. Switching issues a new code
and invalidates the previous one. Codes, limits and the HMAC are shared.

## Security properties

| Property | Implementation |
| --- | --- |
| Code storage | HMAC-SHA256 with `WASSL_SECRET`; plaintext is never stored or logged |
| Comparison | `timingSafeEqual` |
| Lifetime | 10 minutes |
| Attempts | 5 per challenge, then deleted |
| Resend | 60-second cooldown |
| Send volume | 3 codes per account per 10 minutes across both channels |
| Single use | Challenge deleted on success |
| Phone ticket | 15-minute HMAC ticket issued only after email confirmation or a correct password |
| Channel switch | New challenge replaces the old code |
| Enumeration | Unknown/already-verified addresses get generic success from resend |
| Session | Only phone confirmation (or normal login when phone verification is off) creates one |
| Legacy accounts | Missing flags are treated as verified |

All challenges are written inside the serialized `mutate()` transaction.

## Phone formats

`normalizeMoroccanPhone()` accepts `0612345678`, `06 12 34 56 78`,
`+212612345678`, `00212612345678` and `212612345678`, then stores
`+212612345678`. Only Moroccan mobile prefixes `06` and `07` are accepted.

## Feature flags

```text
PHONE_VERIFICATION_REQUIRED=0   # master gate, default off
OTP_SMS_ENABLED=0               # SMS option
OTP_WHATSAPP_ENABLED=0          # WhatsApp option
OTP_DEFAULT_CHANNEL=whatsapp
```

Turn the master flag on only when at least one channel is ready. If the master
flag is on and both channels are off, `/verify-phone` shows a support message and
no code can be requested.

## SMS setup (Aion)

```text
AION_API_KEY=...
AION_SENDER_ID=WASSL
# AION_BASE_URL=https://aionmessaging.com/api/v1
```

Check:

```bash
curl -H "X-API-Key: $AION_API_KEY" \
  https://aionmessaging.com/api/v1/senderids

curl -H "X-API-Key: $AION_API_KEY" \
  https://aionmessaging.com/api/v1/balance
```

The sender must be approved and the wallet funded.

## WhatsApp setup (OpenWA)

OpenWA is unofficial and runs on WhatsApp Web. Use a **dedicated number** and
keep SMS as the fallback.

```text
OPENWA_BASE_URL=http://127.0.0.1:2785/api
OPENWA_API_KEY=...
OPENWA_SESSION_ID=wassl-otp
```

Wassl calls:

- `GET /sessions/{id}/contacts/check/{number}` before sending;
- `POST /sessions/{id}/messages/send-text` with an `Idempotency-Key`.

The gateway stays on loopback. Link the dedicated number from
`https://wassl.shop/admin/whatsapp` while signed in as an admin: the page starts
the session if needed and shows a fresh QR. OTP remains off until
`OTP_WHATSAPP_ENABLED=1` is set. Confirm the session survives a restart.

## Local and e2e

`WASSL_OTP_TEST_MODE=1` skips Brevo, Aion and OpenWA. It returns `devCode` from
the email and phone send endpoints. Playwright enables both channels and picks
WhatsApp by default. Never enable test mode in production.

## Manual fallback

If neither channel is available, an admin can open **Accounts** and use
**Verify mobile** after checking the number with the customer. The action is
audited and clears any outstanding challenge. Use it only as an exception.

## Operational checks

- A 401 from Aion means the key is missing or rotated.
- A 422 mentioning the sender means the Aion sender is not approved.
- A 422 mentioning balance means the wallet needs credit.
- OpenWA 409/connection errors mean the WhatsApp session is not `ready`.
- If WhatsApp reports the number is not registered, the customer should use SMS.
- Support should trigger a resend, never read or ask for a code.
