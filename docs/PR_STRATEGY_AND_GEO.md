# KClinics — PR Strategy & GEO Plan

_Owner document · 25 September 2026 · Source: `scripts/build-pr-geo-strategy.mjs` (also renders `docs/pr-strategy/KClinics-PR-Strategy-and-GEO.pdf`)._

## Summary

Where the platform stands on 25 September 2026, what changed today, and the order of work for the next quarter.

### The short version

- **Academy first.** The EQA (External Quality Assurance) visit is next month. The site now publishes a full set of centre policies for the owner to rewrite in the admin, the funding claims match reality (no government funding before 2028), and every academy page carries the structured data and plain facts that AI answer engines and Google need.
- **Then the shop.** The shop already switches itself on the moment a product goes live; it now also announces its catalogue to search and AI engines. The remaining work is the owner adding products.
- **Dental last, step by step.** Nothing changes until a GDC-registered dentist is in post. The site keeps saying "opening soon" everywhere, including to AI assistants.
- **Ads after, not before.** Yes: get the academy policies and copy approved before paying for academy traffic. Clinic treatment ads can start earlier because booking, pricing and conversion tracking are already live.
- **Pull requests.** Of 35 open pull requests, none could be merged as they stood. By the end of the day 11 were merged and one closed as already shipped, leaving 24 open: one resolved and waiting for a push, seven to re-cut on current main, two Dependabot majors, and the drafts that need an owner decision. Each is listed with the exact decision or rework it needs.

### Done today

- **GEO layer shipped.** Explicit rules for AI crawlers, a live llms.txt and a full-text llms-full.txt, a K Academy entity in the structured data, course and product lists, FAQ schema, and a checker script (node scripts/geo-check.mjs).
- **Funding copy corrected.** Every page, FAQ and AI-facing file now says the same thing: Advanced Learner Loans and the Adult Skills Fund are not available through K Academy and are not expected before 2028; monthly finance and employer funding are.
- **Centre policies hub.** Ten draft policies at kclinics.co.uk/academy/policies, each editable in Admin → Pages. Version 1.0, marked for owner review.
- **Board updated.** Project PRJ-1291 on the Build board holds the nine tasks from the owner's message, with who does what and what "done" looks like.
- **Pull requests merged.** 12 pull requests shipped to production and one closed as already shipped (list in section 3). Open security advisories on main fell from 9 to 1.

> **Owner actions:** Two things only the owner can do this week: (1) read and approve the ten centre policies before the EQA visit, and (2) send the list of new programmes (title, level, awarding body, fee, duration, first cohort) so they can be added in Admin → Academy.

## Priorities in order

The owner's message, turned into a sequence with a definition of done for each step.

| Order | What | Done when | Who |
| --- | --- | --- | --- |
| 1 | EQA readiness: approve centre policies; gather evidence pack (section 5) | Policies approved and dated; evidence folder complete; mock visit walked through | Owner + Head of Centre |
| 2 | Academy programme expansion | New courses live on /academy with cohorts, fees and accreditation shown; each has a Course schema and llms.txt line automatically | Owner supplies data; admin adds |
| 3 | Funding page and academy copy review | Owner has read /academy and /academy/funding and confirmed every claim | Owner |
| 4 | Shop launch | At least one product live; geo-check shows /shop ItemList; a test order placed and refunded | Owner adds products |
| 5 | Academy ads | Policies approved, copy confirmed, then a single campaign to /academy with UTM tags and a weekly check of enquiries | Owner / agency |
| 6 | Pull-request backlog | Every open PR merged, closed or carrying a written decision; branch count under 30 | Claude, owner decisions where marked |
| 7 | Dental | Dentist in post; admin flag switched on; then dentistry pages, schema and llms.txt flip automatically | Owner, later |

### Why this order

The academy has the strongest ratio of upside to effort: enrolment, payment, learning, homework, VTCT registration and certificates already run through the platform, so each new programme is mostly data entry. The EQA visit is a fixed date and a failed visit would stall everything else, so it comes first. The shop is cheap to finish. Dental depends on a hire, not on code.

### Funding reality

The owner's reading is right: no decent direct student funding (Advanced Learner Loans, Adult Skills Fund) will be open for around two years. The site now says exactly that in one shared sentence, keeps the routes visible as "register interest" so demand is logged for a future bid, and leads every learner to the two routes that work today: monthly finance and self or employer funding. Lifelong Learning Entitlement launches nationally for January 2027 courses but needs Office for Students registration, which the academy does not hold, so it is also marked as not before 2028.

## Pull-request strategy

