# Clinical-data encryption — key rotation runbook

Sensitive data (health assessments, clinical notes, OAuth tokens) is encrypted
with **AES-256-GCM** using a **versioned keyring** (`lib/crypto.ts`). Each blob is
tagged with the id of the key that wrote it (`keyId.iv.tag.ct`). The **active**
key encrypts new data; **any** key in the ring can decrypt old data — so adding a
new key never makes existing data unreadable.

## Environment
- `HEALTH_ENCRYPTION_KEY` — active AES key (32 bytes, hex or base64).
- `HEALTH_ENCRYPTION_KEYS_OLD` — comma-separated retired keys, kept for decryption + re-encryption.
- `HEALTH_HMAC_KEY` / `HEALTH_HMAC_KEYS_OLD` — same idea for the integrity HMAC (defaults to the AES ring if unset).

## If a key is suspected compromised — rotate (no downtime, no data loss)
1. Generate a new key: `openssl rand -hex 32`.
2. In Vercel: move the **current** `HEALTH_ENCRYPTION_KEY` value into `HEALTH_ENCRYPTION_KEYS_OLD` (comma-append if others exist), then set `HEALTH_ENCRYPTION_KEY` to the **new** value. Redeploy.
   - New data is now encrypted with the new key immediately. Old data still decrypts via the retired key in the ring.
3. The **daily cron** automatically re-encrypts old records onto the new key in batches (idempotent; it never deletes keys). Watch progress on **Admin → Integrations → "Clinical data encryption"**.
4. When it shows **0 remaining**, remove the old value from `HEALTH_ENCRYPTION_KEYS_OLD` and redeploy. The compromised key is now fully out of use.

To re-encrypt without a rotation in progress, set `HEALTH_KEY_REENCRYPT=true` temporarily.

## Compromise vs loss
- **Compromise** → rotate (above). Also review DB credentials, since a leaked key only matters with DB access.
- **Loss** → there is no recovery. **Back up the keys** outside Vercel (secrets vault / offline). Env vars are configuration, not a backup.

## Don'ts
- Don't change `HEALTH_ENCRYPTION_KEY` without putting the old value in `HEALTH_ENCRYPTION_KEYS_OLD` first.
- Don't remove a retired key until the status page reads 0 remaining.

## Future
The keyring is the stepping stone to a managed **KMS** (AWS/GCP) with envelope
encryption and automatic rotation, where the master key never leaves the HSM.
