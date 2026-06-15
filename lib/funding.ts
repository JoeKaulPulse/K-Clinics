// ─────────────────────────────────────────────────────────────────────────────
// Academy funding model — shared by the public funding page, the eligibility
// wizard (client) and the application API (server). Keep this file free of
// server-only imports so the client wizard can use the types + logic.
//
// Honesty rule: a route is only `available` when a learner can actually use it
// through K Academy today. Government routes need an approval we do not hold yet
// (ESFA Advanced Learner Loans facility, GLA/ASF contract, OfS registration),
// so they are `coming_soon` — the page invites learners to register interest,
// which also builds the demand evidence those applications need. Do not present
// a `coming_soon` route as if funding is in place.
// ─────────────────────────────────────────────────────────────────────────────

export type FundingRouteKey =
  | 'course_finance'
  | 'self'
  | 'advanced_learner_loan'
  | 'adult_skills_fund'
  | 'islington'
  | 'lle';

export type RouteStatus = 'available' | 'coming_soon';

export type FundingRoute = {
  key: FundingRouteKey;
  name: string;
  status: RouteStatus;
  /** One-line "who it's for". */
  who: string;
  /** One-line "how the money works". */
  pays: string;
  /** Short explainer paragraph. */
  detail: string;
  /** Eligibility caveat shown in small print. */
  note?: string;
};

export const FUNDING_ROUTES: FundingRoute[] = [
  {
    key: 'course_finance',
    name: 'Monthly course finance',
    status: 'available',
    who: 'Anyone who wants to spread the cost',
    pays: 'You pay in monthly instalments; we are paid up front',
    detail:
      'Split your course fee into manageable monthly payments through our finance partner. Quick to apply, a soft eligibility check, and you keep your place while you pay it off.',
    note: 'Subject to status and eligibility, 18+, UK residents. Finance is provided by a third party, not by K Academy.',
  },
  {
    key: 'self',
    name: 'Self or employer funded',
    status: 'available',
    who: 'Paying yourself, or sponsored by an employer',
    pays: 'Pay in full, by deposit + balance, or via your employer',
    detail:
      'Pay for your course directly, or ask your employer to sponsor you. Many clinics and salons fund staff training. We can invoice an employer and provide everything they need.',
  },
  {
    key: 'advanced_learner_loan',
    name: 'Advanced Learner Loan',
    status: 'coming_soon',
    who: 'Learners aged 19+ on our Level 3 and Level 4 qualifications',
    pays: 'A government loan pays your fees; you repay only once you earn over the threshold',
    detail:
      'For our Ofqual-regulated Level 3 and Level 4 courses. The loan covers your course fee, is not means-tested, and you only start repaying once you earn above the income threshold — like a student loan. Repayments are written off after the set period if not cleared.',
    note: 'We are applying to offer Advanced Learner Loans. Register your interest and we will contact you the moment our loans facility is approved.',
  },
  {
    key: 'adult_skills_fund',
    name: 'Adult Skills Fund (Mayor of London)',
    status: 'coming_soon',
    who: 'London residents aged 19+ who are unemployed or on a low wage',
    pays: 'Fully or part funded — often free to the learner',
    detail:
      'London adult education funding from the Mayor of London. Eligible Londoners can train for free or at a reduced cost on qualifying courses, with priority for people who are unemployed or earning under the funding threshold.',
    note: 'Available through a funded college partner or once our own contract is in place. Eligibility is confirmed individually.',
  },
  {
    key: 'islington',
    name: 'Islington Council learning',
    status: 'coming_soon',
    who: 'Islington residents aged 19+',
    pays: 'Free or subsidised community learning places',
    detail:
      'Islington Adult Community Learning supports residents into skills and work. We are building a partnership so Islington residents can access funded places on our courses.',
    note: 'Subject to residency and the council’s eligibility rules.',
  },
  {
    key: 'lle',
    name: 'Lifelong Learning Entitlement',
    status: 'coming_soon',
    who: 'Learners on Level 4 to Level 6 courses, from 2027',
    pays: 'A flexible government loan you can use across your lifetime',
    detail:
      'From January 2027 the new Lifelong Learning Entitlement gives every adult a flexible loan allowance (worth around four years of study) to spend on Level 4–6 courses and modules. It replaces Advanced Learner Loans for most higher-level study.',
    note: 'Launches for courses starting January 2027. Requires Office for Students registration, which we are working towards.',
  },
];

export const ROUTE_BY_KEY: Record<FundingRouteKey, FundingRoute> = Object.fromEntries(
  FUNDING_ROUTES.map((r) => [r.key, r]),
) as Record<FundingRouteKey, FundingRoute>;

// ── Eligibility self-check ──────────────────────────────────────────────────

export type LocationBand = 'islington' | 'london' | 'england' | 'other';
export type EmploymentBand = 'unemployed' | 'employed' | 'self_employed' | 'other';
/** Course level the learner is interested in. '5_7' covers Levels 5–7. */
export type CourseLevelBand = '2' | '3' | '4' | '5_7';

export type EligibilityInput = {
  age19Plus: boolean;
  residencyOk: boolean; // settled / 3-year UK or EU residence
  location: LocationBand;
  employment: EmploymentBand;
  lowIncome: boolean; // unemployed or on a low wage
  courseLevel: CourseLevelBand;
  priorLevel3: boolean; // already holds a full Level 3
};

/**
 * Map a self-check to the routes a learner could plausibly use, most relevant
 * first. This is a guide, not a decision — staff confirm real eligibility. The
 * two `available` routes (course finance, self/employer) are always offered.
 */
export function recommendRoutes(i: EligibilityInput): FundingRouteKey[] {
  const out: FundingRouteKey[] = [];
  const inLondon = i.location === 'islington' || i.location === 'london';
  const lowerLevel = i.courseLevel === '2' || i.courseLevel === '3';
  const higherLevel = i.courseLevel === '3' || i.courseLevel === '4' || i.courseLevel === '5_7';

  // Free / fully-funded routes lead when the learner clearly qualifies.
  if (i.age19Plus && i.residencyOk && inLondon && lowerLevel && (i.lowIncome || (i.courseLevel === '3' && !i.priorLevel3))) {
    out.push('adult_skills_fund');
  }
  if (i.age19Plus && i.location === 'islington') out.push('islington');

  // Loan routes for the regulated higher levels.
  if (i.age19Plus && i.residencyOk && higherLevel) out.push('advanced_learner_loan');
  if (i.age19Plus && i.residencyOk && (i.courseLevel === '4' || i.courseLevel === '5_7')) out.push('lle');

  // Always-available fallbacks.
  out.push('course_finance', 'self');

  // De-dupe while preserving the priority order above.
  return [...new Set(out)];
}

/** The primary route to record against an application (first government/loan
 *  route if any qualified, otherwise the monthly-finance fallback). */
export function primaryRoute(keys: FundingRouteKey[]): FundingRouteKey {
  return keys.find((k) => k !== 'course_finance' && k !== 'self') ?? 'course_finance';
}

export const COURSE_LEVEL_LABEL: Record<CourseLevelBand, string> = {
  '2': 'Level 2',
  '3': 'Level 3',
  '4': 'Level 4',
  '5_7': 'Levels 5–7',
};