How the 35 open pull requests were triaged, what shipped, what needs the owner, and the rules that stop the backlog growing again.

### State of the backlog before today

- **35 open pull requests,** the oldest from June. 15 drafts. 474 branches on the remote.
- **Zero were mergeable as they stood.** 15 were only behind main (a branch update fixes that); 20 had merge conflicts.
- **One file caused most conflicts:** lib/build-backlog.ts, the in-code backlog that every feature PR appends to. Twelve of the twenty conflicts touched nothing else.
- **The red "npm audit" check is inherited from main,** not caused by the PRs: it fails on every branch cut in two date windows and passes on the others regardless of the diff. It should not gate merges until the audit is fixed on main.
- **Two PRs fail typecheck for real:** #1964 (production dependency group, 21 updates) and #1955 (pricing planner).

### Merged to production today

| PR | What |
| --- | --- |
| #1998 | chore(deps): codeql-action 4.37.4 → 4.38.1 |
| #1992 | fix(seo,marketing,a11y): Royal Mail post town in schema, OG truncation, live-chat focus (BLD-1841, PRJ-1229.11/.12) |
| #1936 | chore(deps): baseline-browser-mapping 2.10.35 → 2.11.21 (CVE fix) |
| #1935 | chore(deps): js-yaml 4.3.1 → 4.3.2 (security backport) |
| #1923 | chore(deps): browserslist 4.28.2 → 4.28.9 |
| #1907 | chore(deps): fast-uri 3.1.5 → 3.1.7 (high-severity fixes) |
| #1624 | build(deps): actions/setup-node 6 → 7 |
| #2018 | feat(geo): AI-crawler rules, llms.txt/llms-full.txt, academy schema, centre policies hub, honest funding copy, this document (PRJ-1291.1–.3) |
| #2019 | fix(academy): centre-policy pages public in middleware, meta descriptions trimmed (found by geo-check after the first deploy) |
| #1997 | fix(clients): mandatory client registration fields (BLD-1870) — conflict resolved and merged later the same day |
| #1994 | feat(academy): editable VTCT registration declaration (BLD-1867) — conflict resolved and merged later the same day |
| #1996 | feat(payments): Klarna & Clearpay claims where BNPL is real (BLD-1827) — conflict resolved and merged later the same day |

### Resolved locally, one push away

Four non-draft PRs conflicted only on the backlog file (and, in two cases, one small content file). The merges from main were prepared and checked in this session; pushing onto another session's branch was stopped by the sandbox safety check, so the pushes were handed over as a task. Three of the four (#1997, #1994, #1996) were then pushed and merged the same afternoon. One remains:

| PR | Topic | Conflict | Resolution |
| --- | --- | --- | --- |
| #1995 | Deliberate £0 appointment price (BLD-1869) | Backlog file + two admin booking pages | Keep both sides of lib/build-backlog.ts; take main's package-session layout in the two admin booking pages and add the "price set by staff" guard in the three price expressions (priceSetByStaff \|\| … > 0). Push, wait for typecheck, squash-merge. |

### Waiting on an owner decision

Each of these is blocked on a judgement only the owner can make. Reply on the PR or on the board item with the decision and Claude will finish it.

| PR | Topic | Decision needed |
| --- | --- | --- |
| #1777 | Homepage hero carousel | Promo slide says "£150, was £210" but the catalogue price is £125. Confirm the real price and the was-price (ASA/CPR rule: a was-price must be a genuine previous price). |
| #1728 | Outstanding-balance warning | Two product decisions: what "settled to zero" means, and whether staff need a manual "clear balance" button. |
| #1961 | Cookie banner autofocus | Auto-focusing "Accept all" on a consent banner is a GDPR/PECR judgement. Say yes or no. |
| #1915 | Account handover document | Merge only once the repository is private (decision D2) or keep it in the password vault. It names people and logins. |
| #1149 | SaaS pricing draft | Figures are for sign-off. Edit the numbers or approve as-is. |
| #1450 | Academy DB seam refactor | Foundational refactor; needs a database-enabled review session. Approve the direction or close. |
| #1879 / #1955 | Two finance planners | Both add a planner under Admin → Finance. Pick one direction (#1955 also fails typecheck today). |
| #1025 | Client medical flag "debil" | A data fix, not code: open the client record and clear the field, then close the PR. |
| #1242 | Google Analytics/Ads migration guide | An owner action in Google, not code. Read the guide, do the steps, then merge or close. |

### Conflicting PRs to re-cut

These carry real changes but conflict with two months of drift in the same files. Resolving hunks blind on money and kiosk paths is riskier than re-applying the change on current main, so each gets a short re-cut with its own test step.

