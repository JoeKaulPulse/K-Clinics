# K Academy — Student Funding Action Plan

Step-by-step companion to `docs/ACADEMY_FUNDING_STRATEGY.md`. Written to be
followed by a non-technical owner/manager. A formatted PDF with annotated
screenshots was delivered separately; this is the version-controlled source.

**Read first.** Our Level 2–4 courses are Ofqual-regulated VTCT qualifications —
that is what makes funding possible (government money only pays for regulated
qualifications, not CPD, so Level 5–7 can't be funded yet). UKPRN 10101305 is the
entry ticket, not the funding; each route below is a separate approval. Two routes
go live in days (monthly finance, employer funding); the rest take months — start
now.

Already built on the website (no action needed): `/academy/funding` with a
6-question eligibility checker and an application form; every enquiry lands in
**Admin → K Academy → Funding** and emails the team. Government routes show
"Register interest" until each is approved.

---

## Part 1 — Quick wins (this week)

### 1. Turn on "pay monthly" course finance
*Why: Clearpay caps ~£1,000 — too low for a £3,500 Level 4. A course-finance partner spreads £1.5k–£3.5k and pays you up front.*
1. Pick one provider and open a free merchant account: **Payl8r**, **Tabeo**, **Snap Finance**, or **Knuckle**.
2. They give you a **hosted application link**. Copy it.
3. Ask your developer to set `COURSE_FINANCE_URL` to that link and `COURSE_FINANCE_NAME` to the provider name (2-minute change, no new code).
4. Ask them to set `ACADEMY_NOTIFY_EMAIL` to the inbox that should receive funding enquiries.
- Links: [Payl8r](https://payl8r.com/business) · [Tabeo](https://tabeo.co.uk) · [Snap](https://snapfinance.co.uk/businesses/) · [Knuckle](https://knucklefinance.co.uk)
- Leave alone: keep Clearpay for small amounts.
- **Done when:** the "Apply with monthly finance" button on `/academy/funding` opens your provider's application page.

### 2. Confirm your courses are on the funding list (make-or-break)
*Why: everything below only works if your exact VTCT qualifications are approved for funding.*
1. Open the **Find a learning aim** service.
2. If a cookie message appears, click **Hide cookie message**.
3. Set **Type of learning → Qualifications**; set **Academic Year** to the current year.
4. In **Search by title or reference number**, type the course name (e.g. "Certificate in Aesthetic Practice") or its QAN, press **Search**.
5. Open the qualification and read the **Funding** section: check it lists **Advanced Learner Loans** (L3/L4) and/or **Adult Skills Fund** (L2/L3), and note the **last start date**.
6. Record each course's **QAN**, the funding it's approved for, and the last start date. If a course isn't listed, ask VTCT which equivalent regulated qualification **is** funded and switch funded cohorts to it.
- Links: [Find a learning aim](https://submit-learner-data.service.gov.uk/find-a-learning-aim/) · cross-check on the [register of regulated qualifications](https://www.qualifications.education.gov.uk/)
- **Done when:** you have a one-page list of QANs and their funding approvals. Send it to the developer to switch each website route to "available" at the right time.

### 3. Check your details on the UK Register of Learning Providers (UKRLP)
*Why: funders pull your legal name, address and contact from UKRLP; if it's stale, applications stall.*
1. Open UKRLP and click **Search Providers**.
2. Enter UKPRN **10101305**; check name, address and contact match Companies House.
3. If wrong, click **Update your details** and follow the verification steps as the company's authorised contact.
- Link: [ukrlp.co.uk](https://www.ukrlp.co.uk/)
- **Done when:** UKPRN 10101305 shows your correct legal name, address and a monitored contact email.

### 4. Subscribe to ESFA / DfE email updates
*Why: Advanced Learner Loan facility windows (Task 7) are announced in this weekly bulletin.*
1. Open the ESFA/DfE update page.
2. Click **Get emails** / **Subscribe to updates**; enter your email.
3. Confirm from the email they send.
- Links: [ESFA org page](https://www.gov.uk/government/organisations/education-and-skills-funding-agency) · [Update bulletin](https://www.gov.uk/government/collections/esfa-update)
- **Done when:** you've received the first weekly "DfE Update — further education" email.

---

## Part 2 — Priority application: your own Advanced Learner Loans facility (Level 3 & 4, ~6–12 months)

A government loan pays the student's fee; the Student Loans Company pays **you**; the student repays later only when earning over the threshold. You need a "facility" (contract + spending limit) from the DfE.

### 5. Read the two rulebooks
1. Skim the **Advanced learner loans funding rules 2026 to 2027** (who can get a facility; provider duties).
2. Read the **application guidance for a loan facility** (eligibility and evidence).
- Links: [Funding rules 26/27](https://www.gov.uk/government/publications/advanced-learner-loans-funding-and-performance-management-rules/advanced-learner-loans-funding-and-performance-management-rules-2026-to-2027) · [Facility application guidance](https://www.gov.uk/government/publications/advanced-learner-loans-application-guidance-for-a-loan-facility)
- **Done when:** you can state who's eligible (19+, regulated L3–6) and what evidence is needed.

### 6. Build your "evidence pack"
1. Latest **accounts / management accounts** + a short **cash-flow forecast**.
2. Core **policies**: safeguarding, data protection (GDPR), equality & diversity, complaints, quality/delivery plan.
3. **Delivery model**: tutors + their qualifications, the venue (clinic), assessment, attendance/evidence keeping.
4. Intended **learner numbers** for L3 & L4 (this sizes the facility you request).
- Heads-up: expect an **Ofsted new-provider monitoring visit** within the first couple of years.
- **Done when:** one folder holds accounts, forecast, the five policies, the delivery plan and learner numbers.

### 7. Submit the first-time facility request (when the window opens)
1. Watch the ESFA/DfE emails for the **"first-time facility request"** window.
2. Download the **first-time facility request form** (spreadsheet) from the funding-rules page.
3. Complete it from your evidence pack; submit by the deadline.
4. Answer due-diligence questions promptly. If offered, also request a **loans bursary** allocation (hardship fund).
- **Done when:** you receive an **ESFA loans facility agreement** to sign, with an allocation value.

### 8. Register with the Student Loans Company (Learning Provider Services)
1. Once the facility is agreed, open **SLC Learning Provider Services** and follow **new providers** onboarding.
2. Set up your provider account and bank details so SLC can pay fees on the learner's behalf.
3. Give students the details to apply for their loan (course title, provider name/UKPRN, fee, dates).
- Link: [lpservices.slc.co.uk](https://www.lpservices.slc.co.uk/)
- **Done when:** a test student can select K Academy and your Level 4 course in their loan application.

### 9. Set up learner-data reporting
1. Create an account on **Submit Learner Data**.
2. Submit learner records on the published schedule (use a small MI system or bureau if needed).
- Link: [submit-learner-data.service.gov.uk](https://submit-learner-data.service.gov.uk/)
- **Done when:** you've made a first successful submission (even a test return).

---

## Part 3 — Free training for Londoners (Adult Skills Fund & Islington)

Makes training **free** for eligible Londoners (19+, unemployed or low wage) on Level 2/3. London's budget is held by the Mayor of London; new providers usually start by **subcontracting** with a college that holds the contract.

### 10. Approach a GLA-funded London college about subcontracting
1. Read the GLA **Information for Adult Skills Fund providers** page.
2. Write a one-page offer: "Ofqual-regulated Level 2/3 Skin & Laser, delivered in a working Islington clinic, into local jobs."
3. Email 2–3 large London FE colleges' **business development / subcontracting** teams.
- Links: [ASF provider info](https://www.london.gov.uk/programmes-strategies/jobs-and-skills/training-providers-teaching-skills/adult-skills-fund/information-adult-skills-fund-providers) · [ASF overview](https://www.london.gov.uk/what-we-do/business-and-economy/skills-and-training/adult-education-budget-aeb)
- **Done when:** a college agrees to explore a subcontract or gives you their next round date.

### 11. Register on the London Tenders Portal
1. Open the **London Tenders Portal** → **Suppliers Area**.
2. Register (free); set categories to education/training for alerts.
3. Also register on **Find a Tender** for national notices.
- Links: [londontenders.org](https://www.londontenders.org/) · [find-tender.service.gov.uk](https://www.find-tender.service.gov.uk/)
- **Done when:** registered and receiving training/skills tender alerts.

### 12. Contact Islington Adult Community Learning
1. Call/WhatsApp **07734 777466**, or use the contact page.
2. Ask for the **Adult Community Learning / Inclusive Economy & Jobs** team about a **partnership** for funded resident places.
3. Ask whether current **UK Shared Prosperity Fund (People & Skills)** activity can commission places on your courses.
- Links: [adultlearning.islington.gov.uk](https://adultlearning.islington.gov.uk/) · [contact](https://adultlearning.islington.gov.uk/Default.asp?page=contact) · [council adult skills](https://www.islington.gov.uk/libraries-arts-and-heritage/libraries/reading-learning-and-outreach-services/adult-skills-training)
- **Done when:** you've had a first conversation and know who owns adult-skills partnerships.

---

## Part 4 — The 2027 prize: Lifelong Learning Entitlement (Level 4–6)

### 13. Start exploring Office for Students registration
*Why: from January 2027 the LLE gives every adult a flexible loan (~£39,160) for L4–6 courses/modules. Using it requires OfS registration — the highest bar — so scope it now.*
1. Read OfS **"How to register"** (Regulatory advice 3) and the **conditions of registration**.
2. Work through the OfS **registration checklist**; assess whether you can meet ongoing conditions (quality, finances, governance).
3. Read the SLC **Lifelong Learning Entitlement** provider portal.
4. Decide whether to make Level 5–7 a **regulated qualification** (precondition for funding it).
- Links: [OfS how to apply](https://www.officeforstudents.org.uk/for-providers/registering-with-the-ofs/how-to-register/how-to-apply/) · [Conditions](https://www.officeforstudents.org.uk/for-providers/registering-with-the-ofs/registration-with-the-ofs-a-guide/conditions-of-registration/) · [LLE provider portal](https://www.lpservices.slc.co.uk/lle/lifelong-learning-entitlement/)
- **Done when:** a go/no-go decision on OfS registration and, if go, an application access key requested.

---

## Part 5 — Housekeeping (compliance)

### 14. Compliance + "go-live" settings
1. Keep every government/council route set to **"Register interest"** until that approval lands; flip to **"Available now"** by changing the route's `status` in `lib/funding.ts`.
2. Add funding-enquiry data (name, contact, employment/income band, residency) and its retention to the **privacy notice**.
3. Confirm with the finance partner who is the lender and that you're within the correct consumer-credit permissions; keep on-site finance wording fair and clear.
4. Review **Admin → K Academy → Funding** weekly; move each enquiry New → Reviewing → Referred → Approved → Funded.
- **Done when:** privacy notice updated and a named person owns the weekly review.

---

*Funding rules and thresholds change yearly — confirm current-year specifics on the linked GOV.UK / London.gov.uk / OfS pages before submitting. Background and sources: `docs/ACADEMY_FUNDING_STRATEGY.md`.*
