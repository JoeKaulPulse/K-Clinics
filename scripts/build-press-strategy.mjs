// Builds the "Press & Media Strategy" owner document (brand-styled PDF + the
// same content as Markdown for the repo). This is public relations, not pull
// requests: the pull-request and GEO plan lives in build-pr-geo-strategy.mjs.
//   node scripts/build-press-strategy.mjs
// Outputs: docs/press/KClinics-Press-and-Media-Strategy.pdf
//          docs/PRESS_STRATEGY.md
// Brand rules (docs/BRAND_GUIDELINES.md): the logo is the supplied K mark +
// CLINICS wordmark drawn from components/brand/marks.tsx, never the name
// typeset as text; Fraunces for display, Geist for body; palette only.
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs", "press", "KClinics-Press-and-Media-Strategy.pdf");
const OUT_MD = path.join(ROOT, "docs", "PRESS_STRATEGY.md");
const geist = (f) => path.join(ROOT, "node_modules", "geist", "dist", "fonts", "geist-sans", f);
const fraunces = (f) => path.join(ROOT, "assets", "fonts", f);
const DATE = "25 September 2026";
const AUTHOR = "Joe Kaul";

const C = {
  ink: "#2a2420", inkSoft: "#3d352f", espresso: "#4a3f37", porcelain: "#f6ece3",
  bone: "#efe3d7", sand: "#e3d3c4", stone: "#7d6259", stoneSoft: "#b7a294",
  gold: "#a98a6d", goldSoft: "#c2a589", goldBright: "#dcc4a8", goldDeep: "#856a4a", jade: "#2f7152", blush: "#cdb4a3", white: "#ffffff",
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT — single source for the PDF and the Markdown
// Block types: h2, h3, p, ul (string or [lead, rest]), steps, tip (+label),
// table ([headers, rows, widths]), box ({ label, paras }).
// ══════════════════════════════════════════════════════════════════════════════

const FOUNDER = "[Founder name]";

const SECTIONS = [
  // ───────────────────────────────────────────────────────────────── 01
  { title: "The two-minute read", intro: "What this plan is for, the three stories the clinic can tell, and the order to tell them in.", blocks: [
    { p: "This is a plan for earned media: coverage that journalists choose to write because the story is worth telling. It is not advertising, and it is not the pull-request plan (that is the separate PR & GEO document). The owner runs it with Joe. There is no agency and no advertising spend. The only costs are a photo session, a little postage, and an optional journalist-request subscription." },
    { h2: "Three stories, one clinic" },
    { ul: [
      ["The founder.", `${FOUNDER} arrived in the UK from Ukraine in [year] as a refugee with three children. In 2026 she opened KClinics at 4 Charterhouse Buildings on Goswell Road, on her own. That sentence is a story that local, national, women’s and Ukrainian media will take.`],
      ["The clinic that runs its own technology.", "A one-site clinic on the Islington and City border that built its own booking, client portal, AI photo consultation, shop-window skin and smile scan, and training academy, instead of renting the software every other clinic rents. Trade, business and tech press will take that."],
      ["The academy and the standards angle.", "K Academy trains practitioners inside a working clinic to Ofqual-regulated, VTCT-awarded standards, while the government is still designing a licensing scheme for the sector. News and trade press take that whenever regulation is in the headlines."],
    ] },
    { h2: "The order of work" },
    { ul: [
      ["Phase 1, local (weeks 1 to 6).", "The Clerkenwell and Islington papers, the two business improvement districts, the MP, the council, and the Ukrainian community. Cheap wins that build the cuttings file every later journalist will check."],
      ["Phase 2, London and trade (weeks 6 to 14).", "London titles, radio and television, the aesthetics and beauty trade press, and the business and tech titles. Uses the local coverage as proof."],
      ["Phase 3, national and news-led (months 4 to 9).", "National newspapers, women’s magazines, Ukrainian national media, and the hooks that already exist in the calendar: the licensing consultation, International Women’s Day, Refugee Week."],
    ] },
    { tip: `Four things only the owner can do before anything is sent: (1) approve the founder story wording in section 2 and say what stays private, (2) supply the figures marked [figure] in section 2, (3) sit for the photo session in section 9, (4) pick the first two local outlets from section 4. Everything else Joe can prepare.`, label: "Owner actions" },
    { h2: "What is different about this clinic, in one breath" },
    { p: "Most clinics rent the same booking system and marketplace listing as everyone else. KClinics built its own platform, treats Ukrainian clients in their own language, puts an AI skin and smile scan in the shop window that only ever says kind things, and trains the next generation to a regulated standard inside the clinic. And it was founded, on her own, by a woman who arrived here with three children and nothing else. Every pitch in this document is one of those facts, aimed at the outlet that cares most." },
  ] },

  // ───────────────────────────────────────────────────────────────── 02
  { title: "What we are working with", intro: "The raw material: every angle a journalist could take, the proof behind it, the figures still to gather, and the claims to avoid.", blocks: [
    { h2: "The founder story" },
    { p: `The founder story is on the record in full: her name, Ukraine, refugee, single mother of three, the year of arrival, and how she built the clinic on her own. That is the owner’s decision and this plan uses it. Two defaults still apply unless she says otherwise: the children are not named or photographed, and the account of leaving Ukraine is told once, in her words, and never embellished by us.` },
    { h3: "Angles inside the founder story" },
    { ul: [
      ["Arrival to opening.", `From arriving with three children to a licensed clinic in [N] years. Works for local, national and women’s press. The detail that carries it: what she did in between, told plainly.`],
      ["Refugee entrepreneurship.", "The Entrepreneurial Refugee Network (TERN) estimates there are about 26,500 refugee entrepreneurs in the UK contributing roughly £520m a year, and that with the right support the figure could reach £5bn. Her clinic is a live case study in a debate that business press, the Big Issue, Positive News and the Guardian already cover."],
      ["The Ukrainian community.", "The client portal and the health questionnaires are available in Ukrainian, and staff see a translation of what clients write. A Ukrainian arriving in London can be treated in their own language. Works for Ukrainian community media here and national media in Ukraine."],
      ["A woman in a scrutinised industry.", "A woman-founded, licensed clinic (High-Risk Special Treatment Licence, Level 7 injector, prescriber-led) in a sector often criticised for the opposite. Works for women’s titles and the trade press."],
    ] },
    { h2: "The technology story" },
    { p: "The agreed line is simple: the clinic built its own software rather than buying it. We do not describe how it was built, who built it, or what tools were used, and we do not talk about AI coding tools. What we show is what clients and students experience:" },
    { ul: [
      ["Get My Plan (kclinics.co.uk/ai-consultation).", "Upload a photo, the AI reads skin, smile and hair, and returns a phased, priced, bookable plan. A clinician confirms everything in clinic. Photos are encrypted and kept on the record only if the client ticks the box."],
      ["Skin & Smile on the high street.", "A shop-window screen on Goswell Road paired with the passer-by’s own phone. Scan the code, pose, and in about a minute get a skin and smile score and a share card. Observations are positive only, it is for over-18s only, photos are purged after the session, and no photo ever appears on the share page."],
      ["Booking without the middleman.", "First-party online booking with card-on-file (nothing charged until the appointment), reminders, reschedule links, waitlist claims, membership points, gift cards and live chat. No Treatwell or Fresha commission."],
      ["A portal in Ukrainian.", "Clients can read their portal and questionnaires in Ukrainian; the clinical team sees a translation."],
      ["Clinical records encrypted.", "Clinical notes and photos are encrypted field by field, and staff sign in with passkeys."],
      ["K Academy online.", "Theory online, practical days in the clinic, an exam bank, certificates and VTCT registration handled in one system."],
    ] },
    { h3: "Platform facts we can cite (June 2026 inventory)" },
    { table: [["Fact", "Figure", "How to phrase it"], [
      ["Application code", "About 110,000 lines", "“The clinic runs on its own platform of more than 100,000 lines of code.”"],
      ["Data model", "128 models", "Rarely needed; use only with tech titles."],
      ["Programming interfaces", "225 routes", "Same: tech titles only."],
      ["Customer-facing surfaces", "Nine", "“Nine services in one system: website, booking, client portal, clinic records, academy, kiosk, shop, staff tools and in-clinic screens.”"],
      ["Integrations", "More than 25", "“Payments, calendars, messaging and accounting all connected.”"],
      ["Indicative rebuild cost", "£1.5m to £2.4m", "“Independently estimated at £1.5m to £2.4m to rebuild.” Always say estimated; it is a June 2026 valuation of the code, not the business."],
    ], [22, 18, 60]] },
    { h2: "The academy and standards story" },
    { ul: [
      ["Regulation is live news.", "The Health and Care Act 2022 gave the government power to license non-surgical cosmetic procedures in England. In August 2025 it confirmed a red, amber, green model based on risk; a further consultation on the detail is expected during 2026 and no scheme is in force yet. Every time this is in the news, a clinic that already holds a licence and trains to Ofqual-regulated standards has a comment worth printing."],
      ["Training inside a working clinic.", "Small cohorts, practical days on the equipment used on clients, the VTCT exam administered in-house. The external quality assurance (EQA) visit in October is a milestone worth a trade release if it goes well."],
      ["Honesty about funding.", "The academy says plainly that government funding is not available and is not expected before 2028. That candour is quotable in a sector known for overpromising."],
    ] },
    { h2: "Figures to gather" },
    { p: "Each figure below is written as a placeholder in the pitches. The owner supplies them before anything is sent; a pitch with one real number beats a pitch with three adjectives." },
    { table: [["Placeholder", "Where it is used", "Who supplies it"], [
      ["[X clients]", "Founder release, local and national pitches", "Owner, from Admin → Reports"],
      ["[Y months]", "Everywhere the clinic’s age is mentioned", "Owner"],
      ["[N students]", "Academy pitches and the trade release", "Owner, from Admin → Academy"],
      ["[first cohort]", "Academy pitches", "Owner"],
      ["[year]", "Year she arrived in the UK", "Owner"],
      ["[N staff]", "Fact sheet", "Owner"],
      ["[background]", "One line on her work before the clinic", "Owner"],
      ["[qualifications]", "Founder biography", "Owner"],
    ], [22, 46, 32]] },
    { h2: "What we do not say" },
    { ul: [
      ["No prescription-only medicine brand names.", "Not in releases, not in quotes to the public. Say “anti-wrinkle injections” or “injectables”. It is the advertising rule, and keeping to it in press quotes avoids a complaint."],
      ["No “safe”, “painless”, “guaranteed” or “permanent”.", "Results vary. Say so when asked."],
      ["The AI gives cosmetic guidance, not a diagnosis.", "A clinician confirms every plan. Every mention of the AI carries this sentence."],
      ["Dentistry is “opening soon”, nothing more,", "until a GDC-registered dentist is in post."],
      ["No government funding claims for the academy.", "The sentence is: not available through K Academy at present, and not expected before 2028."],
      ["No client photos or stories without written consent.", "Kiosk photos are never used, by design."],
      ["Nothing about how the software was built or who built it.", "If asked: “We built it ourselves, around how a client actually wants to be treated.” Then move on."],
    ] },
  ] },

  // ───────────────────────────────────────────────────────────────── 03
  { title: "What we say", intro: "The words, agreed once and reused everywhere, and the answers to the questions she will be asked.", blocks: [
    { h2: "The positioning line" },
    { box: { label: "One sentence", lead: true, paras: [`KClinics is a licensed aesthetics clinic in Clerkenwell, founded by a Ukrainian refugee and single mother of three, that built its own technology rather than renting it, and trains practitioners to regulated standards inside the clinic.`] } },
    { h2: "Three proof pillars" },
    { table: [["Pillar", "Proof", "Line to use"], [
      ["People", "Level 7 injector; prescriber-led; High-Risk Special Treatment Licence; the founder’s own story", "“Standards first. I know what it is to have nothing to fall back on.”"],
      ["Technology", "Get My Plan; the shop-window scan; own booking and portal; Ukrainian-language portal; encrypted records", "“We built it ourselves so it works the way a client would want it to.”"],
      ["Teaching", "Ofqual-regulated, VTCT-awarded and CPD-accredited courses, Levels 2 to 7; practical days in a live clinic; honest funding advice", "“Train to the standard you’d want to be treated by.”"],
    ], [16, 44, 40]] },
    { h2: "Boilerplate (the paragraph that ends every release)" },
    { box: { label: "About KClinics", paras: [`KClinics is an aesthetics and laser clinic at 4 Charterhouse Buildings, Goswell Road, London EC1M 7AN. Founded in 2026 by ${FOUNDER}, it offers more than 40 treatments for face, body and skin from a Level 7-qualified, prescriber-led team under a High-Risk Special Treatment Licence. The clinic runs its own booking, client portal and AI consultation platform, and its training arm, K Academy, offers Ofqual-regulated and VTCT-awarded aesthetics qualifications taught inside the clinic. Aesthetic dentistry opens soon. kclinics.co.uk · 020 8050 0750 · support@kclinics.co.uk`] } },
    { h2: "Founder biography (short)" },
    { box: { label: "Short biography", paras: [`${FOUNDER} founded KClinics in Clerkenwell, London. She arrived in the UK from Ukraine in [year] as a refugee with three children, [background], and opened the clinic in 2026. She holds [qualifications]. The clinic built its own booking, consultation and training technology under her, and opened K Academy, its Ofqual-regulated training centre.`] } },
    { h2: "Key messages by audience" },
    { table: [["Audience", "What they want", "Our line"], [
      ["Local readers", "A neighbour’s story; something new on Goswell Road", "The shop window that reads your skin; the refugee who opened a clinic on her own."],
      ["Trade (aesthetics, beauty)", "Standards, business model, technology", "A one-site clinic that owns its software and trains to regulated standards."],
      ["Business and tech", "Founder journey, build versus buy, numbers", "Built rather than bought; independently valued; no marketplace commission."],
      ["Women’s titles", "A woman’s story, told warmly, with practical detail", "Three children, a new country, a business built from nothing."],
      ["Ukrainian media", "One of ours, succeeding, and helping Ukrainians here", "A London clinic where Ukrainians are treated in their own language."],
      ["National news", "A peg (regulation, Refugee Week, an anniversary) plus a human story", "Comment on licensing from a clinic that is already licensed and already training to regulated standards."],
    ], [20, 36, 44]] },
    { h2: "Ten questions she will be asked, and the honest answers" },
    { steps: [
      "Why aesthetics? Her answer, in her own words. Prepare it once and keep it under 30 seconds.",
      "How did you fund it? Her answer. No figures unless she chooses to give them.",
      "Is the AI diagnosing people? No. It gives cosmetic guidance, a clinician confirms every plan in clinic, photos are encrypted, and they are kept only if the client chooses.",
      "Is the shop-window scan safe for children? It is for over-18s only. There is a tap declaration on the phone and an automated age check that declines and deletes the photos if it is not sure.",
      "Isn’t this industry unregulated? Partly, and we support licensing. We already hold the London special treatment licence, our injector is Level 7 and prescriber-led, and we train to Ofqual-regulated standards.",
      "Do you train anyone who pays? Her answer, covering entry requirements, cohort size, assessment, internal quality assurance and the external EQA visit.",
      "Can students get government funding? Not at present, and not expected before 2028. Monthly finance and employer funding are available today.",
      "Why not use Treatwell or Fresha? We wanted booking, reminders, payments and records to work as one system, in the clinic’s own hands, without marketplace commission.",
      "What about your children? Whatever she wants to say. The default: “They are the reason. That is all I will say about them.”",
      "Dentistry? Opening once a GDC-registered dentist is in post. Anyone can register interest on the website.",
    ] },
  ] },

  // ───────────────────────────────────────────────────────────────── 04
  { title: "Phase 1: Local", intro: "Weeks 1 to 6. Start where the clinic is. Local coverage is easier to win, builds the cuttings file that London and national journalists check, and reaches the people who can walk in.", blocks: [
    { h2: "Outlets and why they would care" },
    { table: [["Outlet", "What it is", "Angle to pitch", "How to reach"], [
      ["Islington Tribune", "Independent weekly, print and web; the paper the borough reads. Sister title of the Camden New Journal.", "The founder story; the shop window on Goswell Road", "News desk 020 7419 9000; contact page on islingtontribune.co.uk; active on X and Bluesky"],
      ["Islington Gazette", "Newsquest weekly, mostly online now", "The founder story; “new on Goswell Road”", "Newsdesk 020 7832 2323; “send your news” on islingtongazette.co.uk/contact"],
      ["EC1 Echo", "Clerkenwell’s not-for-profit community paper (Social Spider). Web only since its final print issue in August/September 2026.", "A local entrepreneur profile; Ukrainians in EC1", "ec1echo.co.uk; they invite local stories"],
      ["Camden New Journal", "Sister paper to the Tribune, same news desk", "Same release as the Tribune", "Pitch once; ask for both titles"],
      ["City Matters", "The City of London’s newspaper; the clinic sits on the City boundary", "Lunchtime treatments for City workers; the scan on the City edge", "citymatters.london contact page"],
      ["Hackney Citizen / Hackney Gazette", "Neighbouring borough, ten minutes away", "Founder story; the academy for Hackney trainees", "Contact pages on each site"],
      ["Islington Now", "City St George’s journalism school site; students need stories", "Long-form founder profile", "Newsroom email on the site"],
    ], [17, 30, 26, 27]] },
    { h2: "Local institutions that open doors" },
    { ul: [
      ["Islington Council.", "Email BusinessSupport@islington.gov.uk with the release; ask for a “new business in the borough” mention on the council’s channels and a place in any business newsletter."],
      ["The MP.", "Goswell Road EC1M sits in Bunhill ward, in the Islington South and Finsbury constituency; the MP is Emily Thornberry. Write to the constituency office and invite her to visit the clinic and the academy. A visit is a photograph and a story in itself, and MPs post them."],
      ["The two business improvement districts.", "Central District Alliance covers Clerkenwell and Farringdon (re-elected in 2025 for five more years). Angel Islington BID (angel.london) covers the Angel town centre. Both run newsletters, events and member profiles and want new-business stories."],
      ["Small business networks.", "The Federation of Small Businesses (London region) and Enterprise Nation both publish member stories, run events, and Enterprise Nation runs sessions specifically for refugee entrepreneurs."],
      ["The Ukrainian community.", "The Association of Ukrainians in Great Britain (AUGB, Holland Park, with branches across London), the Ukrainian Welcome Centre (near Bond Street) and the Ukrainian Institute London. Offer a free skin-health talk, a community discount, or a funded place on a course. Their newsletters and social groups reach exactly the people the Ukrainian-language portal was built for."],
      ["TERN, The Entrepreneurial Refugee Network.", "Apply as a founder in their network. TERN puts founders in front of press, corporate partners such as Square and Oliver Wyman, and its own channels, and it is quoted whenever refugee entrepreneurship is in the news."],
    ] },
    { h2: "Local events to create" },
    { ul: [
      ["A switch-on morning for the shop-window Skin & Smile screen.", "Invite the local papers, both BIDs, the Bunhill ward councillors and the MP. Ten passers-by trying it is the photograph."],
      ["An open evening for K Academy.", "Local practitioners, the Islington Tribune and the trade press, timed before or just after the October EQA visit."],
      ["A Ukrainian community evening.", "A skin-health talk in Ukrainian at the clinic, with AUGB and the Welcome Centre invited to bring members."],
      ["Professional Beauty London, ExCeL, 4 to 5 October 2026.", "Not local, but it falls in week two. Go, meet the Professional Beauty editorial team at their stand, and collect the trade journalists’ cards for phase 2."],
    ] },
    { tip: "Done when: at least two local pieces are published, one visit by the MP or a councillor is in the diary, and one Ukrainian community event has a date.", label: "Done when" },
    { h2: "Week by week" },
    { steps: [
      "Week 1: the owner approves the founder story wording (section 2) and fills in the placeholders. Joe writes the local release (section 8) and the fact sheet (section 9). Photo session in the clinic (shot list in section 9).",
      "Week 2: email the Islington Tribune and Islington Gazette news desks with the founder release and two photographs, and telephone the Tribune news desk the next morning. Email EC1 Echo, City Matters and Islington Now the same release, changing one line to match each patch.",
      "Week 3: write to the MP’s constituency office and to the council’s business team with an invitation to visit. Join both BIDs’ mailing lists and send them the release for their newsletters.",
      "Week 4: contact AUGB, the Ukrainian Welcome Centre and TERN with the community offer and the event date.",
      "Week 5: hold the shop-window switch-on morning. Send photographs the same afternoon to every outlet that did not attend.",
      "Week 6: post every cutting on the site’s journal and social channels, and add the “As seen in” line to the press page (section 9).",
    ] },
  ] },

  // ───────────────────────────────────────────────────────────────── 05
  { title: "Phase 2: London and trade", intro: "Weeks 6 to 14. With local cuttings in hand, approach the titles that cover the whole city and the trade press that shapes how the industry sees the clinic.", blocks: [
    { h2: "London titles" },
    { table: [["Outlet", "Angle", "How to reach"], [
      ["Evening Standard", "Founder story for the features desk; build-versus-buy for the business desk", "Email the news and features desks; put the founder in the subject line"],
      ["Time Out London", "“The shop window in Clerkenwell that scores your skin”", "News tips route on timeout.com; short, visual, send a video clip"],
      ["MyLondon (Reach)", "Founder story; a first-person “we tried the skin scan”", "Their story tips page; they publish fast and often"],
      ["Secret London", "The kiosk as a thing to go and try", "Editorial email via the site; video first"],
      ["Londonist", "A local-interest piece on Goswell Road", "Editorial tips email"],
      ["City AM", "Business: a clinic that built its own platform; the refugee-entrepreneur economy", "News desk; pitch on a business hook with a figure"],
      ["BBC London (TV, radio, online)", "Founder story; regulation comment", "BBC London planning desk by email, with a hook and two possible filming dates"],
      ["ITV London", "Founder story with pictures: the shop window and the academy", "Planning desk email"],
      ["LBC", "Her voice on regulation, and on refugees who build businesses", "Producers of the breakfast and mid-morning shows; offer availability on a news day"],
    ], [22, 40, 38]] },
    { h2: "Trade press" },
    { table: [["Outlet", "What it is", "Angle", "How to reach"], [
      ["Aesthetics Journal", "The leading UK medical aesthetics title; monthly print, daily web; runs the Aesthetics Awards", "Clinic profile; regulation comment; a clinic that built its own tech", "News desk via aestheticsjournal.com; enter the awards (section 7)"],
      ["Aesthetic Medicine", "Monthly trade title; runs the AM Live shows and the AM Awards", "As above, plus a training feature on K Academy", "am.editorial@thepbgroup.com (from its contact page)"],
      ["Professional Beauty", "The UK’s B2B beauty and spa title; runs PB London and the PB Awards", "A skin-clinic business story; the founder", "News desk via professionalbeauty.co.uk; meet them at PB London in October"],
      ["The Consulting Room", "Long-running aesthetics information site with a trade news section", "Clinic news; regulation comment", "News submission on the site"],
      ["Journal of Aesthetic Nursing", "Clinical-professional title; covered the licensing consultation in depth", "Standards and training", "Editor via the site"],
      ["FE News", "Further-education news site that accepts submitted articles", "K Academy: regulated training inside a working clinic", "Submit an article on fenews.co.uk"],
    ], [18, 30, 26, 26]] },
    { h2: "Business and technology titles" },
    { table: [["Outlet", "Angle", "How to reach"], [
      ["Startups Magazine", "Founder story; the refugee-entrepreneur figures", "Editorial email; founder features are regular"],
      ["TechRound", "“Founder of the Week”; their startup lists", "Submission form on techround.co.uk"],
      ["Business Matters", "Owner-manager audience; founder profile", "Editorial submission"],
      ["SME Magazine (smeweb.com)", "Ran the refugee-entrepreneur story in 2026", "Pitch as the case study for that story"],
      ["Enterprise Nation", "Member stories; refugee-entrepreneur events", "Member profile; offer to speak at a session"],
      ["Startups.co.uk", "Founder profiles and practical how-tos", "Editorial email"],
      ["Elite Business", "Founder interviews", "Editorial submission"],
    ], [24, 40, 36]] },
    { tip: "Done when: one London, one trade and one business title have published, and she has done a radio interview.", label: "Done when" },
    { h2: "Week by week" },
    { steps: [
      "Week 6: update the release with the local cuttings (“as featured in the Islington Tribune”). Cut the 30-second kiosk video (section 9).",
      "Week 6: pitch the Evening Standard and MyLondon with the founder story; Time Out and Secret London with the kiosk video.",
      "Week 7: pitch Aesthetics Journal and Aesthetic Medicine with the clinic profile, and send the standing quote (section 8) so it is on file.",
      "Week 8: pitch the business titles with the build-versus-buy story and the June figures; submit TechRound’s Founder of the Week form.",
      "Week 9 to 10: invite the BBC London and ITV London planning desks to film the shop window, offering two dates; pitch LBC’s breakfast and mid-morning producers with a topical line (regulation, or a refugee-business story in the news that week).",
      "Week 11 to 14: one follow-up to every outlet that has not replied, then stop. Post the cuttings, update the press page, and log the results in the tracker (section 10).",
    ] },
  ] },

  // ───────────────────────────────────────────────────────────────── 06
  { title: "Phase 3: National and news-led", intro: "Months 4 to 9. National coverage follows a hook. The job is to have the story ready and offer it on the days journalists are already looking for it.", blocks: [
    { h2: "The hooks calendar" },
    { table: [["When", "Hook", "What we offer"], [
      ["October 2026", "K Academy’s EQA visit", "If it goes well, a trade release: “academy passes external quality check”. Local follow-up."],
      ["Oct/Nov 2026", "Refugee Week 2027 theme announced", "Note the theme; shape the June pitch around it."],
      ["During 2026, date TBC", "Government’s further consultation on licensing non-surgical cosmetic procedures", "Founder comment within hours of the announcement, from a clinic already licensed and training to regulated standards."],
      ["24 February 2027", "Five years since the full-scale invasion", "Her story, if she wants to tell it that day. Her call, decided in January, no pressure either way."],
      ["8 March 2027", "International Women’s Day", "Women’s titles and business press: a founder profile. Pitch in early February."],
      ["14 to 20 June 2027", "Refugee Week", "The founder story for national and refugee-sector media. Pitch in April."],
      ["[date]", "Clinic first anniversary", "Figures: clients treated, students trained. A “one year on” piece for local and trade."],
      ["[date]", "First K Academy graduating cohort", "Photographs of graduates; trade and local."],
      ["[date]", "Dentistry opens (only once a dentist is in post)", "Local and trade: two disciplines under one roof."],
    ], [20, 36, 44]] },
    { h2: "National and women’s titles" },
    { table: [["Outlet", "Angle", "How to reach"], [
      ["The Times (Enterprise Network)", "Founder profile; build-versus-buy with one strong figure", "The Enterprise editor’s team takes founder pitches by email"],
      ["The Guardian", "Refugee entrepreneurship; the human story", "Features or society desks; Guardian Opinion takes first-person pieces"],
      ["The Telegraph", "A woman founder; regulation", "Business features desk"],
      ["i news / The Independent", "The refugee story with a policy angle: the March 2026 rule change made refugee status temporary and reviewable; a founder employing and training people is a live example", "News and features desks"],
      ["Daily Mail (Femail), Metro, Mirror", "Human interest: three children, a new country, a clinic", "Features desks; they respond fastest to strong photographs"],
      ["Stylist, Grazia, Red, Good Housekeeping, Woman & Home", "Inspiring-women features; beauty desks for the AI plan and the kiosk", "Features and beauty editors; pitch print three months ahead"],
      ["Glamour UK, Refinery29 UK, Cosmopolitan UK", "“I tried the AI skin plan”", "Beauty desks; offer the writer a free session"],
      ["Positive News", "Solutions journalism: a refugee founder employing and training people", "Story submission on positive.news"],
      ["The Big Issue", "Runs the annual 100 Changemakers list, with refugee-focused entries; founder profiles", "Nominate for Changemakers 2027; pitch the features desk"],
      ["BBC News online (Business)", "Founder story with figures", "Usually reached through BBC London first"],
    ], [26, 40, 34]] },
    { h2: "Ukrainian media" },
    { table: [["Outlet", "What it is", "Angle"], [
      ["BBC News Ukrainian", "The BBC’s Ukrainian-language service, based in London", "Ukrainians building in the UK; a portal in Ukrainian"],
      ["Ukrinform", "Ukraine’s national news agency; runs a diaspora news section with correspondents abroad", "A diaspora success story"],
      ["Suspilne, Ukrainska Pravda, Hromadske", "Ukrainian national media that cover the diaspora", "Feature on Ukrainians in London"],
      ["The Kyiv Independent", "English-language Ukrainian title with a large international readership", "“Ukrainians abroad” feature"],
      ["AUGB and community channels", "Newsletters, social groups, the St Mary’s Ukrainian School network", "Community offer; event invitations"],
    ], [26, 40, 34]] },
    { h2: "Podcasts and speaking" },
    { ul: [
      ["Trade podcasts.", "Aesthetics Journal and Professional Beauty both run podcasts and panels. Ask after the first trade piece is published."],
      ["Founder and refugee-sector platforms.", "TERN and Enterprise Nation events; the Business Show. Visitor this year, speaker next."],
      ["Trade shows.", "Professional Beauty London (October) and AM Live (spring). Attend first, then apply to speak on training or on running a clinic on your own technology."],
    ] },
    { tip: "Done when: one national newspaper or broadcast piece, one Ukrainian outlet, and the founder quoted at least once on licensing.", label: "Done when" },
    { h2: "Month by month" },
    { steps: [
      "Month 4: draft the national pitch (section 8) and choose the first hook. Nominate the founder for TechRound’s lists and the Big Issue Changemakers.",
      "Month 4: send the Ukrainian pitch (in Ukrainian, written by the founder) to BBC News Ukrainian and Ukrinform.",
      "Month 5 (early February): pitch International Women’s Day profiles to the women’s titles, the Times Enterprise Network and the Telegraph.",
      "Month 5: when the licensing consultation is announced, send the standing quote to the trade press, BBC London and LBC the same morning.",
      "Month 6 to 7 (April): pitch Refugee Week features to the Guardian, i news, Positive News and the Big Issue.",
      "Month 8 to 9: the anniversary release with the year’s figures; graduate photographs; a review of the tracker and a decision on what to repeat.",
    ] },
  ] },

  // ───────────────────────────────────────────────────────────────── 07
  { title: "Awards and lists", intro: "Awards give a journalist a reason to write, and a shortlist is a story in itself. Enter only where the category fits and the eligibility is met.", blocks: [
    { table: [["Award", "Why it fits", "When and where"], [
      ["Aesthetics Awards 2027 (Aesthetics Journal)", "Best New Clinic (open to clinics established after 1 January 2024) and Best Clinic London. Clinic entries need a registered Medical Director, so check eligibility first.", "Winners announced 14 March 2027, Hilton Park Lane; entry dates on aestheticsawards.com"],
      ["Aesthetic Medicine Awards", "Clinic and training categories", "Entries open annually; aestheticmed.co.uk/am-awards"],
      ["Professional Beauty Awards 2027", "Skin clinic and practitioner categories; open for entries now", "Ceremony spring 2027; professionalbeauty.co.uk"],
      ["everywoman Entrepreneur Awards", "Free to enter; categories by age and business stage; the 2026 deadline was 7 September, so aim for 2027", "Watch everywoman.com from spring 2027"],
      ["Great British Entrepreneur Awards 2027", "More than 20 categories by region; 2026 has closed, the 2027 waitlist is open", "greatbritishentrepreneurawards.com"],
      ["FSB Celebrating Small Business Awards", "Free; no membership needed; regional finals then national", "fsbawards.co.uk; check the 2027 dates"],
      ["TechRound lists", "Founder of the Week and the TechRound 100; free, fast, and a link from a trusted site", "Submission forms on techround.co.uk"],
      ["Big Issue 100 Changemakers", "Refugee- and migrant-focused entries each year", "Nominations for 2027 on bigissue.com"],
    ], [28, 40, 32]] },
    { p: "A near miss still earns a shortlist line for the press page. A poor fit wastes a week of the owner’s time. When in doubt, skip it." },
  ] },

  // ───────────────────────────────────────────────────────────────── 08
  { title: "Pitches ready to send", intro: "Templates with the placeholders marked. Change one line per outlet so each pitch reads as written for them, because it was.", blocks: [
    { h2: "The local release (founder story)" },
    { box: { label: "Press release", lead: true, paras: [
      `Ukrainian refugee who arrived with three children opens clinic on Goswell Road that runs on its own technology`,
      `Clerkenwell, London, [date]. ${FOUNDER} arrived in the UK from Ukraine in [year] with her three children and no business. In 2026 she opened KClinics at 4 Charterhouse Buildings, Goswell Road, on her own. [Y months] on, the clinic has treated more than [X clients] clients and is training its first practitioners through K Academy, its Ofqual-regulated training centre.`,
      `The clinic runs on software it built itself rather than the booking marketplaces most clinics use. Clients can upload a photograph and receive a priced, bookable treatment plan that a clinician then confirms in person, and passers-by can scan a code on the shop window to get a skin and smile score on their own phone in about a minute. The client portal is available in Ukrainian.`,
      `“I built this for the person I was when I arrived,” said ${FOUNDER}. “Someone who wanted to be treated properly, told the truth about prices and results, and spoken to in a language she understood. Everything in the clinic follows from that.”`,
      `KClinics holds a High-Risk Special Treatment Licence, its injectables are led by a Level 7-qualified practitioner with a prescriber on hand, and K Academy’s courses are Ofqual-regulated and awarded through VTCT. The academy’s first cohort of [first cohort] students began in [month].`,
      `Notes to editors: ${FOUNDER} is available for interview in English and Ukrainian. Photographs of the founder, the clinic and the shop-window screen are available on request or at kclinics.co.uk/press. Contact: [press email] · 020 8050 0750.`,
      `About KClinics: (boilerplate from section 3).`,
    ] } },
    { h2: "The email that carries it" },
    { box: { label: "Email to a local news desk", lead: true, paras: [
      `Subject: Refugee who arrived with three children opens Goswell Road clinic that built its own tech`,
      `Hello [name],`,
      `A quick one for the Tribune. ${FOUNDER} came to the UK from Ukraine in [year] as a refugee with three children. This year she opened an aesthetics clinic on Goswell Road, on her own, and it runs on software the clinic built itself, including a shop-window screen that gives passers-by a skin and smile score on their phone.`,
      `She is happy to be interviewed and photographed at the clinic any weekday. Release and two photographs attached; more on request.`,
      `Best wishes, [your name] · [phone]`,
    ] } },
    { h2: "The trade pitch" },
    { box: { label: "Email to Aesthetics Journal / Aesthetic Medicine", lead: true, paras: [
      `Subject: Single-site Islington clinic that built its own platform, and trains inside it`,
      `Hello [name],`,
      `KClinics in Clerkenwell is a one-site, licensed clinic (High-Risk Special Treatment Licence, Level 7 injector, prescriber-led) that built its own booking, client portal, AI photo consultation and academy platform rather than renting it. It runs an Ofqual-regulated, VTCT-awarded training centre inside the working clinic, with the EQA visit in October.`,
      `The founder, ${FOUNDER}, arrived in the UK from Ukraine in [year] as a refugee with three children. She can talk about running a clinic on your own technology, about training to regulated standards while the licensing scheme is still being designed, and about telling students the truth on funding.`,
      `Would a clinic profile or a comment piece on licensing suit you? Photographs and a fact sheet attached.`,
      `Best wishes, [your name] · [phone]`,
    ] } },
    { h2: "The national pitch (with a hook)" },
    { box: { label: "Email to a features desk", lead: true, paras: [
      `Subject: For Refugee Week: the Ukrainian mother of three who built a London clinic, and its software, on her own`,
      `Hello [name],`,
      `For Refugee Week (14 to 20 June) I would like to offer ${FOUNDER}. She arrived from Ukraine in [year] with three children, opened KClinics in Clerkenwell in 2026 without a partner or an investor, and has since treated [X clients] clients and taken on [N students] trainees at the regulated academy she runs inside the clinic. The clinic runs on technology it built itself, including a portal in Ukrainian and a shop-window skin scan.`,
      `TERN estimates there are 26,500 refugee entrepreneurs in the UK. She is one of them, and she is candid about what helped and what did not. She is available for interview and photographs at the clinic.`,
      `Best wishes, [your name] · [phone]`,
    ] } },
    { h2: "The standing quote on regulation" },
    { box: { label: "Ready to send the morning the consultation is announced", quote: true, paras: [
      `“We welcome the licensing scheme and we would like it sooner. Our clinic already holds the London special treatment licence, our injector is Level 7 qualified and prescriber-led, and we train the next generation to Ofqual-regulated standards inside a working clinic. Clear rules protect the public and they protect the practitioners who already do things properly. The detail matters: the scheme needs to recognise regulated qualifications, and it needs to be enforced.” ${FOUNDER}, founder, KClinics, Clerkenwell.`,
    ] } },
    { h2: "Follow-up rules" },
    { steps: [
      "Send on a Tuesday, Wednesday or Thursday between 9am and 11am. Never on a Friday afternoon.",
      "One follow-up, three working days later, two lines long. Then stop.",
      "Telephone local news desks; email everyone else.",
      "One story to one desk at a time. Never send two different pitches to the same desk in the same week.",
      "Reply to any journalist within the hour on a working day. Broadcast requests come with a same-day deadline.",
      "Log every send, reply and outcome in the tracker (section 10), so the next pitch to that desk starts with what they said last time.",
    ] },
  ] },

  // ───────────────────────────────────────────────────────────────── 09
  { title: "The press kit and the platform", intro: "What to have ready before the first email goes out, and how the clinic’s own systems support the plan.", blocks: [
    { h2: "What to prepare" },
    { ul: [
      ["A one-page fact sheet.", "Address, opening date, licence, qualifications, treatments (40+), the academy’s accreditations and levels, the technology in plain words, and the figures from section 2."],
      ["The founder biography.", "The 75-word version from section 3 and a 250-word version with the same facts and one paragraph in her own words."],
      ["The boilerplate.", "From section 3, unchanged on every release."],
      ["Ten photographs.", "Shot list below. Journalists use the story with the best picture."],
      ["A 30-second video.", "The shop-window scan from a passer-by’s point of view: scan, pose, result, share card. Vertical and horizontal cuts. No faces without consent; use staff or friends."],
      ["Screenshots.", "Get My Plan on a phone (a consenting volunteer’s plan), the booking flow, the portal in Ukrainian."],
      ["The academy prospectus.", "Courses, levels, accreditations, the funding sentence, cohort dates."],
      ["A media contact line.", "Below."],
    ] },
    { h2: "The photo session (shot list)" },
    { steps: [
      "The founder, portrait, at the shop window with the screen behind her. Landscape and portrait.",
      "The founder in a treatment room, in uniform, with equipment in shot.",
      "The Skin & Smile screen with a consenting volunteer holding up their phone and result.",
      "Get My Plan on a phone in a client’s hand, plan visible, face not.",
      "An academy practical day, with every trainee’s written consent, tutor visible.",
      "The team together at the entrance.",
      "The exterior of 4 Charterhouse Buildings from Goswell Road, daylight.",
      "Detail shots: laser handpiece, treatment couch, the reception screen.",
      "Every image at least 3,000 pixels on the long edge, colour, no text overlays, no children.",
    ] },
    { h2: "A press page on the site" },
    { p: "Add kclinics.co.uk/press: the fact sheet, the biography, the photographs at full size, every release, an “As seen in” row of publication names once there are cuttings, and the media contact. Journalists check for this page before they call, and a page that answers their questions gets the clinic used as a source again. Joe builds it; the owner supplies the photographs and approves the wording. It also carries the same facts the site already gives AI answer engines, so press mentions and search reinforce each other." },
    { h2: "The media contact" },
    { ul: [
      ["press@kclinics.co.uk,", "forwarding to the owner and to Joe, so no request waits on one person."],
      ["The clinic line, 020 8050 0750,", "with front desk told to pass press calls straight through or take a number and a deadline."],
      ["A response promise:", "same working day for print and online, within the hour for broadcast."],
    ] },
    { h2: "How the platform helps" },
    { ul: [
      ["Figures on demand.", "Admin → Reports gives clients treated, bookings and revenue by period; Admin → Academy gives enrolments and cohorts. The [figure] placeholders come from here."],
      ["Verified reviews.", "The site shows a live rating only once real reviews exist, so a journalist who checks finds the truth."],
      ["The journal.", "Every cutting becomes a short post with a link, which feeds search and AI answers as well as the press page."],
      ["A press-only offer code.", "Set one up in Admin → Offers for readers of a given piece; the redemptions show which coverage brought people through the door."],
    ] },
  ] },

  // ───────────────────────────────────────────────────────────────── 10
  { title: "Measuring it", intro: "What success looks like at each stage, and the one spreadsheet that keeps it honest.", blocks: [
    { table: [["By", "Local pieces", "London or trade", "National", "Also"], [
      ["30 days", "2", "0", "0", "MP or councillor visit arranged"],
      ["90 days", "4", "3", "0", "One radio interview; press page live"],
      ["180 days", "6", "6", "1", "One award shortlist; one Ukrainian outlet"],
      ["270 days", "8", "8", "2", "Second broadcast piece; the anniversary release out"],
    ], [14, 18, 22, 16, 30]] },
    { h2: "The tracker" },
    { ul: [
      "One spreadsheet, one row per pitch: outlet, desk, date sent, follow-up date, reply, outcome, URL, and whether the piece links to the site.",
      "Site visits from press referrers in Google Analytics, checked monthly.",
      "Redemptions of the press-only offer code, from Admin → Offers.",
      "Academy enquiries that mention an article, asked at enrolment.",
      "Once a month, ask ChatGPT, Perplexity and Gemini “best aesthetics clinic in Islington” and note whether KClinics is named; press mentions on trusted sites move these answers.",
    ] },
    { h2: "If nothing lands" },
    { p: "Change one thing at a time: the hook, then the subject line, then the outlet. Do not chase one desk more than twice. Two quiet months in a row means the story needs a new fact, not a new adjective: a milestone, a figure, an event. The calendar in section 6 exists so there is always a next hook." },
  ] },

  // ───────────────────────────────────────────────────────────────── 11
  { title: "Ground rules and risks", intro: "The things that protect the owner, the clients and the clinic while the story is out in the world.", blocks: [
    { ul: [
      ["The founder story is hers.", "She can pause it, narrow it or stop it at any time, and the plan carries on with the technology and academy stories. Nothing personal is sent without her reading it first."],
      ["The children stay out of it.", "Not named, not photographed, not aged. If a journalist asks, the answer is in section 3."],
      ["Consent for every face.", "Written consent for any client, trainee or volunteer in a photograph or video. Kiosk photos are never used; the system deletes them."],
      ["Advertising rules apply to what we say.", "No prescription-only medicine brand names, no “safe” or “guaranteed”, no medical claims for the AI, no funding claims for the academy. Section 2 has the list."],
      ["A bad-news call.", "If a journalist calls about a complaint, an incident or a regulatory question: take their name, outlet and deadline, say “I will call you back within the hour”, and call Joe. Never say “no comment”. A short written statement that states the facts and what the clinic has done is always better than silence."],
      ["Privacy law.", "Photographs and quotes from clients are personal data. Keep the consent forms with the images. Delete on request."],
      ["Broadcast preparation.", "Before the first radio slot: three messages she wants to land, one bridge phrase to return to them, answers of 20 seconds or less, and a 30-minute rehearsal with Joe asking the ten questions from section 3."],
      ["Keep it true.", "Every figure comes from the CRM or from the owner. Every claim about the technology describes something a client can use today. Coverage built on anything else does not survive a second journalist."],
    ] },
  ] },

  // ───────────────────────────────────────────────────────────────── 12
  { title: "Appendix: media list and blanks", intro: "Every outlet in one table, and the placeholders to fill in before the first pitch.", blocks: [
    { h2: "Media list at a glance" },
    { table: [["Outlet", "Tier", "Phase", "Lead angle"], [
      ["Islington Tribune", "Local", "1", "Founder; shop window"],
      ["Islington Gazette", "Local", "1", "Founder; new on Goswell Road"],
      ["EC1 Echo", "Local", "1", "Local entrepreneur; Ukrainians in EC1"],
      ["Camden New Journal", "Local", "1", "Founder (with the Tribune)"],
      ["City Matters", "Local", "1", "City workers; the scan on the City edge"],
      ["Hackney Citizen / Gazette", "Local", "1", "Founder; academy"],
      ["Islington Now", "Local", "1", "Long-form founder profile"],
      ["Islington Council channels", "Local", "1", "New business in the borough"],
      ["Central District Alliance; Angel Islington BID", "Local", "1", "Member profile; events"],
      ["AUGB; Ukrainian Welcome Centre; Ukrainian Institute London", "Community", "1", "Community offer; events"],
      ["TERN; Enterprise Nation; FSB London", "Networks", "1 to 2", "Refugee founder; member story"],
      ["Evening Standard", "London", "2", "Founder; build versus buy"],
      ["Time Out London; Secret London; Londonist", "London", "2", "The shop-window scan"],
      ["MyLondon", "London", "2", "Founder; first-person scan"],
      ["City AM", "London", "2", "Business; refugee-entrepreneur economy"],
      ["BBC London; ITV London", "Broadcast", "2", "Founder; regulation"],
      ["LBC", "Broadcast", "2", "Regulation; refugee founders"],
      ["Aesthetics Journal", "Trade", "2", "Clinic profile; regulation"],
      ["Aesthetic Medicine", "Trade", "2", "Clinic profile; academy"],
      ["Professional Beauty", "Trade", "2", "Skin clinic business; founder"],
      ["The Consulting Room; Journal of Aesthetic Nursing", "Trade", "2", "Standards; regulation"],
      ["FE News", "Trade (training)", "2", "Regulated training inside a clinic"],
      ["Startups Magazine; Startups.co.uk; Business Matters; Elite Business; SME Magazine", "Business", "2", "Founder; build versus buy"],
      ["TechRound", "Tech", "2", "Founder of the Week; lists"],
      ["The Times (Enterprise Network); The Telegraph", "National", "3", "Founder profile; women in business"],
      ["The Guardian; i news; The Independent", "National", "3", "Refugee entrepreneurship; policy"],
      ["Daily Mail (Femail); Metro; Mirror", "National", "3", "Human interest"],
      ["Stylist; Grazia; Red; Good Housekeeping; Woman & Home", "Women’s", "3", "Inspiring women; beauty"],
      ["Glamour UK; Refinery29 UK; Cosmopolitan UK", "Beauty", "3", "“I tried the AI plan”"],
      ["Positive News; The Big Issue", "Solutions", "3", "Refugee founder; Changemakers"],
      ["BBC News online", "National", "3", "Founder with figures"],
      ["BBC News Ukrainian; Ukrinform; Suspilne; Ukrainska Pravda; Hromadske; Kyiv Independent", "Ukrainian", "3", "Diaspora success; portal in Ukrainian"],
    ], [40, 14, 10, 36]] },
    { h2: "Blanks to fill before the first pitch" },
    { steps: [
      `${FOUNDER}: her name as she wants it printed, and whether she uses a surname publicly.`,
      "[year]: the year she arrived in the UK.",
      "[background]: one line on her work before the clinic.",
      "[qualifications]: what she holds, as it appears on her certificates.",
      "[X clients] and [Y months]: from Admin → Reports on the day the release goes out.",
      "[N students], [first cohort], [month]: from Admin → Academy.",
      "[N staff]: for the fact sheet.",
      "[press email]: set up press@kclinics.co.uk and confirm it forwards.",
      "[date] for the anniversary, the first graduation and, later, dentistry.",
    ] },
    { h2: "Sources checked on 25 September 2026" },
    { ul: [
      "Islington Tribune and Islington Gazette contact pages; EC1 Echo “about us” (web-only since the August/September 2026 issue).",
      "Aesthetic Medicine contact page (editorial email); Aesthetics Journal and Professional Beauty sites (PB London 4 to 5 October 2026; PB Awards 2027 open).",
      "Aesthetics Awards 2027 categories and FAQs (Best New Clinic eligibility; Medical Director requirement; ceremony 14 March 2027).",
      "House of Commons Library briefing on the regulation of non-surgical cosmetic procedures (August 2025 government response; further consultation expected 2026; no scheme in force).",
      "TERN, Square and SME Magazine on refugee entrepreneurship figures (26,500 founders; £520m; £5bn potential).",
      "Refugee Week 2027: 14 to 20 June; theme announced October/November 2026.",
      "Central District Alliance (2025 ballot) and Angel Islington BID; Islington South and Finsbury constituency and MP.",
      "everywoman Entrepreneur Awards (2026 deadline 7 September); Great British Entrepreneur Awards (2027 waitlist); FSB awards (free, open to non-members).",
      "Journalist-request services: ResponseSource (about £625 a year per category), PressPlugs (about £29 a month, monitors #journorequest). Optional; the plan works without them.",
    ] },
  ] },
];

// ══════════════════════════════════════════════════════════════════════════════
// MARKDOWN (same content)
// ══════════════════════════════════════════════════════════════════════════════
{
  const md = [];
  md.push("# KClinics — Press & Media Strategy", "", `_Owner document · ${DATE} · Prepared by ${AUTHOR} · Source: \`scripts/build-press-strategy.mjs\` (also renders \`docs/press/KClinics-Press-and-Media-Strategy.pdf\`). Public relations, not pull requests: the PR & GEO plan is \`docs/PR_STRATEGY_AND_GEO.md\`._`, "");
  for (const s of SECTIONS) {
    md.push(`## ${s.title}`, "", s.intro, "");
    for (const b of s.blocks) {
      if (b.h2) md.push(`### ${b.h2}`, "");
      else if (b.h3) md.push(`#### ${b.h3}`, "");
      else if (b.p) md.push(b.p, "");
      else if (b.ul) { for (const it of b.ul) md.push(Array.isArray(it) ? `- **${it[0]}** ${it[1]}`.trim() : `- ${it}`); md.push(""); }
      else if (b.steps) { b.steps.forEach((t, i) => md.push(`${i + 1}. ${t}`)); md.push(""); }
      else if (b.tip) md.push(`> **${b.label || "Tip"}:** ${b.tip}`, "");
      else if (b.box) { md.push(`> **${b.box.label}**`, ">"); for (const para of b.box.paras) md.push(`> ${para}`, ">"); md.push(""); }
      else if (b.table) { const [h, rows] = b.table; md.push(`| ${h.join(" | ")} |`, `| ${h.map(() => "---").join(" | ")} |`); for (const r of rows) md.push(`| ${r.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`); md.push(""); }
    }
  }
  fs.writeFileSync(OUT_MD, md.join("\n"));
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF
// ══════════════════════════════════════════════════════════════════════════════
const marks = fs.readFileSync(path.join(ROOT, "components/brand/marks.tsx"), "utf8");
const K_PATH = (marks.match(/const K_PATH =\s*'([^']+)'/) || [])[1];
const WORD_PATHS = [...marks.slice(marks.indexOf("function ClinicsWordmark")).matchAll(/d="([^"]+)"/g)].map((m) => m[1]);
if (!K_PATH || WORD_PATHS.length < 6) throw new Error("Brand marks not found in components/brand/marks.tsx");

const W = 595.28, H = 841.89, M = 56, CW = W - M * 2, TOP = 94, BOT = 70;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const doc = new PDFDocument({ size: "A4", margins: { top: TOP, bottom: BOT, left: M, right: M }, bufferPages: true, info: { Title: "KClinics — Press & Media Strategy", Author: `${AUTHOR}, KClinics` } });
const out = fs.createWriteStream(OUT);
doc.pipe(out);
doc.registerFont("disp", fraunces("Fraunces-Black.ttf"));
doc.registerFont("dispSemi", fraunces("Fraunces-SemiBold.ttf"));
doc.registerFont("dispItalic", fraunces("Fraunces-Italic.ttf"));
doc.registerFont("body", geist("Geist-Regular.ttf"));
doc.registerFont("med", geist("Geist-Medium.ttf"));
doc.registerFont("semi", geist("Geist-SemiBold.ttf"));

let pageIndex = 0, secNo = 0, currentSection = "";
const toc = [];
const bg = (c = C.porcelain) => { doc.save(); doc.rect(0, 0, W, H).fill(c); doc.restore(); };
function drawPath(d, x, y, scale, color) { doc.save(); doc.translate(x, y); doc.scale(scale); doc.path(d).fill(color); doc.restore(); }
const kmark = (x, y, hgt, color) => drawPath(K_PATH, x, y, hgt / 234, color);
function wordmark(x, y, width, color) { const s = width / 531; doc.save(); doc.translate(x, y); doc.scale(s); for (const d of WORD_PATHS) doc.path(d).fill(color); doc.restore(); }
function header() { const { x, y } = doc; doc.save(); kmark(M, 45, 15, C.gold); doc.font("body").fontSize(7.5).fillColor(C.stone).text(currentSection, M, 46, { width: CW, align: "right" }); doc.lineWidth(0.5).strokeColor(C.sand).moveTo(M, 64).lineTo(W - M, 64).stroke(); doc.restore(); doc.x = x; doc.y = y; }
// Footers and the cover's bottom line sit below the bottom margin, so the margin
// is zeroed while they are drawn; otherwise pdfkit would start a new page.
function withNoBottomMargin(fn) { const b = doc.page.margins.bottom; doc.page.margins.bottom = 0; try { fn(); } finally { doc.page.margins.bottom = b; } }
function footer(i) { withNoBottomMargin(() => { doc.save(); doc.lineWidth(0.5).strokeColor(C.sand).moveTo(M, H - 44).lineTo(W - M, H - 44).stroke(); doc.font("body").fontSize(7.5).fillColor(C.stone).text(`KClinics · Press & Media Strategy · ${DATE}`, M, H - 37, { width: CW * 0.7, lineBreak: false }); doc.font("semi").fontSize(7.5).fillColor(C.stone).text(String(i), W - M - 40, H - 37, { width: 40, align: "right", lineBreak: false }); doc.restore(); }); }
// Every page after the cover, whether added here or by pdfkit's own text flow,
// gets the background, the running header and a footer (footers are stamped at
// the end from the buffered pages).
let suppressHeader = false;
doc.on("pageAdded", () => { pageIndex++; bg(); if (!suppressHeader) header(); });
function newPage(withHeader = true) { suppressHeader = !withHeader; doc.addPage(); suppressHeader = false; doc.x = M; doc.y = TOP; }
function ensure(h) { if (doc.y + h > H - BOT) newPage(); }
function eyebrow(t, c = C.gold) { ensure(18); doc.font("semi").fontSize(8).fillColor(c).text(t.toUpperCase(), M, doc.y, { characterSpacing: 2, width: CW }); doc.moveDown(0.4); }
function h1(t) { ensure(56); doc.font("disp").fontSize(26).fillColor(C.ink).text(t, M, doc.y, { width: CW }); const y = doc.y + 4; doc.save(); doc.rect(M, y, 44, 2.5).fill(C.gold); doc.restore(); doc.y = y + 15; }
function h2(t) { ensure(48); doc.moveDown(0.5); doc.font("dispSemi").fontSize(14).fillColor(C.ink).text(t, M, doc.y, { width: CW }); doc.moveDown(0.4); }
function h3(t) { ensure(30); doc.moveDown(0.25); doc.font("semi").fontSize(8.5).fillColor(C.gold).text(t.toUpperCase(), M, doc.y, { characterSpacing: 1.2, width: CW }); doc.moveDown(0.35); }
function p(t) { doc.font("body").fontSize(9.6); ensure(Math.min(60, doc.heightOfString(t, { width: CW, lineGap: 2.8 }))); doc.fillColor(C.espresso).text(t, M, doc.y, { width: CW, lineGap: 2.8 }); doc.moveDown(0.45); }
function ul(items) {
  for (const it of items) {
    const [lead, rest] = Array.isArray(it) ? it : [null, it];
    doc.font("body").fontSize(9.6);
    const est = doc.heightOfString((lead ? lead + " " : "") + (rest || ""), { width: CW - 15, lineGap: 2.4 });
    ensure(Math.min(48, est + 4)); const x = M + 15, y = doc.y;
    doc.save(); doc.circle(M + 4.5, y + 5.2, 1.8).fill(C.gold); doc.restore();
    if (lead) { doc.font("semi").fontSize(9.6).fillColor(C.ink).text(lead + (rest ? "  " : ""), x, y, { continued: !!rest, width: CW - 15, lineGap: 2.4 }); if (rest) doc.font("body").fillColor(C.espresso).text(rest, { lineGap: 2.4 }); }
    else doc.font("body").fontSize(9.6).fillColor(C.espresso).text(rest, x, y, { width: CW - 15, lineGap: 2.4 });
    doc.moveDown(0.3);
  }
  doc.moveDown(0.15);
}
function steps(items) {
  items.forEach((s, i) => {
    const x = M + 26; doc.font("body").fontSize(9.6);
    ensure(Math.min(60, doc.heightOfString(s, { width: CW - 26, lineGap: 2.4 }) + 5));
    const y = doc.y;
    doc.save(); doc.circle(M + 9, y + 7, 8.5).fill(C.ink); doc.fillColor(C.goldBright).font("semi").fontSize(8.5).text(String(i + 1), M, y + 3.6, { width: 18, align: "center" }); doc.restore();
    doc.font("body").fontSize(9.6).fillColor(C.espresso).text(s, x, y + 0.5, { width: CW - 26, lineGap: 2.4 });
    doc.moveDown(0.4);
  });
  doc.moveDown(0.15);
}
function tip(text, label = "Tip") {
  doc.font("body").fontSize(9); const inner = CW - 26;
  const h = doc.heightOfString(text, { width: inner, lineGap: 2.5 }) + 30; ensure(h + 6);
  const y = doc.y; const warn = /important|warn|owner/i.test(label);
  doc.save(); doc.roundedRect(M, y, CW, h, 6).fill(C.bone); doc.rect(M, y, 3, h).fill(warn ? C.blush : C.gold); doc.restore();
  doc.font("semi").fontSize(7.5).fillColor(warn ? C.goldDeep : C.gold).text(label.toUpperCase(), M + 14, y + 11, { characterSpacing: 1.5 });
  doc.font("body").fontSize(9).fillColor(C.inkSoft).text(text, M + 14, y + 23, { width: inner, lineGap: 2.5 });
  doc.y = y + h + 8;
}
// A quoted block (release, email, statement). `lead` sets the first paragraph
// (headline or subject line) in the display face; `quote` sets every paragraph
// in display italic. Paragraphs are laid out one by one and the block splits
// across pages between paragraphs, so a long release never overflows.
function box(label, paras, { lead = false, quote = false } = {}) {
  const inner = CW - 28;
  const styleOf = (k) => (quote ? ["dispItalic", 10.5, C.ink] : lead && k === 0 ? ["dispSemi", 11, C.ink] : ["body", 9.2, C.inkSoft]);
  const measure = (k) => { const [f, sz] = styleOf(k); doc.font(f).fontSize(sz); return doc.heightOfString(paras[k], { width: inner, lineGap: 2.6 }); };
  let i = 0, first = true;
  while (i < paras.length) {
    const avail = H - BOT - doc.y - 12;
    let h = 26, j = i;
    while (j < paras.length) { const ph = measure(j) + (j === i ? 0 : 8); if (h + ph > avail) break; h += ph; j++; }
    // Widow rule: if exactly one paragraph would be left over, carry two.
    if (j < paras.length && paras.length - j === 1 && j - i >= 2) { j--; h -= measure(j) + 8; }
    if (j === i) {
      // Nothing fits here: start a fresh page unless we already are on one
      // (a single paragraph taller than a page is drawn regardless).
      if (doc.y > TOP + 1) { newPage(); continue; }
      h += measure(i); j = i + 1;
    }
    const y = doc.y;
    doc.save(); doc.roundedRect(M, y, CW, h + 6, 6).fill(C.bone); doc.rect(M, y, 3, h + 6).fill(C.gold); doc.restore();
    if (first) doc.font("semi").fontSize(7.5).fillColor(C.gold).text(label.toUpperCase(), M + 14, y + 10, { characterSpacing: 1.5 });
    let cy = y + 24;
    for (let k = i; k < j; k++) {
      const [f, sz, col] = styleOf(k);
      doc.font(f).fontSize(sz).fillColor(col).text(paras[k], M + 14, cy, { width: inner, lineGap: 2.6 });
      cy = doc.y + 8;
    }
    doc.y = y + h + 14;
    first = false; i = j;
    if (i < paras.length) newPage();
  }
}
function table(headers, rows, widths) {
  const tot = widths.reduce((a, b) => a + b, 0);
  const colW = (i) => (widths[i] / tot) * CW - 14;
  const rowHeights = rows.map((r) => Math.max(22, ...r.map((cell, i) => { doc.font(i === 0 ? "semi" : "body").fontSize(8.2); return doc.heightOfString(String(cell), { width: colW(i) }) + 12; })));
  const headH = 22;
  ensure(headH + 6 + (rowHeights[0] || 22));
  let y = doc.y;
  const drawHead = () => { doc.save(); doc.rect(M, y, CW, headH).fill(C.ink); doc.restore(); let cx = M; headers.forEach((hd, i) => { doc.font("semi").fontSize(7.5).fillColor(C.porcelain).text(hd.toUpperCase(), cx + 7, y + 7.5, { width: colW(i), characterSpacing: 0.6 }); cx += (widths[i] / tot) * CW; }); y += headH; };
  drawHead();
  rows.forEach((r, ri) => {
    const rh = rowHeights[ri];
    if (y + rh > H - BOT) { doc.y = y; newPage(); y = doc.y; drawHead(); }
    doc.save(); doc.rect(M, y, CW, rh).fill(ri % 2 ? C.bone : C.porcelain); doc.restore();
    let cx = M;
    r.forEach((cell, i) => { doc.font(i === 0 ? "semi" : "body").fontSize(8.2).fillColor(i === 0 ? C.ink : C.inkSoft).text(String(cell), cx + 7, y + 6, { width: colW(i) }); cx += (widths[i] / tot) * CW; });
    y += rh;
  });
  doc.y = y + 9;
}
function section(title, intro) { secNo++; currentSection = title; newPage(); toc.push({ title, page: pageIndex }); eyebrow(`${String(secNo).padStart(2, "0")}`); h1(title); if (intro) p(intro); }
// Space the block after a heading needs on this page, so a heading never sits
// alone at the foot of a page while its table, box or tip starts the next one.
function needFor(b) {
  if (!b) return 0;
  if (b.tip) { doc.font("body").fontSize(9); return doc.heightOfString(b.tip, { width: CW - 26, lineGap: 2.5 }) + 36; }
  if (b.box) { const [f, sz] = b.box.quote ? ["dispItalic", 10.5] : b.box.lead ? ["dispSemi", 11] : ["body", 9.2]; doc.font(f).fontSize(sz); return Math.min(110, doc.heightOfString(b.box.paras[0], { width: CW - 28, lineGap: 2.6 }) + 34); }
  if (b.table) return 70;
  return 40;
}
function render(blocks) { for (let bi = 0; bi < blocks.length; bi++) { const b = blocks[bi]; if (b.h2) { const need = 30 + needFor(blocks[bi + 1]); if (process.env.DEBUG_LAYOUT) console.error(`h2 "${b.h2}" page=${pageIndex} y=${doc.y.toFixed(0)} need=${need.toFixed(0)} free=${(H - BOT - doc.y).toFixed(0)}`); ensure(need); h2(b.h2); } else if (b.h3) h3(b.h3); else if (b.p) p(b.p); else if (b.ul) ul(b.ul); else if (b.steps) steps(b.steps); else if (b.tip) tip(b.tip, b.label); else if (b.box) box(b.box.label, b.box.paras, { lead: b.box.lead, quote: b.box.quote }); else if (b.table) table(b.table[0], b.table[1], b.table[2]); } }

// Cover: the supplied marks only (no strap-line under the logo), then the title.
bg(C.ink);
doc.save(); doc.rect(0, H * 0.5 - 3, W, 3).fill(C.gold); doc.restore();
kmark(M, H * 0.18, 96, C.goldSoft);
wordmark(M, H * 0.18 + 112, 190, C.porcelain);
doc.font("dispSemi").fontSize(40).fillColor(C.porcelain).text("Press &", M, H * 0.56, { width: CW });
doc.font("dispItalic").fontSize(36).fillColor(C.goldSoft).text("Media Strategy", { width: CW });
doc.font("body").fontSize(11).fillColor(C.stoneSoft).text("The stories worth telling, the outlets that will tell them, the order to approach them in, and the pitches ready to send. Earned media only: no agency, no advertising spend. Written for the owner; no PR experience assumed.", M, H * 0.72, { width: CW - 64, lineGap: 3.5 });
withNoBottomMargin(() => doc.font("semi").fontSize(8).fillColor(C.gold).text(`FOR THE OWNER · PREPARED BY ${AUTHOR.toUpperCase()} · ${DATE.toUpperCase()}`, M, H - 54, { characterSpacing: 1.5, lineBreak: false }));

// Contents
newPage(false); const TOC_PAGE = pageIndex;
doc.x = M; doc.y = TOP; eyebrow("Contents"); h1("What’s inside");
doc.font("body").fontSize(9).fillColor(C.stone).text("Section 1 is the two-minute read. Sections 2 and 3 are the raw material and the agreed words. Sections 4 to 6 are the three phases, local to national. Section 8 holds the pitches ready to send. The appendix has the full media list and the blanks to fill in.", M, doc.y, { width: CW, lineGap: 2.6 });
const TOC_START_Y = doc.y + 18;

for (const s of SECTIONS) { section(s.title, s.intro); render(s.blocks); }

doc.switchToPage(TOC_PAGE); doc.y = TOC_START_Y;
toc.forEach((e, i) => {
  const y = doc.y; const num = String(i + 1).padStart(2, "0");
  doc.font("semi").fontSize(9).fillColor(C.gold).text(num, M, y + 1, { width: 22 });
  doc.font("med").fontSize(10.5).fillColor(C.ink).text(e.title, M + 26, y, { width: CW - 76 });
  doc.font("body").fontSize(9).fillColor(C.stone).text(String(e.page), M + CW - 34, y + 1, { width: 34, align: "right" });
  const dy = y + 12; doc.save(); doc.lineWidth(0.4).strokeColor(C.stoneSoft).dash(1, { space: 3 }).moveTo(M + 26, dy).lineTo(M + CW - 40, dy).stroke().undash(); doc.restore();
  doc.y = y + 19;
});
for (let i = 1; i <= pageIndex; i++) { doc.switchToPage(i); footer(i); }
doc.end();
out.on("finish", () => console.log("✓ Wrote", OUT, "(" + (fs.statSync(OUT).size / 1024).toFixed(0) + " KB,", pageIndex + 1, "pages) and", OUT_MD));
