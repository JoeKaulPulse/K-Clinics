// Age-gating helpers (pure, shared client/server). The clinic serves 18+ only;
// the academy accepts students 16+. We don't collect or hold ID — we validate
// the declared date of birth and require an age declaration.
export const MIN_CLIENT_AGE = 18;
export const MIN_STUDENT_AGE = 16;

/** Whole years old on a given date. */
export function ageOn(dob: Date | string, on: Date | string = new Date()): number {
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  const o = typeof on === 'string' ? new Date(on) : on;
  if (isNaN(+d) || isNaN(+o)) return NaN;
  let age = o.getFullYear() - d.getFullYear();
  const m = o.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && o.getDate() < d.getDate())) age--;
  return age;
}

export const meetsMinAge = (dob: Date | string, min: number, on: Date | string = new Date()): boolean => {
  const a = ageOn(dob, on);
  return Number.isFinite(a) && a >= min;
};

export const isAdultOn = (dob: Date | string, on: Date | string = new Date()) => meetsMinAge(dob, MIN_CLIENT_AGE, on);
