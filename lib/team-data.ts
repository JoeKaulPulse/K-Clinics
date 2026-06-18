import 'server-only';
import { db } from '@/lib/db';
import { getTreatment } from '@/lib/treatments';

// Single source of truth for the public /team page — driven entirely by the CRM
// staff records (AdminUser). New team members with a public profile appear
// automatically. Clinicians/practitioners are returned first, then support staff.

export type TeamMember = {
  id: string;
  name: string;
  title: string | null;
  credentials: string | null;
  photoUrl: string | null;
  phone: string | null;
  bio: string | null;
  yearsExperience: number | null;
  rating: number | null;
  reviewCount: number;
  services: string[];
  isClinician: boolean;
};

export async function publicTeam(): Promise<{ clinicians: TeamMember[]; support: TeamMember[] }> {
  const staff = await db.adminUser.findMany({
    where: { active: true, publicProfile: true },
    orderBy: [{ isClinician: 'desc' }, { profileOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, title: true, credentials: true, photoUrl: true, publicPhone: true, bio: true, yearsExperience: true, isClinician: true, competencies: true },
  });
  if (staff.length === 0) return { clinicians: [], support: [] };

  // Star rating from each clinician's published reviews.
  const grouped = await db.review.groupBy({
    by: ['clinicianId'],
    where: { clinicianId: { in: staff.map((s) => s.id) }, status: { in: ['PUBLISHED', 'APPROVED'] }, rating: { not: null } },
    _avg: { rating: true },
    _count: { _all: true },
  }).catch(() => [] as { clinicianId: string | null; _avg: { rating: number | null }; _count: { _all: number } }[]);
  const ratings = new Map(grouped.map((g) => [g.clinicianId, { avg: g._avg.rating, count: g._count._all }]));

  const members: TeamMember[] = staff.map((s) => {
    const r = ratings.get(s.id);
    return {
      id: s.id, name: s.name || 'Team member', title: s.title, credentials: s.credentials, photoUrl: s.photoUrl,
      phone: s.publicPhone, bio: s.bio, yearsExperience: s.yearsExperience,
      rating: r?.avg ? Math.round(r.avg * 10) / 10 : null, reviewCount: r?.count ?? 0,
      services: s.competencies.map((slug) => getTreatment(slug)?.title).filter((t): t is string => !!t),
      isClinician: s.isClinician,
    };
  });

  return { clinicians: members.filter((m) => m.isClinician), support: members.filter((m) => !m.isClinician) };
}
