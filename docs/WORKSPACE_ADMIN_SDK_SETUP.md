# Google Workspace Admin SDK — service-account setup (BLD-312)

Developer runbook to connect `/admin/workspace` to the Workspace Directory API so
the dashboard can read (Phase A) and later manage (Phase B) users, groups and
aliases. Do this once, the moment `webmaster@kclinics.co.uk` has Cloud **Owner**.

**Prerequisites (already granted by the owner):**
- `webmaster@kclinics.co.uk` is a Workspace **Super Admin**.
- `webmaster@kclinics.co.uk` is **Owner** on the Google Cloud project **KClinics**.

Sign in to both consoles as `webmaster@kclinics.co.uk`.

> **Scope to the project, not the Organisation.** For steps 1–4, click the project
> picker at the top of the Cloud Console and select the **KClinics** project. At the
> Organisation level "Service accounts" is greyed out — *"Not viewable for
> organisations"* — because they're a project-level resource. Owner on the KClinics
> project (already granted) is all you need.

---

## 1. Enable the Admin SDK API
- [console.cloud.google.com](https://console.cloud.google.com) → top project picker → select **KClinics**.
- **APIs & Services → Library** → search **"Admin SDK API"** → **Enable**.

## 2. Create the service account
- **IAM & Admin → Service Accounts → Create service account**.
- Name: `kclinics-workspace`. **Skip** "Grant this service account access to the
  project" — it acts via delegation, not project IAM. **Done**.

## 3. Create a JSON key
- Open the service account → **Keys → Add key → Create new key → JSON → Create**.
- A `.json` file downloads. This is the credential — handle it like a password.

> **If you see "Service account key creation is disabled"**
> (`iam.disableServiceAccountKeyCreation` — Google's secure-by-default org policy),
> an **Organization Policy Administrator** must allow keys, scoped to just this
> project so the rest of the org stays protected:
> 1. Grant **Organization Policy Administrator** (`roles/orgpolicy.policyAdmin`) to
>    `webmaster@kclinics.co.uk`. **Project Owner can do this on the project itself**
>    (IAM & Admin → IAM → Grant access) — no org owner needed. Project Owner does
>    *not* include `orgpolicy.policy.set`, which is why **Manage policy** is greyed
>    and "Set policy" is denied. (An org-level grant by the owner also works; if the
>    project override is itself blocked, the owner sets it at the Organisation scope.)
> 2. On the project, open **"Disable service account key creation"**. The **managed**
>    constraint may already show *Not enforced* while the **legacy**
>    `iam.disableServiceAccountKeyCreation` is the one still active — click
>    **"View legacy constraint"** in the blue banner and override *that*:
>    **Manage policy → Override parent's policy → Enforcement: Off → Set policy**.
> 3. Retry **Keys → Add key → JSON**.
> 4. **Recommended:** set the constraint back to **Inherit parent's policy**
>    afterwards — the one key keeps working, but no further keys can be made.
>
> Prefer no key at all? The keyless alternative is **Workload Identity Federation**
> from Vercel (OIDC → STS → impersonate, signing the delegation JWT via the IAM
> `signJwt` API). More secure, more setup — ask the developer to wire it up.

## 4. Copy the service account's Client ID
- Service account → **Details** → copy the **Unique ID** (a long number). This is
  the OAuth client ID used to authorise delegation in step 5.

## 5. Authorise domain-wide delegation (Workspace Admin)
- [admin.google.com](https://admin.google.com) → **Security → Access and data
  control → API controls → Manage Domain-Wide Delegation → Add new**.
- **Client ID:** the Unique ID from step 4.
- **OAuth scopes (Phase A — read-only)**, comma-separated:
  ```
  https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.group.readonly
  ```
- **Authorise.**
- **Phase B (provisioning — shipped):** to create/suspend users and manage
  aliases & groups from `/admin/workspace`, re-open the same delegation entry and
  add the writable scopes (reads keep working with only the read-only scopes):
  ```
  https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.group,https://www.googleapis.com/auth/admin.directory.user.alias,https://www.googleapis.com/auth/admin.directory.group.member
  ```

## 6. Load the credentials into the app
- In the admin: **Credentials & keys** (`/admin/settings/credentials`), set:
  - `GOOGLE_WORKSPACE_SA_KEY` = the **entire contents** of the JSON key file.
  - `GOOGLE_WORKSPACE_ADMIN_EMAIL` = `webmaster@kclinics.co.uk` (the super-admin to impersonate).
  - `GOOGLE_WORKSPACE_CUSTOMER_ID` = leave blank (uses `my_customer`).
- Values are stored encrypted (`setSecret` → `encryptJson`) — never in env or the repo.

## 7. Verify
- Open `/admin/workspace`. It should list your users, groups and aliases.
- On failure the page prints the exact reason and fix, e.g.:
  - *"domain-wide delegation is not authorised for these scopes"* → recheck step 5.
  - *"Admin SDK API is not enabled"* → step 1.
  - *"invalid_grant"* → `GOOGLE_WORKSPACE_ADMIN_EMAIL` must be a real super-admin.

---

## gcloud alternative (steps 1–4)
```bash
gcloud config set project <PROJECT_ID>        # the KClinics project ID (may differ from the display name)
gcloud services enable admin.googleapis.com
gcloud iam service-accounts create kclinics-workspace --display-name="KClinics Workspace"
SA="kclinics-workspace@<PROJECT_ID>.iam.gserviceaccount.com"
gcloud iam service-accounts keys create kclinics-workspace.json --iam-account="$SA"
gcloud iam service-accounts describe "$SA" --format='value(oauth2ClientId)'   # Client ID for step 5
```

## Security
- The key can administer the directory — store it **only** via the encrypted
  Credentials screen; never commit or email it (one-time link if you must send it).
- **Least privilege:** Phase A uses read-only scopes; add the write scopes only
  when Phase B ships.
- **Revoke:** delete the key (Service account → Keys) and remove the delegation
  entry — the app falls inert automatically.
- Keep the impersonated admin a dedicated super-admin with 2-Step Verification.

## How the app uses it
`lib/google-workspace.ts` signs a short-lived JWT with the key (jose, RS256),
impersonates `GOOGLE_WORKSPACE_ADMIN_EMAIL` (`sub`), exchanges it at
`oauth2.googleapis.com/token`, caches the access token ~1h, and calls the
Directory API. Inert until both the key and admin email are set. UI:
`app/admin/workspace/page.tsx`, backed by the routes under
`app/api/admin/integrations/google-workspace/`. When a directory call fails the
page shows the real reason (e.g. "delegation not authorised for these scopes")
rather than an empty list — see `listWorkspaceUsersResult` / `listGroupsResult`.
Full design and phasing: `docs/GOOGLE_WORKSPACE_MIGRATION.md` §10.
