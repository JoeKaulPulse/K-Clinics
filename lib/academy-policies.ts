// K Academy centre policies — the learner-facing policy set an awarding
// organisation's External Quality Assurer (EQA) expects a VTCT-approved
// centre to publish. Rendered at /academy/policies and /academy/policies/<slug>,
// and listed in /llms.txt so AI answer engines cite the real wording.
//
// Editing: the owner rewrites any policy in Admin → Pages by publishing a CMS
// page at the same path (e.g. /academy/policies/appeals); a published CMS page
// replaces the code default below, exactly as /info/<slug> works. The text
// here is the version 1.0 draft prepared for the owner's review — keep the
// review dates honest when you change it.
//
// Keep this file free of server-only imports (it is read by the sitemap and
// llms.txt routes as well as the pages).

export type AcademyPolicy = {
  slug: string;
  title: string;
  /** One-sentence summary shown on the hub and used as the meta description. */
  summary: string;
  version: string;
  /** ISO date the policy text was last reviewed. */
  reviewed: string;
  /** ISO date of the next scheduled review. */
  nextReview: string;
  sections: { heading: string; body: string[] }[];
};

const CENTRE = 'K Academy, the training centre of KCLINICS SKIN & LASER LIMITED (trading as KClinics)';
const HEAD = 'the Head of Centre';

