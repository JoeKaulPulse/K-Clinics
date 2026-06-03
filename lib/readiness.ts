import 'server-only';

// Computes the pre-treatment "ready to start" status for a booking — the same
// gates enforced in startAppointment, surfaced proactively so a clinician sees
// exactly what's outstanding before they begin.
export type ReadyStatus = 'ok' | 'needed' | 'na';
export type ReadyItem = { key: string; label: string; status: ReadyStatus; detail?: string };

export type ReadinessInput = {
  isLaser: boolean;
  requireConsent: boolean;
  requireBeforePhoto: boolean;
  requireSop: boolean;
  requireMedical: boolean;
  medicalFlag: boolean;
  sopAcknowledgedAt: boolean;
  medicalFlagReviewedAt: boolean;
  consentSigned: boolean;
  consentMapped: boolean; // a consent template applies to this treatment
  photoOrOptOut: boolean;
  aftercareAckAt: boolean;
  started: boolean;
};

export function computeReadiness(i: ReadinessInput): { items: ReadyItem[]; ready: boolean; neededCount: number } {
  const items: ReadyItem[] = [];

  // Medical-flag review (only when the client is flagged and the policy requires it).
  if (i.medicalFlag) {
    items.push({ key: 'medical', label: 'Medical flag reviewed', status: i.medicalFlagReviewedAt ? 'ok' : (i.requireMedical ? 'needed' : 'na'), detail: i.medicalFlagReviewedAt ? undefined : 'Client has a medical flag to review.' });
  }
  // SOP acknowledgement.
  items.push({ key: 'sop', label: 'Treatment SOP acknowledged', status: i.sopAcknowledgedAt ? 'ok' : (i.requireSop ? 'needed' : 'na') });
  // Consent.
  if (i.consentMapped || i.requireConsent) {
    items.push({ key: 'consent', label: 'Consent signed', status: i.consentSigned ? 'ok' : (i.requireConsent ? 'needed' : 'na'), detail: i.consentSigned ? undefined : 'Send the client a signing link.' });
  }
  // Laser before-photo (or signed opt-out).
  if (i.isLaser) {
    items.push({ key: 'photo', label: 'Before photo (or opt-out)', status: i.photoOrOptOut ? 'ok' : (i.requireBeforePhoto ? 'needed' : 'na'), detail: i.photoOrOptOut ? undefined : 'Capture a before photo or take a signed opt-out.' });
  }
  // Aftercare (acknowledged by the client at booking — informational).
  items.push({ key: 'aftercare', label: 'Aftercare acknowledged', status: i.aftercareAckAt ? 'ok' : 'na' });

  const neededCount = items.filter((it) => it.status === 'needed').length;
  return { items, ready: neededCount === 0, neededCount };
}