| PR | Topic | Conflicts | Plan |
| --- | --- | --- | --- |
| #1792 | Kiosk accessibility batch (5 refs) | 8 files | Kiosk and portal files moved on since August. Re-cut on main in one sitting; run the kiosk visual QA before merging. |
| #1782 | Error-colour token migration (43 files) | 5 files | Mechanical. Re-run the search-and-replace on current main instead of resolving hunks. |
| #1781 | Brand/a11y fixes + restore lint | eslint config add/add | Main already has eslint.config.mjs. Drop that file from the PR, keep the three UI fixes. |
| #1780 | Campaign/push reliability | dispatch cron, push.ts | Re-apply on current main; the send loop changed. Needs a staged test send. |
| #1779 | Gift-voucher accounting in fees/disputes | Stripe webhook, booking actions | Money path. Re-apply on main with a written test plan and one real refund test on a Neon branch. |
| #1724 | Admin price override panel | bookings page, schema | Probably superseded: main already has overrideBookingPrice (used by #1995). Verify, then close. |
| #1723 | Batched report queries + voucher on refund | reports page | Small. Re-apply on current main. |
| #1720 / #1689 | Draft correctness batches | several | Drafts with no stated reason. Re-cut the parts still relevant as one small PR each. |

### Dependabot

- **Patch and minor bumps** merge on green typecheck without review (seven merged today).
- **Major bumps** are split out of the grouped PRs: #1964 fails typecheck (simplewebauthn 14) and #1963 bumps eslint to 10 and pdfkit to 0.20, which breaks every branded PDF builder in scripts/. Fix forward in one PR with typecheck plus a PDF build smoke test, or pin the majors and let Dependabot re-open the rest.

### Rules from now on

