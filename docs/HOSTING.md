# Hosting — OCI VPS

Wassl is self-hosted on Oracle Cloud Infrastructure. The Fly deployment is
retired.

## Live

- App: <https://wassl.shop>
- Instance: `instance-20261024-2302` · region `eu-paris-1`
- Public IP: `141.145.192.23` · private IP `10.0.0.125`
- TLS: Let's Encrypt via Caddy, HTTP-01/ALPN on the direct hostname
  (`wassl.shop`). Ports `80` and `443` are open in the VCN
  default security list; no NSG is attached to the VNIC.

## Layout

| Path | Purpose |
| --- | --- |
| `/opt/wassl` | Git checkout and production build |
| `/var/lib/wassl` | Persistent JSON database (`db.json`) |
| `/etc/wassl.env` | Runtime environment, root-owned `600` |
| `/etc/caddy/Caddyfile` | TLS + reverse proxy to `127.0.0.1:3000` |
| `/etc/systemd/system/wassl.service` | Next.js server |
| `/etc/systemd/system/caddy.service` | Public HTTPS entry |

The app binds **`127.0.0.1:3000` only**. Port `3000` is not exposed in
firewalld or the OCI security list.

## Services

```bash
sudo systemctl status wassl caddy
sudo journalctl -u wassl -f
sudo journalctl -u caddy -f
```

Both services are enabled at boot.

## Deploy a new release

```bash
cd /opt/wassl
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
sudo systemctl restart wassl
```

Caddy does not need restarting for application deploys. Reload it only when the
Caddyfile changes:

```bash
sudo systemctl reload caddy
```

## Environment

`/etc/wassl.env` holds:

```text
WASSL_DATA_DIR=/var/lib/wassl
WASSL_SECRET=...
NEXT_PUBLIC_SITE_URL=https://wassl.shop
HOSTNAME=127.0.0.1
PORT=3000
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=...
BREVO_SENDER_NAME=Wassl
```

`WASSL_OTP_TEST_MODE` must stay unset in production.

## Firewall

- OCI VCN default security list: TCP `22`, `80`, `443` from `0.0.0.0/0`.
- Host firewalld: `ssh`, `http`, `https`.
- No NSG on the VNIC.

## Data

The JSON store is `/var/lib/wassl/db.json`. Back it up with:

```bash
sudo install -d -m 700 /var/backups/wassl
sudo tar -czf "/var/backups/wassl/wassl-$(date +%F-%H%M).tgz" -C /var/lib wassl
```

## DNS and TLS

Namecheap BasicDNS holds:

```text
A      @     141.145.192.23
CNAME  www   wassl.shop
```

The URL Redirect record for `@` must stay deleted; Caddy handles the
`www` → apex redirect. Caddy obtains and renews the Let's Encrypt certificate
for both names through HTTP-01/ALPN on ports `80`/`443`.

## Email sender

Brevo authenticates `wassl.shop` with DKIM, a Brevo TXT verification code and
DMARC. The active sender is `noreply@wassl.shop`; `BREVO_SENDER_EMAIL` is set to
it in `/etc/wassl.env`. The old Gmail sender remains on the Brevo account as a
fallback but is not used by the app.

## Cloudflare tunnel

The temporary `*.trycloudflare.com` tunnel used during the migration has been
disabled. `wassl-tunnel.service` remains on disk for emergency access only:

```bash
sudo systemctl start wassl-tunnel
sudo journalctl -u wassl-tunnel -n 30
```

Its hostname changes on every restart; do not use it as the public URL.