export const academyPolicies: AcademyPolicy[] = [
  {
    slug: 'malpractice-and-maladministration',
    title: 'Malpractice and Maladministration Policy',
    summary: 'How K Academy prevents, reports and investigates malpractice (including plagiarism and cheating) and maladministration by learners or staff.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'Purpose and scope', body: [
        `This policy sets out how ${CENTRE} prevents, identifies, reports and deals with malpractice and maladministration in the delivery and assessment of its regulated (VTCT, Ofqual-regulated) and CPD-accredited courses. It applies to every learner, tutor, assessor, internal quality assurer (IQA), invigilator and administrator working with the centre.`,
        'Malpractice is any deliberate act, default or practice which compromises the integrity of assessment or the validity of a certificate. Maladministration is any activity, neglect, default or practice which results in the centre not complying with the awarding organisation\'s requirements, without deliberate intent.',
      ] },
      { heading: 'Examples', body: [
        'Learner malpractice includes: plagiarism (presenting another person\'s work, including AI-generated text, as your own), collusion, copying, impersonation, bringing unauthorised material or devices into an examination, fabricating practical evidence or client records, and failing to follow invigilator instructions.',
        'Staff malpractice includes: assisting a learner beyond what the assessment allows, altering learner work or marks, falsifying records, certifying achievement that has not been evidenced, breaching exam security, and failing to declare a conflict of interest.',
        'Maladministration includes: late or inaccurate registrations, incomplete assessment records, failure to store confidential materials securely, and failure to apply reasonable adjustments that were approved.',
      ] },
      { heading: 'Prevention', body: [
        'Every learner is inducted on academic integrity and signs a declaration of authenticity with each piece of assessed work. Assessment materials are stored securely and released only for the assessment window. Assessors and IQAs are qualified and standardised, and every assessment decision is sampled under the internal quality assurance policy.',
      ] },
      { heading: 'Reporting a concern', body: [
        `Anyone who suspects malpractice or maladministration should report it in writing to ${HEAD} at the clinic address or by email to support@kclinics.co.uk, giving the names involved, the course, the date and the evidence. Concerns can be raised anonymously, but the centre may be unable to investigate fully without a contact. Reports are treated in confidence and no learner or member of staff will be disadvantaged for raising a concern in good faith.`,
      ] },
      { heading: 'Investigation', body: [
        `${HEAD} (or, where they are implicated, an independent senior person appointed by the centre) will acknowledge the report within 5 working days, secure the evidence, and carry out an investigation, normally within 20 working days. The person under investigation is told what is alleged, is invited to respond, and may be accompanied at any meeting.`,
        'Where the matter concerns a regulated qualification, the centre will notify VTCT as soon as it is aware of an incident, in line with VTCT\'s malpractice and maladministration requirements, and will cooperate with any investigation the awarding organisation conducts. The awarding organisation may impose its own sanctions, including withdrawing certificates.',
      ] },
      { heading: 'Outcomes and sanctions', body: [
        'Learner sanctions range from a written warning and re-assessment through to disqualification from the unit or qualification. Staff sanctions range from retraining and additional sampling through to removal from assessment duties and disciplinary action. The centre records every case, its outcome and the actions taken, and uses the records to improve its procedures.',
        'A learner or member of staff may appeal a malpractice decision under the Appeals Policy.',
      ] },
    ],
  },
  {
    slug: 'appeals',
    title: 'Appeals Policy',
    summary: 'How a learner can appeal an assessment decision, a reasonable-adjustment decision or a malpractice outcome, and the time limits that apply.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'What you can appeal', body: [
        `A learner of ${CENTRE} may appeal against: an assessment decision (including a practical observation, written assessment or portfolio judgement); a decision not to grant a reasonable adjustment or special consideration; a malpractice or maladministration finding; and the outcome of a complaint about assessment. Appeals are about whether the correct process was followed and applied fairly, not simply about disagreeing with a professional judgement.`,
      ] },
      { heading: 'Stage 1: informal review', body: [
        'Raise the matter with your assessor within 10 working days of receiving the decision. The assessor will explain the decision against the assessment criteria and, where appropriate, ask a second assessor to review the evidence. Most concerns are resolved here. You will receive a written response within 10 working days.',
      ] },
      { heading: 'Stage 2: formal appeal', body: [
        `If you are not satisfied, submit a written appeal to ${HEAD} within 10 working days of the Stage 1 response, stating the decision appealed, the grounds, and the evidence relied on. An internal quality assurer who was not involved in the original decision will review the assessment and the process and reply in writing within 15 working days. The outcome may confirm the decision, amend it, or order a fresh assessment by a different assessor.`,
      ] },
      { heading: 'Stage 3: awarding organisation', body: [
        'For regulated qualifications, if you remain dissatisfied after Stage 2 you may appeal to VTCT under its own appeals procedure, within the time limit VTCT sets. The centre will give you the details and will cooperate fully. VTCT\'s decision is final. For CPD-accredited short courses, Stage 2 is the final stage.',
      ] },
      { heading: 'Record keeping and fees', body: [
        'There is no charge for a Stage 1 or Stage 2 appeal. The centre keeps a log of every appeal, its outcome and any resulting change to practice, and makes the log available to the awarding organisation on request. Lodging an appeal never disadvantages a learner.',
      ] },
    ],
  },
  {
    slug: 'complaints',
    title: 'Learner Complaints Policy',
    summary: 'How K Academy learners can complain about teaching, facilities, service or conduct, and how quickly we respond.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'Scope', body: [
        `This policy covers complaints from learners, applicants and employers about any aspect of ${CENTRE}: teaching and support, facilities and equipment, administration, fees and communication, or the conduct of staff or other learners. Disagreement with an assessment decision is handled under the Appeals Policy instead. Complaints about clinic treatments are handled under the KClinics Complaints Procedure.`,
      ] },
      { heading: 'How to complain', body: [
        'Tell your tutor or the academy team as soon as possible; many issues can be put right straight away. If you prefer, or if the matter is not resolved, write to support@kclinics.co.uk or to the clinic address marked "Academy complaint", giving your name, course, what happened, when, and what outcome you are seeking.',
      ] },
      { heading: 'What we will do', body: [
        `We acknowledge every written complaint within 3 working days. ${HEAD} investigates and replies in writing within 15 working days; if more time is needed you will be told why and given a new date. Where the complaint is about ${HEAD}, a director of the company who was not involved will handle it.`,
        'If you are not satisfied with the response you may ask, within 10 working days, for a review by a director. The review reply is the centre\'s final response.',
      ] },
      { heading: 'Escalation', body: [
        'If your complaint concerns a regulated qualification and you have exhausted the centre\'s procedure, you may raise it with VTCT. If it concerns the way VTCT has handled a matter, Ofqual may be contacted. The centre will tell you how to do so.',
      ] },
      { heading: 'Learning from complaints', body: [
        'Complaints are logged, reviewed at the centre\'s quality meetings and used to improve courses and services. Making a complaint in good faith never affects a learner\'s assessment or treatment.',
      ] },
    ],
  },
  {
    slug: 'equality-diversity-and-inclusion',
    title: 'Equality, Diversity and Inclusion Policy',
    summary: 'K Academy\'s commitment to fair access, equal treatment and an inclusive learning environment for every learner and member of staff.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'Our commitment', body: [
        `${CENTRE} is committed to promoting equality of opportunity, valuing diversity and eliminating unlawful discrimination, harassment and victimisation, in line with the Equality Act 2010. No applicant, learner or member of staff will be treated less favourably because of age, disability, gender reassignment, marriage or civil partnership, pregnancy or maternity, race, religion or belief, sex or sexual orientation.`,
      ] },
      { heading: 'In practice', body: [
        'Recruitment and admission decisions are based on the published entry requirements for each course. Course materials and case studies reflect a diverse client base and avoid stereotypes. Practical training covers the safe treatment of all skin types and tones. Reasonable adjustments to learning and assessment are provided under the Reasonable Adjustments and Special Consideration Policy. Learners and staff are expected to treat each other, clients and models with dignity and respect.',
      ] },
      { heading: 'Raising a concern', body: [
        'Any learner who experiences or witnesses discrimination, bullying or harassment should tell a tutor or write to support@kclinics.co.uk. Concerns are investigated under the Learner Complaints Policy; behaviour that breaches this policy is dealt with under the Learner Conduct, Attendance and Withdrawal Policy or, for staff, the company\'s disciplinary procedure.',
      ] },
      { heading: 'Monitoring', body: [
        `${HEAD} reviews applications, achievement and withdrawal data annually to check that no group is disadvantaged, and reports the findings and any actions at the centre's quality review.`,
      ] },
    ],
  },
  {
    slug: 'safeguarding-and-prevent',
    title: 'Safeguarding and Prevent Policy',
    summary: 'How K Academy keeps learners, models and clients safe, recognises and reports safeguarding concerns, and meets the Prevent duty.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'Scope', body: [
        `${CENTRE} trains adults (18+). Safeguarding still applies: some learners, models and clients may be adults at risk, and training takes place in a clinical setting where learners treat real people. This policy covers the protection of learners, models and clients from abuse, neglect, exploitation and radicalisation.`,
      ] },
      { heading: 'Designated Safeguarding Lead', body: [
        `${HEAD} is the Designated Safeguarding Lead (DSL). The DSL's contact details are given at induction and displayed in the academy. The DSL has completed safeguarding and Prevent awareness training and refreshes it at least every two years.`,
      ] },
      { heading: 'Recognising and reporting concerns', body: [
        'All staff receive safeguarding awareness at induction. Anyone who is worried about a learner, model or client, or who receives a disclosure, must not investigate themselves; they record what was said in the person\'s own words, with the date and time, and report it to the DSL the same day. Where someone is in immediate danger, call 999 first.',
        'The DSL decides whether to refer to the local authority adult safeguarding team, the police, or another agency, and records the concern, the decision and the reasons. Information is shared only with those who need it to keep the person safe.',
      ] },
      { heading: 'Prevent duty', body: [
        'The centre has due regard to the need to prevent people being drawn into terrorism. Staff are alert to changes in behaviour or expressed views that may indicate vulnerability to radicalisation and report concerns to the DSL, who may consult the local Prevent lead or refer through Channel. External speakers and materials are checked before use.',
      ] },
      { heading: 'Safe practice in training', body: [
        'Models and clients treated by learners give informed consent, are supervised by a qualified tutor at all times, and can stop a treatment at any point. Learners are DBS-checked where a course or placement requires it. Photographs and clinical records of models are handled under the KClinics Privacy Policy.',
      ] },
    ],
  },
  {
    slug: 'reasonable-adjustments-and-special-consideration',
    title: 'Reasonable Adjustments and Special Consideration Policy',
    summary: 'How learners with a disability, learning difficulty or temporary circumstance can get adjustments to learning and assessment without compromising standards.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'Principles', body: [
        `${CENTRE} makes reasonable adjustments so that a learner with a disability, learning difficulty, or long-term medical condition is not disadvantaged in learning or assessment, provided the adjustment does not affect the validity or reliability of the assessment or give the learner an unfair advantage. Adjustments change how a learner is assessed, not what is assessed.`,
      ] },
      { heading: 'Reasonable adjustments', body: [
        'Examples include: extra time; a reader, scribe or practical assistant; modified or enlarged papers; assistive software; rest breaks; a separate room; and alternative evidence formats such as recorded oral responses. Tell us your needs on your application or at induction so adjustments are in place before your first assessment. We may ask for supporting evidence such as a medical letter or an educational psychologist\'s report.',
        'For regulated qualifications, adjustments are applied in line with VTCT\'s reasonable adjustments and special consideration policy; some adjustments must be approved by VTCT in advance, and the centre will make that application on your behalf.',
      ] },
      { heading: 'Special consideration', body: [
        'Special consideration is a post-assessment adjustment for a learner who was affected at the time of assessment by a temporary illness, injury, bereavement or other circumstance outside their control. Apply in writing within 5 working days of the assessment, with evidence. The outcome may be an adjusted mark, a re-sit without penalty, or an extension of the assessment window, depending on the awarding organisation\'s rules.',
      ] },
      { heading: 'Decisions and appeals', body: [
        `${HEAD} decides applications within 10 working days and records every request, decision and reason. A learner may appeal a decision under the Appeals Policy.`,
      ] },
    ],
  },
  {
    slug: 'assessment-and-internal-quality-assurance',
    title: 'Assessment and Internal Quality Assurance Policy',
    summary: 'How K Academy plans, conducts, records and quality-assures assessment so every result is valid, reliable, fair and meets awarding-organisation standards.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'Assessment principles', body: [
        `Assessment at ${CENTRE} is valid (it measures the stated learning outcomes), reliable (different assessors would reach the same decision), fair (every learner has the same opportunity), and authentic (the work is the learner's own). Learners are told at induction how, when and by whom they will be assessed, and receive the assessment criteria in advance.`,
      ] },
      { heading: 'Who assesses', body: [
        'Assessors hold the occupational competence and assessor qualification (or are working towards it under a qualified assessor\'s countersignature) required by VTCT for the qualification. Assessors deliver written feedback on every assessment, referenced to the criteria, within 10 working days.',
      ] },
      { heading: 'Internal quality assurance', body: [
        `The centre appoints an internal quality assurer (IQA) for each qualification who is qualified and occupationally competent and who did not assess the work being sampled. The IQA maintains an annual sampling plan covering every assessor, every unit, every assessment method and every cohort, with higher sampling for new assessors and new units. The IQA observes assessors, interviews learners, checks records, holds standardisation meetings at least twice a year, and records actions and their close-out. ${HEAD} monitors the plan.`,
      ] },
      { heading: 'Records and certification', body: [
        'Assessment records, learner registrations, IQA reports and standardisation minutes are kept securely for at least three years after certification (or longer where the awarding organisation requires) and are available to the External Quality Assurer at every visit. Certificates are claimed only when the IQA has confirmed that all requirements are met.',
      ] },
      { heading: 'Feedback from external quality assurance', body: [
        'Action points from VTCT External Quality Assurance reports are entered in the centre\'s action plan with an owner and a date, and are reviewed at each quality meeting until closed.',
      ] },
    ],
  },
  {
    slug: 'health-and-safety-in-training',
    title: 'Health and Safety in Training Policy',
    summary: 'How practical training with lasers, devices and injectables is kept safe for learners, tutors, models and clients.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'Responsibility', body: [
        `KCLINICS SKIN & LASER LIMITED is responsible for the health, safety and welfare of everyone in its premises under the Health and Safety at Work etc. Act 1974. ${HEAD} is responsible for applying this policy to K Academy training. Learners share the duty to take reasonable care of themselves and others and to follow instructions.`,
      ] },
      { heading: 'Risk assessment', body: [
        'A written risk assessment is in place for every practical activity, device and treatment room, and is reviewed annually or when equipment, products or premises change. Learners are briefed on the relevant assessment before each practical day.',
      ] },
      { heading: 'Laser and light devices', body: [
        'Laser and intense pulsed light training follows the clinic\'s Local Rules under the guidance of the Laser Protection Adviser. Learners use protective eyewear, treat only inside the designated controlled area, and operate a device only under the direct supervision of a qualified tutor until signed off as competent.',
      ] },
      { heading: 'Infection control and sharps', body: [
        'Learners follow the clinic\'s infection prevention procedures: hand hygiene, personal protective equipment, single-use consumables, and disposal of sharps and clinical waste in the designated containers. Needle-stick injuries are reported immediately and recorded.',
      ] },
      { heading: 'Models and consent', body: [
        'Every model completes a medical history and consent form before treatment, is screened for contraindications by the tutor, and receives aftercare advice. Adverse events are managed by the tutor, recorded in the incident log, and reviewed at the next quality meeting.',
      ] },
      { heading: 'Accidents and first aid', body: [
        'A trained first aider is present on every practical day. All accidents and near misses are recorded in the accident book and reported under RIDDOR where required. Fire procedures and exits are explained at induction.',
      ] },
    ],
  },
  {
    slug: 'learner-conduct-attendance-and-withdrawal',
    title: 'Learner Conduct, Attendance and Withdrawal Policy',
    summary: 'What K Academy expects of learners, how attendance is managed, and what happens to fees if you withdraw or are withdrawn.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'Conduct', body: [
        `Learners at ${CENTRE} are training in a working clinic and are expected to behave as professionals: to be punctual, to treat staff, models, clients and each other with respect, to keep client information confidential, to follow health-and-safety and infection-control instructions, and to dress appropriately for practical sessions. Being under the influence of alcohol or drugs, abusive behaviour, breaches of confidentiality and malpractice are gross misconduct.`,
      ] },
      { heading: 'Attendance', body: [
        'Practical days are compulsory. Tell the academy team in advance if you cannot attend; a missed practical day can be rescheduled to the next available cohort, subject to availability. Online theory must be completed before the practical days it supports; the learning platform records your progress.',
      ] },
      { heading: 'Disciplinary process', body: [
        `Minor issues are addressed by the tutor informally. Repeated or serious issues lead to a written warning from ${HEAD}, then a final warning, then withdrawal. Gross misconduct may lead to immediate suspension pending investigation and to withdrawal. The learner is told the allegation, may respond and may be accompanied. Decisions may be appealed under the Appeals Policy.`,
      ] },
      { heading: 'Withdrawal and fees', body: [
        'A learner may withdraw at any time by writing to support@kclinics.co.uk. Enrolment fees are governed by the terms accepted at enrolment: the deposit is non-refundable once your place is confirmed; fees for practical days already delivered and awarding-organisation registration fees already paid are not refunded; the balance of any unused practical days is refunded or credited as the enrolment terms state. Learners withdrawn for gross misconduct are not refunded. Statutory cancellation rights for distance purchases are unaffected.',
      ] },
      { heading: 'Completion window', body: [
        'A qualification must normally be completed within 12 months of enrolment. Extensions are agreed in writing for good reason; learners on a regulated qualification must also complete within the awarding organisation\'s registration period.',
      ] },
    ],
  },
  {
    slug: 'conflict-of-interest',
    title: 'Conflict of Interest Policy',
    summary: 'How K Academy identifies and manages conflicts of interest so that assessment and certification are impartial.',
    version: '1.0',
    reviewed: '2026-09-25',
    nextReview: '2027-09-25',
    sections: [
      { heading: 'What a conflict is', body: [
        `A conflict of interest arises when a personal, family, financial or professional interest could improperly influence a decision made on behalf of ${CENTRE}: for example, an assessor assessing a relative, a close friend or an employee of their own business; an IQA sampling their own assessment decisions; or a member of staff enrolling on a qualification the centre delivers.`,
      ] },
      { heading: 'Declaring', body: [
        `All staff and contractors complete a conflict-of-interest declaration on appointment and update it annually or as soon as a new interest arises. Learners declare on application any relationship with centre staff. ${HEAD} keeps the register of interests.`,
      ] },
      { heading: 'Managing', body: [
        'Where a conflict exists, the conflicted person takes no part in the assessment, internal quality assurance or certification decision concerned; another qualified person is allocated. Where a member of staff is a learner, their work is assessed and quality assured by people who do not line-manage them and, for regulated qualifications, the centre notifies VTCT in line with its requirements.',
      ] },
      { heading: 'Records', body: [
        'The register of interests and the actions taken are available to the awarding organisation at every External Quality Assurance visit.',
      ] },
    ],
  },
];

export const academyPolicySlugs = academyPolicies.map((p) => p.slug);
export const getAcademyPolicy = (slug: string) => academyPolicies.find((p) => p.slug === slug);