1. One PR per board reference. The title carries the ref (BLD-… or PRJ-…). No batches of five unrelated fixes; they are what made the August PRs unmergeable.
2. Feature PRs do not edit lib/build-backlog.ts. The board is the record; the file only changes in a dedicated "chore(backlog)" PR. This removes the main conflict source overnight.
3. A PR is either ready or a draft with a written reason and a named decision-maker (the board's "needs" field). A draft with no reason is closed after 14 days.
4. Merge within 48 hours of green, or update the branch from main daily. Anything older than 14 days is re-cut, not resolved.
5. Required checks: typecheck and CodeQL. npm audit reports but does not block until it is green on main.
6. Branch hygiene: delete the branch on merge (repository setting), and prune branches with no open PR every Friday. Target: under 30 branches.
7. Owner decisions are asked once, in one place: the board item, with the options spelled out. The PR links to it.

## GEO: being the answer

Generative engine optimisation is making sure that when someone asks ChatGPT, Perplexity, Gemini, Copilot or Google's AI Overview about aesthetics treatment or training in Islington, the answer names KClinics and K Academy and gets the facts right.

### What GEO needs that SEO did not

- **Permission.** AI crawlers look for a robots rule naming them. The site now names GPTBot, ClaudeBot, PerplexityBot, Google-Extended and the others explicitly, with the same public/private split as Google.
- **A plain-text summary.** /llms.txt is the emerging convention: one page of facts an assistant can read in a second. It now lists live courses, bundles, products, the funding position, policies and FAQs, and regenerates hourly. /llms-full.txt carries the full text for grounding.
- **One entity, everywhere.** K Academy is now its own EducationalOrganization in the structured data, a child of the clinic, referenced from every course. Answer engines resolve entities, not pages.
- **Quotable facts.** The academy page opens with six short facts (where, regulation, delivery, courses, paying, government funding) written to be lifted verbatim.
- **Questions answered in the page's own words.** FAQ schema on the academy hub and the funding page, matching the visible accordions and llms.txt word for word.
- **Honesty.** Assistants punish contradictions. The funding sentence is defined once in code and reused, so no page can drift.

### What shipped

| Surface | Change | Why it matters |
| --- | --- | --- |
| robots.txt | Explicit AI-crawler group; llms files allowed | Removes any doubt the content may be read and cited |
| /llms.txt | Live, hourly; academy, shop, policies, funding, FAQs | The one file an assistant reads first |
| /llms-full.txt | New: full text of treatments, courses, policies, FAQs | Grounding without crawling 150 pages |
| /academy | EducationalOrganization + ItemList + FAQPage; facts block; FAQ accordion | Entity, catalogue and answers in one place |
| /academy/[course] | Provider now the academy entity; entity shipped on page | Course rich results resolve to one provider |
| /academy/funding | FAQPage; copy corrected | Stops assistants promising funding that does not exist |
| /academy/policies | New hub + 10 pages; ItemList; CMS-editable | Trust signals; EQA evidence; citable policy text |
| /shop | ItemList of products | Catalogue visible from the hub |
| sitemap.xml | Policies added; lastmod refreshed | Freshness signal is honest |
| scripts/geo-check.mjs | Green/red check of all of the above | Run weekly; add to the routine |

### Next 30 / 60 / 90 days

#### Next 30 days

- **Claim and complete the listings assistants trust:** Google Business Profile (clinic and academy as services), Bing Places, Apple Business Connect. Same name, address and phone everywhere as on the site (4 Charterhouse Buildings, Goswell Road, EC1M 7AN, 020 8050 0750).
- **Get listed where training is verified:** the VTCT centre finder and the CPD provider directory. Assistants weight third-party confirmation of accreditation heavily.
- **Reviews with text.** Ask every graduating cohort and every clinic client for a Google review that mentions the treatment or course by name; the site already shows real ratings only.
- **Run the checker** against production after every deploy (node scripts/geo-check.mjs) and fix anything red the same day.

#### Days 30 to 60

- **Digital PR:** two or three pieces in trade or local press (Aesthetics Journal, Professional Beauty, Islington Tribune) about the academy and the EQA outcome. Mentions on sites the models already trust move answers more than anything on-site.
- **Author pages:** a named clinician or tutor with qualifications on every journal article and course page (Person schema, linked to the team page).
- **Comparison content:** articles that answer the questions people actually type ("Level 4 aesthetics course London cost", "VTCT vs CPD laser course"), each with a FAQ block.

#### Days 60 to 90

- **Measure.** Once a month, ask ChatGPT, Perplexity, Gemini and Copilot the same ten questions (best laser clinic Islington, Level 4 aesthetics course London, and so on) and log whether KClinics is named and whether the facts are right. Track AI referrals in GA4 (referrers chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com).
- **Extend the pattern:** facts block and FAQ schema on the dentistry and pricing pages; a course-comparison table on /academy.

### How to check it yourself

1. Open kclinics.co.uk/llms.txt in a browser. You should see the clinic facts, the course list and the funding sentence.
2. Open kclinics.co.uk/robots.txt. You should see a block starting "User-Agent: GPTBot".
3. Ask ChatGPT or Perplexity: "Is government funding available for K Academy courses in Islington?" The right answer is "not at present, not expected before 2028".
4. In a session with Claude, run: node scripts/geo-check.mjs. Every line should start with a tick.

## EQA readiness

What the awarding organisation's External Quality Assurer will look for next month, and what the platform now gives you.

### Centre policies (published today, for the owner to rewrite)

- **Malpractice and maladministration** (includes plagiarism and AI-written work)
- **Appeals** (three stages, time limits, VTCT as the final stage)
- **Learner complaints** (separate from the clinic's treatment complaints)
- **Equality, diversity and inclusion**
- **Safeguarding and Prevent** (names the Head of Centre as Designated Safeguarding Lead)
- **Reasonable adjustments and special consideration**
- **Assessment and internal quality assurance** (assessor and IQA requirements, sampling plan, standardisation, records)
- **Health and safety in training** (lasers, sharps, models, first aid)
- **Learner conduct, attendance and withdrawal** (includes fees on withdrawal)
- **Conflict of interest**

> **Important:** These are drafts written to VTCT centre expectations, marked version 1.0 and dated 25 September 2026. The owner must read each one, change anything that does not match how the academy actually runs (names, time limits, who does what), and treat the published version as approved. Do not show a policy to the EQA that you have not read.

### How to rewrite a policy (no technical knowledge needed)

1. Sign in to the admin at kclinics.co.uk/admin/login with your admin email and password.
2. In the left sidebar click "Pages".
3. In the list of legal pages find the row starting "Academy:" with the policy name, and click it.
4. Edit the text in the boxes. Leave the page path exactly as it is (for example /academy/policies/appeals).
5. Click the "Publish" button (top right). Leave "Draft" unticked.
6. Open kclinics.co.uk/academy/policies/appeals in a new tab and read it back.
7. Done when: the page shows your wording, and the version line at the top has been updated by you.

### Evidence pack to have ready

- **Centre policies** (above), signed and dated.
- **Staff file for each tutor, assessor and IQA:** CV, occupational qualifications, assessor/IQA qualification or countersigning arrangement, CPD log, conflict-of-interest declaration.
- **IQA sampling plan** for the year, with completed sampling records, observation records and standardisation meeting minutes.
- **Learner records:** registrations with VTCT, induction checklists, signed authenticity declarations, assessment records and feedback, reasonable-adjustment requests and decisions.
- **Logs:** complaints, appeals, malpractice, accidents/incidents, and the actions taken.
- **Health and safety:** risk assessments for each practical activity and device, laser Local Rules, first-aid and fire arrangements, model consent forms.
- **Previous EQA report** with every action point closed and evidenced.

The academy portal already holds enrolments, VTCT registration declarations, homework and certificates; export what the EQA asks for from Admin → Academy rather than rebuilding it in a spreadsheet.

## Ads: when to start

A direct answer to "probably better to get all this sorted before running ads?"

### Academy ads: after the EQA visit and the policy sign-off

Paid traffic magnifies whatever it lands on. Until the policies are approved and the funding copy is confirmed, an ad click could land on a promise the academy cannot keep, which wastes money and, on funding claims, creates a consumer-protection risk. The fix takes days, not months, so waiting costs little.

### Clinic ads: can start now

Booking, pricing, the 24-hour cancellation rule, GA4 and Google Ads conversion tracking are live and audited. A small treatment campaign (laser hair removal, skin) to the existing treatment pages is safe today and gives the account conversion data before the academy campaign starts.

### Checklist before any campaign

1. Landing page reviewed by the owner (facts, price, offer) and geo-check green.
2. Conversion events checked in GA4 (view_item, begin_checkout, purchase / enrolment) on a test.
3. UTM tags on every ad URL so enquiries can be traced to the campaign in the CRM.
4. A weekly 15-minute review: spend, enquiries, enrolments, and one look at the search terms report.

## Appendix: every open PR

The full triage table as of 25 September 2026.

| PR | Title | Draft | Outcome / next step |
| --- | --- | --- | --- |
| 1998 | Dependabot codeql-action | no | merged today |
| 1997 | Mandatory client registration fields (BLD-1870) | no | merged today (after conflict resolution) |
| 1996 | Klarna/Clearpay copy (BLD-1827) | no | merged today (after conflict resolution) |
| 1995 | £0 appointment price (BLD-1869) | no | resolution prepared; push + merge |
| 1994 | Editable VTCT declaration (BLD-1867) | no | merged today (after conflict resolution) |
| 1992 | Schema post town, OG truncation, chat focus | no | merged today |
| 1964 | Dependabot production deps (21) | no | typecheck fails — fix forward or split |
| 1963 | Dependabot dev deps (eslint 10, pdfkit 0.20) | no | breaking majors — split |
| 1961 | Cookie banner overlap/autofocus | draft | owner decision |
| 1955 | Pricing planner (BLD-1758) | draft | typecheck fails; overlaps #1879 |
| 1936 | Dependabot baseline-browser-mapping | no | merged today |
| 1935 | Dependabot js-yaml | no | merged today |
| 1923 | Dependabot browserslist | no | merged today |
| 1915 | Account handover plan (BLD-1650) | draft | owner decision D2 |
| 1907 | Dependabot fast-uri | no | merged today |
| 1879 | Finance planner + model docs | draft | pick vs #1955 |
| 1792 | Kiosk a11y batch | no | re-cut on main |
| 1782 | Error-colour token migration | no | re-run on main |
| 1781 | Brand/a11y + lint restore | no | drop eslint file, re-cut |
| 1780 | Campaign/push reliability | no | re-apply on main |
| 1779 | Voucher accounting (money path) | no | re-apply with test plan |
| 1777 | Hero carousel (BLD-1197) | draft | owner: price |
| 1728 | Outstanding balance warning (BLD-1066) | draft | owner: semantics |
| 1724 | Admin price override (BLD-1149) | no | likely superseded — verify, close |
| 1723 | Batched reports + voucher refund | no | re-apply on main |
| 1720 | Reliability/security/a11y batch | draft | re-cut |
| 1689 | Review nudge + promo enforcement | draft | re-cut |
| 1688 | Kiosk AI failures to Sentry (BLD-999) | no | closed today: already on main |
| 1624 | Dependabot setup-node 7 | no | merged today |
| 1450 | Academy DB seam (BLD-303) | draft | owner review |
| 1351 | Neon data-masking doc | draft | docs: merge when repo private |
| 1242 | GA/Ads migration guide | draft | owner action |
| 1158 | RLS validation doc (BLD-301) | draft | docs: merge or file in vault |
| 1149 | SaaS pricing draft (BLD-46/47) | draft | owner sign-off |
| 1025 | medicalFlag data fix (BLD-423) | draft | owner data fix |
