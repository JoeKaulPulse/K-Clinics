import 'server-only';
import type { Prisma } from '@prisma/client';

// Rule-based audience segments evaluated against Client records.
export type SegmentRules = {
  gender?: string;        // FEMALE | MALE | …
  source?: string;        // website | referral | treatwell …
  tag?: string;           // a client tag
  lapsedDays?: number;    // last visit older than N days
  optInOnly?: boolean;    // marketing-opted-in & not unsubscribed
  visited?: 'any' | 'visited' | 'never';
};

export function rulesToWhere(rules: SegmentRules): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = {};
  if (rules.gender) where.gender = rules.gender as Prisma.ClientWhereInput['gender'];
  if (rules.source) where.source = rules.source;
  if (rules.tag) where.tags = { has: rules.tag };
  if (rules.optInOnly) { where.marketingOptIn = true; where.unsubscribed = false; }
  if (rules.lapsedDays && rules.lapsedDays > 0) {
    where.lastVisitAt = { lt: new Date(Date.now() - rules.lapsedDays * 86400000) };
  } else if (rules.visited === 'visited') {
    where.lastVisitAt = { not: null };
  } else if (rules.visited === 'never') {
    where.lastVisitAt = null;
  }
  return where;
}

export async function countSegment(rules: SegmentRules): Promise<number> {
  const { db } = await import('@/lib/db');
  return db.client.count({ where: rulesToWhere(rules) });
}

export function describeRules(r: SegmentRules): string {
  const parts: string[] = [];
  if (r.gender) parts.push(r.gender.toLowerCase());
  if (r.source) parts.push(`from ${r.source}`);
  if (r.tag) parts.push(`tagged “${r.tag}”`);
  if (r.optInOnly) parts.push('marketing opted-in');
  if (r.lapsedDays) parts.push(`not seen in ${r.lapsedDays}d`);
  else if (r.visited === 'visited') parts.push('have visited');
  else if (r.visited === 'never') parts.push('never visited');
  return parts.length ? parts.join(' · ') : 'all clients';
}
