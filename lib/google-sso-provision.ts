import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import type { GoogleIdentity } from '@/lib/google-sso';

// Resolve a verified Google identity to a staff account — the "merge vs
// provision" decision behind Google SSO.
//
// Matching order:
//   1. by the stable Google account id (returning, already-linked user);
//   2. by login email (the seamless case: their existing account — Hostinger-era
//      or otherwise — is keyed by this exact address, so they just sign in);
//   3. by an owner-set alternate Google email (for the rare case where someone's
//      Workspace email differs from their existing login email).
//
// A genuinely new email provisions a DISABLED account that an owner must approve
// (role + activate) before it can do anything — so opening sign-in to a whole
// Workspace domain can't hand out live access by itself.

type AdminUserRow = NonNullable<Awaited<ReturnType<typeof db.adminUser.findUnique>>>;

export type SsoResolution =
  | { outcome: 'ok'; user: AdminUserRow }
  | { outcome: 'pending' } // new (or still-unapproved) account awaiting an owner
  | { outcome: 'deactivated' } // a real account an owner has switched off
  | { outcome: 'error' };

export async function resolveOrProvisionSsoUser(identity: GoogleIdentity): Promise<SsoResolution> {
  try {
    const email = identity.email.toLowerCase();

    // 1) Returning user, matched on the immutable Google `sub`.
    let user = await db.adminUser.findFirst({ where: { googleSub: identity.sub } });
    // 2) Existing account with this login email (the seamless merge path).
    if (!user) user = await db.adminUser.findFirst({ where: { email } });
    // 3) Account an owner pre-linked to this Google email (login email differs).
    if (!user) user = await db.adminUser.findFirst({ where: { googleEmail: email } });

    if (user) {
      // Never bind a Google identity already claimed by a different account.
      if (user.googleSub && user.googleSub !== identity.sub) return { outcome: 'error' };

      // An account auto-created by SSO that an owner hasn't approved yet.
      const awaitingApproval = user.active === false && user.createdBy === 'google-sso';
      if (user.active === false && !awaitingApproval) return { outcome: 'deactivated' };
      if (awaitingApproval) {
        await db.adminUser.update({ where: { id: user.id }, data: { googleSub: identity.sub, googleEmail: email } });
        return { outcome: 'pending' };
      }

      const updated = await db.adminUser.update({
        where: { id: user.id },
        data: {
          googleSub: identity.sub,
          googleEmail: email,
          lastLoginAt: new Date(),
          ...(user.name ? {} : { name: identity.name || null }), // fill a blank name on first SSO
        },
      });
      return { outcome: 'ok', user: updated };
    }

    // 4) No match — provision a disabled account for owner approval. The
    //    password hash is a throwaway random value (unusable) so the account is
    //    Google-only until an owner sets a password.
    await db.adminUser.create({
      data: {
        email,
        name: identity.name || null,
        role: 'STAFF',
        active: false,
        passwordHash: await hashPassword(randomUUID() + randomUUID()),
        googleSub: identity.sub,
        googleEmail: email,
        createdBy: 'google-sso',
      },
    });
    await notifyOwnersOfPending(email);
    return { outcome: 'pending' };
  } catch {
    return { outcome: 'error' };
  }
}

async function notifyOwnersOfPending(email: string): Promise<void> {
  try {
    const owners = await db.adminUser.findMany({ where: { role: 'OWNER', active: true }, select: { id: true } });
    if (owners.length) {
      await db.staffNotification.createMany({
        data: owners.map((o) => ({
          userId: o.id,
          kind: 'system',
          title: 'New Google sign-in awaiting approval',
          body: `${email} signed in with Google and needs a role before they can access the admin. Open Staff to approve.`,
          href: '/admin/staff',
        })),
      });
    }
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'NOTE_ADDED', actor: 'google-sso', summary: `Provisioned disabled staff account pending approval: ${email}` });
  } catch {
    /* notifying owners must never break sign-in */
  }
}
