# K Academy + SEO command centre — build plan

Two large tasks, each shipped as its own reviewable PR (not auto-merged).

## Task 1 — K Clinics Academy (/academy subdirectory)
Premium training sub-brand (Harley Academy-style), same brand ident.
Requirements (from owner):
- Enrol = apply/enquire → staff take payment manually; **Clearpay** financing promoted.
- Flexible: enrol anytime, add to existing cohorts. Theory on **Thinkific**, scheduled
  **practical days**, **VTCT exam** administered in-house. Ofqual-regulated, **CPD** accredited.
- Levels 2–4 now (~£3.5k); applying for Levels 4–7 — premium pricing. Equipment leasing upsell.
- Catalogue **fully CRM-managed**. **Separate** trainee accounts/portal.

Build:
- [ ] Schema: Course, Cohort, Enrolment, AcademyStudent (+ enums)
- [ ] Academy session (separate cookie/secret) + academy-auth lib
- [ ] Admin CRM: courses / cohorts / enrolments (applications → payment → enrol)
- [ ] Public /academy: landing, course list, course detail + application form
- [ ] Application API → enrolment(APPLIED) + emails (academy + applicant)
- [ ] Trainee portal: signup/login/dashboard (enrolled courses, Thinkific, dates, exam)
- [ ] Seed example courses (L2–L7) + accreditation badges + equipment-leasing section
- [ ] Nav entries; build green; PR

## Task 2 — SEO / GEO / Agentic command centre (admin)
- GEO = both Generative Engine Optimization + local/geographic.
- Scope: on-page, technical/structured-data, generative/agentic readiness, local/GEO.
- Full per-page SEO control (title/meta/canonical/robots/OG/JSON-LD) stored in DB, overrides code.
- Rules-based scoring (per-page rating + overall health) + AI suggestions via Claude API.

Build:
- [ ] PageSeo model (per-path overrides) + SeoScore snapshots
- [ ] Page registry (enumerate routes + metadata)
- [ ] Rules-based analyzer → per-page score + overall health
- [ ] Admin /admin/seo: health dashboard, per-page editor, scores, AI suggestions
- [ ] Apply overrides in metadata/JSON-LD rendering
- [ ] AI suggestions endpoint (Claude API, graceful without key)
- [ ] llms.txt, FAQ/HowTo schema, local schema; build green; PR
