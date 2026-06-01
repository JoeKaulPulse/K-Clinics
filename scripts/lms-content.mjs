// K Academy — Native LMS course content
// Auto-consumed by the seed script. Field names are load-bearing.

export const lmsCourses = [
  {
    courseSlug: 'level-2-foundation-skin-laser',
    modules: [
      {
        title: 'Skin Anatomy & Physiology',
        summary: 'The structure and function of the skin and how it underpins safe aesthetic and laser practice.',
        lessons: [
          {
            title: 'Structure of the Skin: Epidermis, Dermis & Hypodermis',
            durationMin: 14,
            videoQuery: 'layers of the skin explained anatomy',
            body: `## Overview
The skin is the largest organ of the body and forms the primary interface for every aesthetic and laser treatment. A confident practitioner must understand its three principal layers because each interacts differently with light, heat and topical products.

## The Epidermis
The epidermis is the outermost, avascular layer. It is composed mainly of keratinocytes arranged in distinct strata. From deep to superficial these are the stratum basale, stratum spinosum, stratum granulosum, stratum lucidum (only on palms and soles) and stratum corneum. New cells are generated in the basale and migrate upward over roughly 28 days, flattening and filling with keratin until they desquamate. The epidermis also houses:

- Melanocytes, which produce melanin and determine pigmentation and photoprotection.
- Langerhans cells, which contribute to immune surveillance.
- Merkel cells, associated with light touch sensation.

## The Dermis
Beneath the epidermis lies the dermis, a connective tissue layer rich in collagen and elastin produced by fibroblasts. It contains blood vessels, lymphatics, nerve endings, sebaceous glands, sweat glands and hair follicles. The dermis is divided into the superficial papillary dermis and the deeper reticular dermis. Its vascular supply is clinically important because haemoglobin is a key chromophore in laser and IPL work.

## The Hypodermis
The hypodermis (subcutaneous layer) is composed largely of adipose tissue and loose connective tissue. It provides insulation, cushioning and energy storage, and anchors the skin to underlying structures.

## Why It Matters Clinically
Understanding depth is essential. Superficial treatments (such as superficial peels) target the epidermis, while many laser treatments must deliver energy to dermal structures such as follicles or vessels without causing epidermal damage. Skin thickness varies by body site and age, influencing treatment parameters and healing.`,
            keyPoints: [
              'The skin has three layers: epidermis, dermis and hypodermis.',
              'Keratinocytes turn over roughly every 28 days from basale to corneum.',
              'Melanin and haemoglobin within the skin are key laser chromophores.',
              'Treatment depth must match the target structure to remain safe.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: [
              { label: 'BAD patient information leaflets', url: 'https://www.bad.org.uk' }
            ]
          },
          {
            title: 'Functions of the Skin & Wound Healing',
            durationMin: 12,
            videoQuery: 'skin functions barrier wound healing stages',
            body: `## Functions of the Skin
The skin performs several interrelated functions that every practitioner should be able to relate to treatment outcomes:

- Protection: a physical and chemical barrier against pathogens, UV radiation and trauma.
- Thermoregulation: through sweating and the dilation or constriction of dermal blood vessels.
- Sensation: nerve endings detect touch, pressure, temperature and pain.
- Synthesis: production of vitamin D when exposed to UVB.
- Excretion and absorption: limited excretion of water and salts and absorption of certain topical agents.
- Immunity: Langerhans cells and the acid mantle defend against infection.

## The Acid Mantle and Barrier Function
A thin film of sebum and sweat maintains a slightly acidic surface pH of around 4.5 to 5.5. This acid mantle inhibits microbial growth and supports the stratum corneum barrier. Aggressive products or over-exfoliation can compromise this barrier, increasing sensitivity and the risk of adverse reactions.

## Wound Healing Phases
Because aesthetic and laser treatments create controlled injury, understanding healing is vital. Healing proceeds in overlapping phases:

- Haemostasis: immediate vasoconstriction and clot formation.
- Inflammation: redness, heat and swelling as immune cells clear debris (roughly days 1 to 4).
- Proliferation: fibroblasts lay down new collagen and new vessels form (days 4 to 21).
- Remodelling/maturation: collagen reorganises and strengthens over weeks to months.

## Factors Affecting Healing
Age, nutrition, smoking, diabetes, medication and infection all influence healing speed and quality. Recognising delayed healing helps a practitioner identify when to refer or pause treatment.`,
            keyPoints: [
              'The skin protects, regulates temperature, senses, synthesises vitamin D and supports immunity.',
              'The acid mantle (pH ~4.5-5.5) is central to barrier defence.',
              'Wound healing has four overlapping phases: haemostasis, inflammation, proliferation and remodelling.',
              'Lifestyle and health factors can significantly delay healing.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 1 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which layer of the skin is avascular (contains no blood vessels)?',
              type: 'SINGLE',
              options: ['Epidermis', 'Dermis', 'Hypodermis', 'Reticular dermis'],
              correct: [0],
              explanation: 'The epidermis has no blood supply and is nourished by diffusion from the dermis below.'
            },
            {
              prompt: 'Which cells in the epidermis produce melanin?',
              type: 'SINGLE',
              options: ['Fibroblasts', 'Melanocytes', 'Keratinocytes', 'Merkel cells'],
              correct: [1],
              explanation: 'Melanocytes in the stratum basale produce melanin, determining pigmentation and photoprotection.'
            },
            {
              prompt: 'Approximately how long does normal epidermal cell turnover take?',
              type: 'SINGLE',
              options: ['About 7 days', 'About 28 days', 'About 90 days', 'About 6 months'],
              correct: [1],
              explanation: 'Keratinocytes migrate from the stratum basale to desquamation in roughly 28 days.'
            },
            {
              prompt: 'Which of the following are functions of the skin?',
              type: 'MULTI',
              options: ['Thermoregulation', 'Vitamin D synthesis', 'Production of insulin', 'Protection against pathogens'],
              correct: [0, 1, 3],
              explanation: 'The skin regulates temperature, synthesises vitamin D and protects; insulin is produced by the pancreas.'
            },
            {
              prompt: 'The acid mantle of healthy skin is slightly acidic.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Healthy skin surface pH is around 4.5 to 5.5, which inhibits microbial growth.'
            },
            {
              prompt: 'Which phase of wound healing involves fibroblasts depositing new collagen?',
              type: 'SINGLE',
              options: ['Haemostasis', 'Inflammation', 'Proliferation', 'Remodelling'],
              correct: [2],
              explanation: 'During the proliferation phase fibroblasts produce new collagen and new vessels form.'
            },
            {
              prompt: 'Which structures are found in the dermis?',
              type: 'MULTI',
              options: ['Blood vessels', 'Hair follicles', 'Stratum corneum', 'Sebaceous glands'],
              correct: [0, 1, 3],
              explanation: 'The dermis contains vessels, follicles and glands; the stratum corneum is part of the epidermis.'
            }
          ]
        }
      },
      {
        title: 'The Hair Growth Cycle',
        summary: 'How hair grows in phases and why timing is fundamental to effective hair removal.',
        lessons: [
          {
            title: 'Anagen, Catagen & Telogen',
            durationMin: 13,
            videoQuery: 'hair growth cycle anagen catagen telogen',
            body: `## Why the Cycle Matters
Hair does not grow continuously. Each follicle cycles independently through active and resting phases, which is why light-based hair removal requires multiple sessions. Only hairs in the active growth phase contain enough melanin in the right location to absorb laser energy and damage the follicle.

## The Three Main Phases

- Anagen (growth phase): the actively growing phase. The hair is firmly anchored, rich in melanin and connected to the dermal papilla and bulge stem cells. This is the only phase in which laser or IPL can reliably disable the follicle. Anagen can last months to years depending on body site.
- Catagen (transition phase): a short phase of a few weeks where the follicle shrinks and detaches from its blood supply. Melanin production declines.
- Telogen (resting phase): the follicle is dormant and the old hair is eventually shed (sometimes separated as exogen). New anagen growth then begins.

## Implications for Treatment
Because only a proportion of follicles are in anagen at any one time (this proportion varies by body area), a single session cannot treat every follicle. A course of treatments spaced according to the regrowth pattern of the area is required to catch follicles as they re-enter anagen. The face, body and limbs all have different cycle durations and anagen percentages, which informs treatment intervals.

## The Follicle Structure
Key structures include the dermal papilla (blood supply and signalling), the bulge (containing stem cells), the bulb, and the hair shaft. Effective laser hair removal aims to deliver sufficient thermal damage to the papilla and bulge to prevent regeneration while protecting surrounding tissue.`,
            keyPoints: [
              'Hair cycles through anagen, catagen and telogen phases independently.',
              'Only anagen hairs reliably respond to laser/IPL because of melanin content and follicle attachment.',
              'A course of spaced sessions is needed to target follicles as they re-enter anagen.',
              'Anagen percentage and cycle length vary by body site.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: []
          },
          {
            title: 'Factors Affecting Hair Growth',
            durationMin: 11,
            videoQuery: 'factors affecting hair growth hormones',
            body: `## Hair Types
Hair is broadly classified as:

- Lanugo: fine hair present on the foetus.
- Vellus: fine, soft, lightly pigmented hair covering much of the body.
- Terminal: coarse, pigmented hair such as scalp, eyebrow, beard, axillary and pubic hair.

Light-based hair removal works best on terminal hairs because their higher melanin content absorbs more energy. Pale vellus hair responds poorly.

## Influences on Hair Growth
Several factors affect the amount, distribution and rate of hair growth, and a thorough consultation should explore them:

- Hormones: androgens stimulate terminal hair growth. Conditions such as polycystic ovary syndrome (PCOS) can cause excess hair (hirsutism).
- Genetics and ethnicity: influence density, colour and distribution.
- Age and life stage: puberty, pregnancy and menopause alter hair patterns.
- Medication: some drugs stimulate hair growth.
- Medical conditions: thyroid and adrenal disorders can affect growth.

## Clinical Relevance
Identifying a possible hormonal cause is important. Where excessive growth suggests an undiagnosed endocrine condition, the appropriate action is to recommend the client seeks GP advice rather than assuming treatment will resolve the underlying issue. Hormonally driven growth may also reduce the long-term effectiveness of hair removal, which must be explained during consultation to set realistic expectations.`,
            keyPoints: [
              'Terminal hairs respond best to light-based removal due to melanin content.',
              'Androgens and conditions such as PCOS drive excess hair growth.',
              'Genetics, age, medication and medical conditions all influence hair growth.',
              'Suspected endocrine causes warrant GP referral and realistic expectation-setting.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'NICE', url: 'https://www.nice.org.uk' }
            ],
            resources: [
              { label: 'NHS information on PCOS', url: 'https://www.nhs.uk' }
            ]
          }
        ],
        quiz: {
          title: 'Module 2 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'In which phase of the hair cycle is laser hair removal most effective?',
              type: 'SINGLE',
              options: ['Telogen', 'Catagen', 'Anagen', 'Exogen'],
              correct: [2],
              explanation: 'Anagen hairs are firmly anchored and melanin-rich, allowing effective energy absorption.'
            },
            {
              prompt: 'Which hair type responds best to light-based hair removal?',
              type: 'SINGLE',
              options: ['Lanugo', 'Vellus', 'Terminal', 'Grey terminal'],
              correct: [2],
              explanation: 'Coarse, pigmented terminal hair contains the melanin needed to absorb laser energy.'
            },
            {
              prompt: 'Telogen is the resting phase of the hair cycle.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Telogen is the dormant resting phase during which the old hair is shed.'
            },
            {
              prompt: 'Why is a course of multiple sessions required for hair removal?',
              type: 'SINGLE',
              options: [
                'To allow the skin to tan between sessions',
                'Because only some follicles are in anagen at any one time',
                'Because the laser weakens with use',
                'To let melanin levels increase'
              ],
              correct: [1],
              explanation: 'Only a proportion of follicles are in anagen at once, so repeat sessions catch others as they cycle.'
            },
            {
              prompt: 'Which factors can influence hair growth?',
              type: 'MULTI',
              options: ['Hormones', 'Genetics', 'Hair colour of the practitioner', 'Certain medications'],
              correct: [0, 1, 3],
              explanation: 'Hormones, genetics and medication affect growth; the practitioner is irrelevant.'
            },
            {
              prompt: 'Which structure contains the stem cells important for follicle regeneration?',
              type: 'SINGLE',
              options: ['The bulge', 'The hair shaft', 'The stratum corneum', 'The sweat duct'],
              correct: [0],
              explanation: 'The bulge region of the follicle contains stem cells involved in regeneration.'
            },
            {
              prompt: 'Excessive hair growth suggesting an endocrine disorder should prompt which action?',
              type: 'SINGLE',
              options: [
                'Immediate aggressive treatment',
                'Refusing all future contact',
                'Recommending the client seeks GP advice',
                'Doubling the energy settings'
              ],
              correct: [2],
              explanation: 'Suspected underlying conditions warrant GP referral before or alongside treatment.'
            }
          ]
        }
      },
      {
        title: 'Fitzpatrick Skin Typing',
        summary: 'Classifying skin by its response to UV exposure to guide safe parameter selection.',
        lessons: [
          {
            title: 'The Fitzpatrick Scale Explained',
            durationMin: 12,
            videoQuery: 'Fitzpatrick skin type scale explained',
            body: `## What Is the Fitzpatrick Scale?
The Fitzpatrick scale is a recognised classification system that categorises skin by its constitutive pigmentation and its response to ultraviolet (UV) exposure, specifically the tendency to burn or tan. Developed by Thomas Fitzpatrick, it is widely used in dermatology and is fundamental to safe laser and IPL practice because melanin content strongly influences how skin absorbs light energy.

## The Six Types

- Type I: pale white skin, often with red or blonde hair and freckles. Always burns, never tans.
- Type II: fair skin. Burns easily, tans minimally.
- Type III: medium white to light brown skin. Sometimes burns, tans gradually.
- Type IV: olive or moderate brown skin. Rarely burns, tans easily.
- Type V: brown skin. Very rarely burns, tans darkly.
- Type VI: deeply pigmented dark brown to black skin. Never burns.

## Why It Guides Treatment
Higher melanin (types IV to VI) competes with the intended target chromophore and absorbs more laser energy in the epidermis, raising the risk of burns, blistering and post-inflammatory hyperpigmentation. Such skin generally requires longer wavelengths (for example Nd:YAG for hair removal), lower fluences, longer pulse durations and robust cooling. Lighter types tolerate a broader range of devices.

## Limitations
The scale is a guide, not an absolute rule. Recent sun exposure, tanning and individual variation mean a careful visual assessment plus patch testing must always accompany classification. Practitioners should record the assessed Fitzpatrick type in the client record as part of the risk assessment.`,
            keyPoints: [
              'The Fitzpatrick scale classifies skin I to VI by burning and tanning response to UV.',
              'Higher melanin types absorb more epidermal energy and carry greater burn and pigmentation risk.',
              'Darker skin types often require longer wavelengths, lower fluence and strong cooling.',
              'Classification supplements but never replaces visual assessment and patch testing.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'Skin Cancer Foundation', url: 'https://www.skincancer.org' }
            ],
            resources: []
          },
          {
            title: 'Applying Skin Typing to Risk Assessment',
            durationMin: 10,
            videoQuery: 'skin typing laser risk assessment',
            body: `## From Classification to Decision
Knowing a client's Fitzpatrick type is only useful when it informs decisions. During consultation, the practitioner combines the type with the treatment goal, the device available and the client's history to decide whether to proceed, modify parameters, patch test only, or decline.

## Practical Application

- Hair removal: a type II client with dark hair is an ideal candidate because of high target contrast. A type V client requires a long-wavelength device and conservative settings.
- Pigmentation and rejuvenation: darker types are more prone to post-inflammatory hyperpigmentation, so aggressive settings are avoided and pre/post care emphasised.
- Recent tanning: a tanned type III effectively behaves like a higher type for treatment risk and treatment should usually be postponed.

## Recognising When Not to Treat
Some device and skin-type combinations carry unacceptable risk. If a manufacturer states a device is unsuitable for a given Fitzpatrick type, the practitioner must follow that guidance. Treating outside manufacturer indications increases the risk of harm and undermines insurance and professional standing.

## Documentation
Every record should capture the assessed type, the rationale for the chosen parameters, the patch test outcome and the discussion of risks. This protects both client and practitioner and demonstrates professional, evidence-based practice.`,
            keyPoints: [
              'Skin type must be combined with treatment goal, device and history to guide decisions.',
              'Tanned skin behaves like a higher Fitzpatrick type and usually defers treatment.',
              'Follow manufacturer guidance on suitable skin types for each device.',
              'Record the type, rationale, patch test and risk discussion every time.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 3 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'The Fitzpatrick scale classifies skin based on what?',
              type: 'SINGLE',
              options: [
                'Hair density',
                'Response to UV exposure (burning and tanning)',
                'Age of the client',
                'Body mass index'
              ],
              correct: [1],
              explanation: 'It classifies skin by its tendency to burn or tan on UV exposure.'
            },
            {
              prompt: 'How many types are there in the Fitzpatrick scale?',
              type: 'SINGLE',
              options: ['Four', 'Five', 'Six', 'Eight'],
              correct: [2],
              explanation: 'There are six Fitzpatrick types, I through VI.'
            },
            {
              prompt: 'Which Fitzpatrick type always burns and never tans?',
              type: 'SINGLE',
              options: ['Type I', 'Type III', 'Type IV', 'Type VI'],
              correct: [0],
              explanation: 'Type I skin is very pale and always burns, never tans.'
            },
            {
              prompt: 'Why do higher Fitzpatrick types carry greater laser risk?',
              type: 'SINGLE',
              options: [
                'They have thinner skin',
                'Higher epidermal melanin absorbs more energy, risking burns and pigmentation changes',
                'They have no melanin',
                'They heal faster'
              ],
              correct: [1],
              explanation: 'Greater epidermal melanin competes for energy, increasing burn and pigmentation risk.'
            },
            {
              prompt: 'Which adjustments are appropriate for darker skin types in hair removal?',
              type: 'MULTI',
              options: ['Longer wavelength devices', 'Lower fluence', 'Strong epidermal cooling', 'Maximum energy settings'],
              correct: [0, 1, 2],
              explanation: 'Longer wavelengths, lower fluence and cooling reduce epidermal damage in darker skin.'
            },
            {
              prompt: 'Recent tanning means a client can be treated at higher settings.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Tanned skin behaves like a higher type and usually means treatment is postponed.'
            },
            {
              prompt: 'Fitzpatrick classification replaces the need for a patch test.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Classification supplements but never replaces visual assessment and patch testing.'
            }
          ]
        }
      },
      {
        title: 'Introduction to Light, Laser & IPL Science',
        summary: 'The basic physics of light and how lasers and IPL differ in producing therapeutic effects.',
        lessons: [
          {
            title: 'What Is Light? Wavelength and the Electromagnetic Spectrum',
            durationMin: 13,
            videoQuery: 'electromagnetic spectrum light wavelength basics',
            body: `## Light as Energy
Light is a form of electromagnetic radiation that travels in waves and carries energy. Its wavelength, usually measured in nanometres (nm), determines its colour and how it interacts with tissue. The visible spectrum runs roughly from 400 nm (violet) to 700 nm (red), with ultraviolet below and infrared above.

## Key Properties for Aesthetics

- Wavelength: governs depth of penetration and which chromophore (target) absorbs the light. Longer wavelengths generally penetrate deeper.
- Absorption: light must be absorbed by a target to have an effect. The main skin chromophores are melanin, haemoglobin and water.
- Energy: the amount of energy delivered influences the thermal effect on the target.

## Laser Light
LASER stands for Light Amplification by Stimulated Emission of Radiation. Laser light has three defining characteristics:

- Monochromatic: a single, specific wavelength.
- Coherent: the light waves travel in phase.
- Collimated: the beam is tightly focused and does not spread significantly.

These properties allow a laser to target a specific chromophore with precision.

## IPL Light
Intense Pulsed Light (IPL) is not a laser. It emits a broad spectrum of wavelengths (polychromatic), is non-coherent and non-collimated. Filters are used to cut off shorter, unwanted wavelengths so the output suits a particular target. IPL is versatile but generally less selective than a laser, which affects how parameters are chosen and how risk is managed.`,
            keyPoints: [
              'Wavelength (in nm) determines penetration depth and which chromophore absorbs the light.',
              'Laser light is monochromatic, coherent and collimated.',
              'IPL is polychromatic, non-coherent and non-collimated, using filters to shape its output.',
              'The main skin chromophores are melanin, haemoglobin and water.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Chromophores and How Energy Becomes Heat',
            durationMin: 12,
            videoQuery: 'chromophores melanin haemoglobin laser absorption',
            body: `## Targets in the Skin
A chromophore is a substance that absorbs light. In aesthetic practice the three principal chromophores are:

- Melanin: the target in hair removal and many pigmentation treatments.
- Haemoglobin: the target in vascular treatments such as thread veins.
- Water: the target in many skin resurfacing and rejuvenation treatments.

Each chromophore absorbs different wavelengths most efficiently, which is why device selection is matched to the intended target.

## From Light to Heat
When a chromophore absorbs light, the energy is converted to heat. If enough heat is generated in the target and confined to it, the target is damaged while surrounding tissue is spared. For hair removal, heat damages the follicle; for vascular lesions, heat coagulates the vessel.

## Introducing Selective Photothermolysis
The principle that underpins safe light-based treatment is selective photothermolysis: choosing a wavelength absorbed by the target, and a pulse duration short enough that heat does not spread to surrounding tissue before the target is destroyed. This concept is explored in depth at Level 3, but a foundation practitioner should understand that selectivity is what keeps treatment both effective and safe.

## Practical Implication
Because melanin is a shared chromophore in both hair and skin, treatments must balance damaging the intended target against protecting epidermal melanin. This is why skin typing, cooling and correct parameters are so important.`,
            keyPoints: [
              'A chromophore absorbs light; the main ones are melanin, haemoglobin and water.',
              'Absorbed light energy is converted to heat that damages the target.',
              'Selective photothermolysis matches wavelength and pulse duration to the target.',
              'Shared melanin targeting is why cooling and correct parameters protect the epidermis.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'NICE', url: 'https://www.nice.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 4 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'What does the acronym LASER stand for?',
              type: 'SINGLE',
              options: [
                'Light Absorption by Skin Energy Reaction',
                'Light Amplification by Stimulated Emission of Radiation',
                'Low Amplitude Selective Energy Release',
                'Laser Application for Selective Epidermal Repair'
              ],
              correct: [1],
              explanation: 'LASER stands for Light Amplification by Stimulated Emission of Radiation.'
            },
            {
              prompt: 'Which three properties characterise laser light?',
              type: 'MULTI',
              options: ['Monochromatic', 'Coherent', 'Polychromatic', 'Collimated'],
              correct: [0, 1, 3],
              explanation: 'Laser light is monochromatic, coherent and collimated; polychromatic describes IPL.'
            },
            {
              prompt: 'IPL is a type of laser.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'IPL is not a laser; it emits a broad spectrum of non-coherent, non-collimated light.'
            },
            {
              prompt: 'Which is the main chromophore targeted in hair removal?',
              type: 'SINGLE',
              options: ['Water', 'Haemoglobin', 'Melanin', 'Collagen'],
              correct: [2],
              explanation: 'Melanin in the hair shaft and follicle absorbs the laser energy.'
            },
            {
              prompt: 'What happens when a chromophore absorbs light energy?',
              type: 'SINGLE',
              options: [
                'It reflects all the light',
                'The energy is converted to heat',
                'It becomes transparent',
                'It cools the tissue'
              ],
              correct: [1],
              explanation: 'Absorbed light energy is converted to heat that damages the target.'
            },
            {
              prompt: 'Which chromophore is typically targeted in vascular treatments?',
              type: 'SINGLE',
              options: ['Melanin', 'Haemoglobin', 'Keratin', 'Water'],
              correct: [1],
              explanation: 'Haemoglobin in blood vessels is the target for vascular lesions.'
            },
            {
              prompt: 'Longer wavelengths generally penetrate the skin more deeply.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Longer wavelengths tend to penetrate deeper into tissue.'
            }
          ]
        }
      },
      {
        title: 'Health & Safety and Infection Control',
        summary: 'Core legal duties, hygiene practice and infection prevention in a clinic setting.',
        lessons: [
          {
            title: 'Health & Safety Legislation and Risk Assessment',
            durationMin: 14,
            videoQuery: 'health and safety at work act risk assessment salon',
            body: `## Legal Framework
Aesthetic and laser premises in the UK operate within a body of health and safety law overseen by the Health and Safety Executive (HSE). Key legislation includes:

- Health and Safety at Work etc. Act 1974: the overarching duty to ensure, so far as reasonably practicable, the health, safety and welfare of employees and others affected by the work.
- Management of Health and Safety at Work Regulations 1999: requires suitable and sufficient risk assessments.
- Control of Substances Hazardous to Health (COSHH) Regulations: management of chemicals such as disinfectants.
- Reporting of Injuries, Diseases and Dangerous Occurrences Regulations (RIDDOR): reporting of certain incidents.
- Electricity at Work Regulations and PUWER for equipment safety.

## Risk Assessment
A risk assessment is a careful examination of what could cause harm so that reasonable precautions can be put in place. The basic steps are to identify hazards, decide who might be harmed and how, evaluate the risks and decide on controls, record the findings, and review regularly. For laser work this includes the specific hazards of the beam, which are addressed by a Laser Protection Adviser at higher levels.

## Practical Duties
Practitioners must use equipment safely, follow safe systems of work, report defects and incidents, and never work outside their training. Maintaining records demonstrates compliance and supports any insurance position.`,
            keyPoints: [
              'The Health and Safety at Work Act 1974 sets the overarching duty of care.',
              'The HSE enforces UK health and safety law.',
              'Risk assessment follows identify, evaluate, control, record and review.',
              'Practitioners must report defects and never work beyond their training.'
            ],
            citations: [
              { label: 'Health and Safety Executive', url: 'https://www.hse.gov.uk' },
              { label: 'GOV.UK', url: 'https://www.gov.uk' }
            ],
            resources: [
              { label: 'HSE risk assessment guidance', url: 'https://www.hse.gov.uk' }
            ]
          },
          {
            title: 'Infection Prevention and Control',
            durationMin: 12,
            videoQuery: 'infection control hand hygiene clinical setting',
            body: `## Why Infection Control Matters
Any procedure that breaches or stresses the skin barrier carries an infection risk. Effective infection prevention and control protects clients, practitioners and the wider public, and is a core expectation of professional practice and local authority licensing.

## The Chain of Infection
Infection requires a source, a means of transmission and a susceptible host. Breaking any link prevents infection. Practitioners reduce risk by controlling sources (cleaning and sterilisation), interrupting transmission (hand hygiene, PPE, single-use items) and protecting hosts (aftercare advice).

## Key Practices

- Hand hygiene: thorough handwashing and use of alcohol-based hand rub at the right moments.
- Personal protective equipment (PPE): gloves, aprons and eye protection as appropriate.
- Decontamination: cleaning, disinfection and, where required, sterilisation of instruments. Single-use items must never be reused.
- Surface and environment hygiene: cleaning between clients and managing clinical waste correctly.
- Sharps and waste: safe handling and disposal of sharps and clinical waste in line with regulations.

## Standard Precautions
Standard (universal) precautions mean treating all blood and body fluids as potentially infectious for every client, regardless of known status. This consistent approach is the foundation of safe clinic practice and should be applied at all times.`,
            keyPoints: [
              'Breaking any link in the chain of infection prevents transmission.',
              'Hand hygiene, PPE and correct decontamination are core controls.',
              'Single-use items must never be reused and sharps need safe disposal.',
              'Standard precautions treat all body fluids as potentially infectious.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'Health and Safety Executive', url: 'https://www.hse.gov.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 5 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which body enforces health and safety law in the UK?',
              type: 'SINGLE',
              options: ['NICE', 'HSE', 'CQC', 'JCCP'],
              correct: [1],
              explanation: 'The Health and Safety Executive (HSE) enforces UK health and safety law.'
            },
            {
              prompt: 'Which Act sets the overarching duty of care for health and safety at work?',
              type: 'SINGLE',
              options: [
                'Data Protection Act 2018',
                'Health and Safety at Work etc. Act 1974',
                'Consumer Rights Act 2015',
                'Equality Act 2010'
              ],
              correct: [1],
              explanation: 'The Health and Safety at Work etc. Act 1974 is the overarching statute.'
            },
            {
              prompt: 'What are the recognised steps of a risk assessment?',
              type: 'MULTI',
              options: ['Identify hazards', 'Decide on controls', 'Ignore minor risks', 'Record and review findings'],
              correct: [0, 1, 3],
              explanation: 'Risk assessment identifies hazards, decides controls and records and reviews; risks are not ignored.'
            },
            {
              prompt: 'Single-use items may be reused if disinfected thoroughly.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Single-use items must never be reused, regardless of cleaning.'
            },
            {
              prompt: 'The chain of infection requires which three elements?',
              type: 'MULTI',
              options: ['A source', 'A means of transmission', 'A susceptible host', 'A laser device'],
              correct: [0, 1, 2],
              explanation: 'Infection needs a source, a route of transmission and a susceptible host.'
            },
            {
              prompt: 'What do standard (universal) precautions assume?',
              type: 'SINGLE',
              options: [
                'Only known infectious clients pose a risk',
                'All blood and body fluids are potentially infectious',
                'PPE is optional for low-risk clients',
                'Hand hygiene is only needed after procedures'
              ],
              correct: [1],
              explanation: 'Standard precautions treat all blood and body fluids as potentially infectious.'
            },
            {
              prompt: 'COSHH regulations relate to the control of which hazard?',
              type: 'SINGLE',
              options: [
                'Substances hazardous to health',
                'Electrical wiring only',
                'Fire exits',
                'Working at height'
              ],
              correct: [0],
              explanation: 'COSHH covers the control of substances hazardous to health, such as disinfectants.'
            }
          ]
        }
      },
      {
        title: 'Consultation, Client Care & Contraindications',
        summary: 'Conducting effective consultations, obtaining consent and identifying contraindications.',
        lessons: [
          {
            title: 'The Consultation and Informed Consent',
            durationMin: 13,
            videoQuery: 'aesthetic consultation informed consent process',
            body: `## Purpose of the Consultation
The consultation is the foundation of safe, client-centred practice. It allows the practitioner to assess suitability, identify contraindications, set realistic expectations, agree a treatment plan and obtain informed consent. A rushed or incomplete consultation is a common root cause of complaints and adverse events.

## Gathering Information
A structured consultation covers:

- Medical history, medication and allergies.
- Skin type, condition and treatment goals.
- Previous treatments and their outcomes.
- Lifestyle factors such as sun exposure and tanning.
- Expectations and suitability for the proposed treatment.

## Informed Consent
Informed consent means the client understands the nature of the treatment, its benefits, risks, likely outcomes, alternatives and aftercare, and agrees voluntarily without pressure. Consent must be obtained before treatment, recorded, and revisited if circumstances change. The client must have capacity to consent, and additional safeguards apply to those under 18.

## Communication and Record Keeping
Clear, jargon-free communication builds trust and helps the client make an informed choice. Accurate, contemporaneous records of the consultation, consent, parameters used and advice given are essential for continuity of care, professional accountability and insurance. Records must be stored securely in line with data protection requirements.`,
            keyPoints: [
              'The consultation assesses suitability, sets expectations and secures consent.',
              'A structured history covers medical, skin, lifestyle and expectation factors.',
              'Informed consent requires understanding of risks, benefits, alternatives and aftercare.',
              'Accurate, secure record keeping supports care, accountability and insurance.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: [
              { label: 'JCCP standards and guidance', url: 'https://www.jccp.org.uk' }
            ]
          },
          {
            title: 'Contraindications and When to Refer',
            durationMin: 12,
            videoQuery: 'laser treatment contraindications client safety',
            body: `## What Is a Contraindication?
A contraindication is a factor that makes a treatment unsafe or inadvisable. Identifying contraindications during consultation protects the client and is a professional and legal responsibility. Contraindications are commonly grouped as those that prevent treatment entirely and those that require modification, caution or referral.

## Contraindications That Prevent Treatment
Examples relevant to light-based work include active skin infection or open lesions in the area, certain photosensitising medication, recent sun exposure or tanning, very recent active tan, and some medical conditions. Pregnancy is widely treated as a contraindication for many elective treatments as a precaution.

## Contraindications Requiring Caution or Referral
Some factors do not automatically prevent treatment but require modification, GP advice or specialist referral. Examples include certain medications, a history of keloid scarring, vitiligo, epilepsy (light triggers), recent cosmetic procedures in the area, and tattoos or moles within the treatment field.

## The Importance of Referral
Practitioners must work within their scope. If there is any doubt about a skin lesion, an undiagnosed condition or suitability, the correct course is to decline or postpone and recommend the client seeks medical advice. Crucially, any suspicious or changing mole should be referred to a GP rather than treated, as it may require dermatological assessment. Recognising limits is a mark of professionalism, not weakness.`,
            keyPoints: [
              'A contraindication makes treatment unsafe or inadvisable.',
              'Some contraindications prevent treatment; others require caution or referral.',
              'Active infection, photosensitising medication and recent tanning are common barriers.',
              'Suspicious moles or undiagnosed lesions must be referred, not treated.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 6 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'What is the primary purpose of the consultation?',
              type: 'SINGLE',
              options: [
                'To upsell additional products',
                'To assess suitability, set expectations and obtain informed consent',
                'To complete the treatment as fast as possible',
                'To avoid record keeping'
              ],
              correct: [1],
              explanation: 'The consultation assesses suitability, manages expectations and secures informed consent.'
            },
            {
              prompt: 'Which elements must informed consent include?',
              type: 'MULTI',
              options: ['Benefits and risks', 'Likely outcomes and alternatives', 'Aftercare advice', 'A guarantee of perfect results'],
              correct: [0, 1, 2],
              explanation: 'Consent covers benefits, risks, outcomes, alternatives and aftercare; results cannot be guaranteed.'
            },
            {
              prompt: 'A contraindication is a factor that makes a treatment unsafe or inadvisable.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'That is the definition of a contraindication.'
            },
            {
              prompt: 'A client presents with a changing, irregular mole in the treatment area. What is the correct action?',
              type: 'SINGLE',
              options: [
                'Treat over the mole carefully',
                'Refer the client to a GP for assessment',
                'Ignore it and proceed',
                'Remove it with the laser'
              ],
              correct: [1],
              explanation: 'Suspicious or changing moles must be referred for medical assessment, not treated.'
            },
            {
              prompt: 'Which of the following commonly prevent light-based treatment?',
              type: 'MULTI',
              options: ['Active skin infection in the area', 'Recent sun exposure or tanning', 'Wearing earrings', 'Photosensitising medication'],
              correct: [0, 1, 3],
              explanation: 'Active infection, recent tanning and photosensitising medication are genuine barriers; jewellery is not.'
            },
            {
              prompt: 'Records of consultation and consent can be discarded immediately after treatment.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Records must be retained securely for continuity of care, accountability and insurance.'
            },
            {
              prompt: 'Working within your scope of practice means you should:',
              type: 'SINGLE',
              options: [
                'Attempt any treatment a client requests',
                'Decline or refer when a case is beyond your training',
                'Never refer clients',
                'Avoid documenting decisions'
              ],
              correct: [1],
              explanation: 'Recognising limits and referring appropriately is a core professional responsibility.'
            }
          ]
        }
      }
    ]
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Laser & IPL Physics',
        summary: 'The physical parameters that govern light-based treatment outcomes and safety.',
        lessons: [
          {
            title: 'Wavelength, Fluence and Pulse Duration',
            durationMin: 16,
            videoQuery: 'laser parameters wavelength fluence pulse duration',
            body: `## The Core Parameters
Effective and safe laser practice depends on understanding and manipulating three principal parameters, each with a measurable unit.

## Wavelength
Wavelength, measured in nanometres (nm), determines which chromophore absorbs the light and how deeply the light penetrates. Common aesthetic wavelengths include 755 nm (Alexandrite), 810 nm (diode), 1064 nm (Nd:YAG) and 532 nm (KTP). Longer wavelengths such as 1064 nm penetrate deeper and are relatively safer in darker skin because they are less absorbed by epidermal melanin.

## Fluence
Fluence is the energy delivered per unit area, measured in joules per square centimetre (J/cm2). It governs how much thermal energy reaches the target. Higher fluence increases effect but also raises the risk of adverse events. Fluence is balanced against skin type, target and cooling.

## Pulse Duration
Pulse duration (or pulse width) is the length of time the energy is delivered, measured in milliseconds (ms). It is matched to the thermal relaxation time of the target so that heat is confined to the target and does not spread to surrounding tissue. Larger targets need longer pulses; smaller targets need shorter pulses.

## Spot Size and Repetition Rate
Spot size influences depth and efficiency because larger spots scatter less at depth. Repetition rate affects treatment speed and heat accumulation. All parameters interact, so adjusting one often requires reconsidering the others. Mastery lies in selecting a combination that delivers effective energy to the target while keeping the surrounding tissue and epidermis safe.`,
            keyPoints: [
              'Wavelength (nm) sets target chromophore and penetration depth.',
              'Fluence (J/cm2) is energy per unit area and drives effect and risk.',
              'Pulse duration (ms) is matched to the target thermal relaxation time.',
              'Longer wavelengths penetrate deeper and are safer in darker skin.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'NICE', url: 'https://www.nice.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Selective Photothermolysis',
            durationMin: 15,
            videoQuery: 'selective photothermolysis explained',
            body: `## The Founding Principle
Selective photothermolysis, described by Anderson and Parrish in 1983, is the principle that allows a laser to destroy a specific target while sparing surrounding tissue. It rests on choosing the right wavelength, pulse duration and fluence so that energy is selectively absorbed by and confined to the intended target.

## Thermal Relaxation Time
Thermal relaxation time (TRT) is the time a target takes to lose roughly half of its heat to its surroundings. To confine damage to the target, the pulse duration should be equal to or shorter than the target's TRT. If the pulse is too long, heat diffuses outward and damages adjacent tissue; if appropriately matched, heat stays within the target.

## Applying the Principle

- Choose a wavelength well absorbed by the target chromophore and poorly absorbed by surrounding structures.
- Set a pulse duration at or below the target's TRT.
- Deliver enough fluence to reach the damage threshold without exceeding the safety margin for the epidermis.
- Cool the epidermis to protect it where melanin is a competing absorber.

## Extended Theory of Selective Photothermolysis
For larger structures such as hair follicles, the chromophore (melanin in the shaft) is not the same as the ultimate target (the follicle stem cells). Heat must conduct from the absorbing chromophore to the target, so a longer pulse aligned to the larger structure is used. Understanding this extended theory explains why hair removal uses longer pulses than, for example, tattoo removal.`,
            keyPoints: [
              'Selective photothermolysis confines damage to a chosen target.',
              'Pulse duration should be at or below the target thermal relaxation time.',
              'Correct wavelength, pulse and fluence plus cooling protect surrounding tissue.',
              'Extended theory explains heat conduction from chromophore to a larger target.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 1 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'In which unit is fluence measured?',
              type: 'SINGLE',
              options: ['Nanometres (nm)', 'Joules per square centimetre (J/cm2)', 'Milliseconds (ms)', 'Watts (W)'],
              correct: [1],
              explanation: 'Fluence is energy per unit area, measured in J/cm2.'
            },
            {
              prompt: 'Which wavelength is generally safest for darker skin in hair removal?',
              type: 'SINGLE',
              options: ['532 nm (KTP)', '755 nm (Alexandrite)', '1064 nm (Nd:YAG)', '400 nm'],
              correct: [2],
              explanation: '1064 nm Nd:YAG penetrates deeply and is least absorbed by epidermal melanin.'
            },
            {
              prompt: 'Pulse duration should be matched to which property of the target?',
              type: 'SINGLE',
              options: ['Its colour', 'Its thermal relaxation time', 'Its depth only', 'Its water content only'],
              correct: [1],
              explanation: 'Pulse duration is matched to the target thermal relaxation time to confine heat.'
            },
            {
              prompt: 'Selective photothermolysis depends on which factors?',
              type: 'MULTI',
              options: ['Appropriate wavelength', 'Appropriate pulse duration', 'Random energy settings', 'Sufficient fluence'],
              correct: [0, 1, 3],
              explanation: 'It relies on matched wavelength, pulse duration and adequate fluence, not random settings.'
            },
            {
              prompt: 'If the pulse duration is much longer than the target TRT, heat will spread to surrounding tissue.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Pulses longer than TRT allow heat to diffuse and damage adjacent tissue.'
            },
            {
              prompt: 'What does wavelength primarily determine?',
              type: 'SINGLE',
              options: [
                'Treatment cost',
                'Which chromophore absorbs and how deep light penetrates',
                'The size of the room',
                'The client appointment length'
              ],
              correct: [1],
              explanation: 'Wavelength determines target absorption and penetration depth.'
            },
            {
              prompt: 'Higher fluence always improves safety.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Higher fluence increases effect but also increases the risk of adverse events.'
            }
          ]
        }
      },
      {
        title: 'Laser-Tissue Interaction & Chromophores',
        summary: 'How light interacts with tissue and how chromophores shape treatment selection.',
        lessons: [
          {
            title: 'Optical Properties: Absorption, Scattering, Reflection and Transmission',
            durationMin: 14,
            videoQuery: 'laser tissue interaction absorption scattering',
            body: `## Four Possible Interactions
When light meets the skin it can be absorbed, scattered, reflected or transmitted. Only absorbed light produces a therapeutic effect; the other interactions reduce the energy reaching the target or send it elsewhere.

- Absorption: energy is taken up by a chromophore and converted to heat. This is the useful interaction.
- Scattering: light is deflected by tissue structures, broadening the beam and reducing depth efficiency. Scattering is greater at shorter wavelengths.
- Reflection: some light bounces off the skin surface and is lost; surface reflection is one reason eye protection is essential.
- Transmission: light passes through tissue without being absorbed.

## Penetration Depth
Depth of penetration depends on wavelength and on the optical properties of the tissue. Shorter wavelengths are absorbed and scattered more superficially, while longer wavelengths reach deeper structures. This relationship is why device choice is matched to the depth of the intended target.

## Cooling and Epidermal Protection
Because melanin in the epidermis competes for energy, epidermal cooling is used to protect the surface. Cooling methods include contact cooling (a chilled sapphire or tip), cryogen spray and forced cold air. Cooling allows higher fluence to reach deeper targets while reducing the risk of surface burns, blistering and pigmentary change.

## Clinical Synthesis
Understanding these interactions lets a practitioner predict how a given wavelength will behave in a given skin type and choose parameters and cooling accordingly. It also explains why darker or tanned skin needs particular caution: more competing absorption at the surface.`,
            keyPoints: [
              'Only absorbed light produces a therapeutic effect.',
              'Scattering and surface reflection reduce energy reaching the target.',
              'Longer wavelengths penetrate deeper; shorter ones stay superficial.',
              'Epidermal cooling protects the surface and allows effective deeper treatment.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Matching Chromophores to Treatments',
            durationMin: 12,
            videoQuery: 'chromophores wavelength selection aesthetic laser',
            body: `## The Three Principal Chromophores
Treatment selection begins with identifying the target chromophore and choosing a wavelength it absorbs well.

- Melanin: absorbs strongly across visible and near-infrared wavelengths, peaking at shorter wavelengths. Targeted in hair removal and epidermal pigmentation.
- Oxyhaemoglobin: absorbs around 418, 542 and 577 nm. Targeted in vascular lesions such as thread veins and rosacea.
- Water: absorbs strongly in the far-infrared (for example 2940 nm Er:YAG and 10600 nm CO2). Targeted in ablative resurfacing.

## Competing Absorption
The challenge is that chromophores overlap. Melanin absorbs across a broad range, so any treatment risks affecting epidermal melanin as well as the intended target. This is the central reason for skin typing, cooling and careful fluence selection.

## Worked Examples

- Hair removal in fair skin with dark hair: high melanin contrast allows a range of wavelengths and robust results.
- Thread veins: a wavelength absorbed by haemoglobin (such as 532 or 1064 nm) coagulates the vessel.
- Deep pigment or darker skin: longer wavelengths reduce unwanted epidermal melanin absorption.

## Putting It Together
A competent practitioner reasons from target to chromophore to wavelength to parameters and cooling, always cross-checking against the client's skin type and history. This structured reasoning is the foundation of treatment planning at Level 3.`,
            keyPoints: [
              'Melanin, haemoglobin and water are the three principal chromophores.',
              'Each has characteristic absorption peaks guiding wavelength choice.',
              'Melanin overlap with the target drives the need for skin typing and cooling.',
              'Reason from target to chromophore to wavelength to parameters.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'NICE', url: 'https://www.nice.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 2 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which interaction of light with tissue produces the therapeutic effect?',
              type: 'SINGLE',
              options: ['Reflection', 'Scattering', 'Absorption', 'Transmission'],
              correct: [2],
              explanation: 'Only absorbed light is converted to heat and produces an effect.'
            },
            {
              prompt: 'Which interactions reduce the energy reaching the intended target?',
              type: 'MULTI',
              options: ['Scattering', 'Reflection', 'Absorption by the target', 'Transmission'],
              correct: [0, 1, 3],
              explanation: 'Scattering, reflection and transmission all reduce energy reaching the target.'
            },
            {
              prompt: 'Which chromophore is targeted in ablative skin resurfacing?',
              type: 'SINGLE',
              options: ['Melanin', 'Haemoglobin', 'Water', 'Keratin'],
              correct: [2],
              explanation: 'Water is the chromophore for far-infrared ablative devices such as Er:YAG and CO2.'
            },
            {
              prompt: 'Shorter wavelengths penetrate more deeply than longer wavelengths.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Shorter wavelengths are absorbed and scattered more superficially; longer ones go deeper.'
            },
            {
              prompt: 'Why is epidermal cooling used during laser treatment?',
              type: 'SINGLE',
              options: [
                'To make the client more comfortable only',
                'To protect the epidermis and allow effective deeper treatment',
                'To increase scattering',
                'To darken the skin'
              ],
              correct: [1],
              explanation: 'Cooling protects the surface from competing melanin absorption and permits higher useful fluence.'
            },
            {
              prompt: 'Oxyhaemoglobin is the main target for vascular lesions.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Haemoglobin is the chromophore targeted in vascular treatments.'
            },
            {
              prompt: 'Why does melanin complicate parameter selection?',
              type: 'SINGLE',
              options: [
                'It absorbs over a broad range and competes with the intended target',
                'It does not absorb light at all',
                'It only exists in hair',
                'It reflects all wavelengths'
              ],
              correct: [0],
              explanation: 'Melanin absorbs broadly, so epidermal melanin competes with the intended target.'
            }
          ]
        }
      },
      {
        title: 'Laser Hair Removal in Practice',
        summary: 'Translating theory into safe, effective hair removal treatments and endpoints.',
        lessons: [
          {
            title: 'Candidate Selection and Treatment Technique',
            durationMin: 15,
            videoQuery: 'laser hair removal technique demonstration',
            body: `## Selecting the Right Candidate
The ideal hair removal candidate has a high contrast between dark, coarse terminal hair and lighter skin, although modern long-wavelength devices have widened the range of treatable skin types. During consultation the practitioner assesses Fitzpatrick type, hair colour and coarseness, the treatment area, hormonal factors and expectations. White, grey and very fine pale hairs lack the melanin to respond and this must be explained honestly.

## Preparing the Area
The hair should be shaved (not waxed, plucked or epilated) before treatment so that the follicle root remains, as the root is the target. The skin must be clean, dry and free of products. The treatment area and parameters are recorded.

## Technique

- Apply appropriate eye protection to client and practitioner for the specific wavelength.
- Use cooling as indicated by the device.
- Deliver overlapping or methodically adjacent pulses to ensure full coverage without skipping or excessive stacking.
- Observe the skin response continuously.

## Treatment Endpoints
The desired clinical endpoint is perifollicular oedema and erythema, sometimes described as a follicular response. Signs of excessive reaction such as greying, blistering, immediate whitening of the skin or significant pain indicate the settings are too aggressive and treatment should stop. Reading the endpoint correctly is a core practical skill and is more reliable than fixed settings alone.`,
            keyPoints: [
              'High contrast between dark hair and lighter skin makes the best candidate.',
              'Shave the area before treatment so the follicle root remains as the target.',
              'Use wavelength-specific eye protection and cooling throughout.',
              'Perifollicular oedema and erythema is the desired endpoint; blistering means stop.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: []
          },
          {
            title: 'Treatment Courses and Managing Expectations',
            durationMin: 11,
            videoQuery: 'laser hair removal number of sessions results',
            body: `## Why Courses Are Needed
Because only anagen follicles respond, a course of treatments is required to progressively reduce hair as follicles cycle into the growth phase. A typical course is several sessions spaced according to the body area, often four to six weeks apart on the face and six to eight or more on the body. The exact regimen depends on the area and individual response.

## Realistic Outcomes
Modern terminology favours "hair reduction" rather than "permanent removal," because results vary and some maintenance may be needed. Clients should understand that:

- Results depend on hair colour, skin type and hormonal influences.
- Hormonal areas may respond less completely and may need maintenance sessions.
- White, grey and fine pale hairs will not respond.

## Between-Session Care
Clients should avoid sun exposure and tanning before and after treatment, avoid plucking or waxing between sessions (shaving is fine), and follow aftercare advice. Sun protection is essential to reduce the risk of pigmentary change.

## Documenting Progress
Recording parameters, endpoints and the client's response at each visit allows the practitioner to titrate settings safely over the course and demonstrate professional, individualised care. Honest expectation management at the outset is one of the most effective ways to ensure client satisfaction and reduce complaints.`,
            keyPoints: [
              'A course of several spaced sessions is needed because only anagen hairs respond.',
              'Use the term hair reduction; results vary and maintenance may be needed.',
              'Hormonal areas and pale or grey hair respond less or not at all.',
              'Sun avoidance and accurate session records support safe, satisfactory outcomes.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 3 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'How should hair be prepared immediately before laser hair removal?',
              type: 'SINGLE',
              options: ['Waxed', 'Plucked', 'Shaved', 'Left long'],
              correct: [2],
              explanation: 'Shaving leaves the follicle root, which is the target, intact.'
            },
            {
              prompt: 'What is the desired clinical endpoint of laser hair removal?',
              type: 'SINGLE',
              options: [
                'Immediate blistering',
                'Perifollicular oedema and erythema',
                'Skin whitening',
                'No visible response'
              ],
              correct: [1],
              explanation: 'Perifollicular oedema and erythema indicates an effective follicular response.'
            },
            {
              prompt: 'Which hairs will not respond well to laser hair removal?',
              type: 'MULTI',
              options: ['White hairs', 'Grey hairs', 'Dark coarse hairs', 'Fine pale hairs'],
              correct: [0, 1, 3],
              explanation: 'White, grey and fine pale hairs lack melanin; dark coarse hair responds best.'
            },
            {
              prompt: 'Why is a course of treatments required rather than a single session?',
              type: 'SINGLE',
              options: [
                'The laser needs to warm up over sessions',
                'Only follicles in anagen respond, so repeat sessions catch others as they cycle',
                'To allow the client to tan',
                'To increase melanin'
              ],
              correct: [1],
              explanation: 'Only anagen follicles respond, so spaced sessions target others as they re-enter growth.'
            },
            {
              prompt: 'Clients may safely wax between laser sessions.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Waxing removes the target root; only shaving is appropriate between sessions.'
            },
            {
              prompt: 'Why is the term "hair reduction" preferred over "permanent removal"?',
              type: 'SINGLE',
              options: [
                'Because lasers never work',
                'Because results vary and some maintenance may be needed',
                'Because it is a legal trademark',
                'Because hair always grows back fully'
              ],
              correct: [1],
              explanation: 'Results vary by individual and some maintenance may be required, so reduction is more accurate.'
            },
            {
              prompt: 'Signs that settings are too aggressive include blistering and immediate skin whitening.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Blistering, greying and whitening indicate excessive reaction; treatment should stop.'
            }
          ]
        }
      },
      {
        title: 'Skin Rejuvenation, Pigmentation & Vascular Treatments',
        summary: 'Applying light-based therapies to ageing, pigmented and vascular concerns.',
        lessons: [
          {
            title: 'Photorejuvenation and Pigmentation',
            durationMin: 14,
            videoQuery: 'IPL photorejuvenation pigmentation treatment',
            body: `## Photorejuvenation
Photorejuvenation uses IPL or laser to improve the appearance of sun damage, fine lines, uneven tone and superficial pigmentation, and to stimulate dermal collagen. IPL is commonly used because its broad spectrum can target both pigment and superficial vessels in a single treatment, improving overall skin tone over a course of sessions.

## Treating Pigmentation
Benign epidermal pigmentation such as freckles and some sun spots (solar lentigines) can respond well to light-based treatment. The energy is absorbed by melanin, which heats and disrupts the pigment; the treated area often darkens transiently before flaking away. Important safety points:

- Only treat benign, clearly diagnosed pigmentation. Any lesion that is suspicious, changing or undiagnosed must be referred to a GP or dermatologist, never treated.
- Darker and tanned skin types carry a higher risk of post-inflammatory hyperpigmentation, so conservative settings and strict sun avoidance are essential.
- Dermal pigment and conditions such as melasma are complex and can worsen with inappropriate treatment.

## Realistic Outcomes and Care
Clients should understand that a course is usually needed and that strict sun protection is part of the treatment. Photographs at consultation help track progress and manage expectations. As always, careful patch testing and skin typing precede treatment, and the practitioner reasons from chromophore to wavelength to parameters with the client's skin type firmly in mind.`,
            keyPoints: [
              'Photorejuvenation improves tone, superficial pigment, vessels and stimulates collagen.',
              'Only treat benign, clearly diagnosed pigmentation; refer anything suspicious.',
              'Darker and tanned skin risk post-inflammatory hyperpigmentation.',
              'Melasma and dermal pigment can worsen with inappropriate treatment.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'Skin Cancer Foundation', url: 'https://www.skincancer.org' }
            ],
            resources: []
          },
          {
            title: 'Vascular Lesions',
            durationMin: 12,
            videoQuery: 'laser treatment thread veins vascular lesions',
            body: `## Common Vascular Targets
Light-based treatment can address a range of benign vascular concerns, including facial thread veins (telangiectasia), the diffuse redness of rosacea, cherry angiomas and some leg veins. The chromophore is haemoglobin, and wavelengths absorbed by haemoglobin (such as 532 nm KTP and 1064 nm Nd:YAG) are selected according to vessel size and depth.

## Mechanism
Energy absorbed by haemoglobin heats the blood and vessel wall, causing coagulation and eventual clearance of the vessel by the body. Smaller, superficial vessels often respond to shorter wavelengths, while larger or deeper vessels require longer wavelengths that penetrate further.

## Endpoints and Safety

- The desired endpoint is often a transient vessel disappearance or slight darkening; immediate greying, blistering or skin whitening indicates excessive energy.
- Cooling protects the epidermis, particularly important given competing melanin.
- Leg veins are more complex; larger varicose veins are a medical matter and should be referred rather than treated cosmetically.

## Referral and Caution
Any lesion that is not a clearly benign cosmetic vascular concern, or that suggests underlying venous disease, should be referred for medical assessment. As with all treatments, thorough consultation, patch testing, accurate parameter selection and clear aftercare underpin safe practice.`,
            keyPoints: [
              'Haemoglobin is the chromophore for vascular lesions such as thread veins and rosacea.',
              'Wavelength is chosen by vessel size and depth (e.g. 532 nm vs 1064 nm).',
              'Cooling protects the epidermis from competing melanin absorption.',
              'Larger varicose or underlying venous disease should be referred, not treated cosmetically.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 4 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which chromophore is targeted in vascular lesion treatment?',
              type: 'SINGLE',
              options: ['Melanin', 'Water', 'Haemoglobin', 'Collagen'],
              correct: [2],
              explanation: 'Haemoglobin in the blood and vessel wall is the target chromophore.'
            },
            {
              prompt: 'Which pigmented lesions are appropriate for light-based treatment?',
              type: 'SINGLE',
              options: [
                'Any mole the client dislikes',
                'Only benign, clearly diagnosed pigmentation',
                'Suspicious changing lesions',
                'Undiagnosed dark patches'
              ],
              correct: [1],
              explanation: 'Only benign, clearly diagnosed pigmentation should be treated; the rest are referred.'
            },
            {
              prompt: 'Why are darker and tanned skin types at higher risk during pigmentation treatment?',
              type: 'SINGLE',
              options: [
                'They have no melanin',
                'Increased risk of post-inflammatory hyperpigmentation',
                'They cannot be patch tested',
                'They heal too quickly'
              ],
              correct: [1],
              explanation: 'Higher epidermal melanin raises the risk of post-inflammatory hyperpigmentation.'
            },
            {
              prompt: 'Melasma always improves with aggressive IPL treatment.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Melasma is complex and can worsen with inappropriate or aggressive treatment.'
            },
            {
              prompt: 'Which wavelengths are commonly used for vascular lesions?',
              type: 'MULTI',
              options: ['532 nm (KTP)', '1064 nm (Nd:YAG)', '10600 nm (CO2)', 'A haemoglobin-absorbed wavelength'],
              correct: [0, 1, 3],
              explanation: '532 and 1064 nm are absorbed by haemoglobin; CO2 targets water for ablation.'
            },
            {
              prompt: 'Large varicose leg veins are best treated cosmetically with IPL in a salon.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Larger varicose veins are a medical matter and should be referred.'
            },
            {
              prompt: 'What is a benefit of IPL in photorejuvenation?',
              type: 'SINGLE',
              options: [
                'It targets only one chromophore',
                'Its broad spectrum can address pigment and superficial vessels together',
                'It requires no skin typing',
                'It works on all pigment including melasma aggressively'
              ],
              correct: [1],
              explanation: 'IPL broad spectrum can address both pigment and superficial vessels in one course.'
            }
          ]
        }
      },
      {
        title: 'Laser Safety: Controlled Area, PPE & the LPA',
        summary: 'Establishing a safe laser environment and the roles that keep clients and staff protected.',
        lessons: [
          {
            title: 'The Laser Controlled Area and Hazards',
            durationMin: 14,
            videoQuery: 'laser controlled area safety signage',
            body: `## Beam and Non-Beam Hazards
Lasers and IPL present hazards that must be controlled. Beam hazards include eye injury (the principal risk) and skin burns. Non-beam hazards include electrical hazards, fire risk (especially near oxygen or alcohol), and the laser plume produced when tissue is vaporised, which can carry particulate and should be extracted.

## The Laser Controlled Area (LCA)
A Laser Controlled Area is a defined space within which laser use is managed to protect everyone present. Practical controls include:

- Warning signage and an illuminated warning sign at the entrance during use.
- A door that can be controlled to prevent unexpected entry.
- Windows covered or screened so the beam cannot escape.
- Removal of reflective surfaces and unnecessary items from the beam path.
- Restricting access to trained, authorised personnel only.

## Eye Protection
Everyone within the controlled area, including the client and practitioner, must wear eye protection rated for the specific wavelength in use. Protective eyewear is wavelength specific; using the wrong eyewear offers no protection. The client's eyes are protected with appropriate goggles or eye shields.

## Local Rules
Documented local rules describe how the laser is operated safely in that setting, including the controlled area, authorised users, and emergency procedures. These rules, developed with the Laser Protection Adviser, form the practical safety framework that staff follow every day.`,
            keyPoints: [
              'The principal beam hazard is eye injury; skin burns and plume are also risks.',
              'A Laser Controlled Area uses signage, access control and screened windows.',
              'Eye protection is wavelength specific and mandatory for everyone present.',
              'Documented local rules define safe operation and authorised users.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'Health and Safety Executive', url: 'https://www.hse.gov.uk' }
            ],
            resources: [
              { label: 'HSE radiation safety guidance', url: 'https://www.hse.gov.uk' }
            ]
          },
          {
            title: 'The Laser Protection Adviser and Safety Roles',
            durationMin: 12,
            videoQuery: 'laser protection adviser LPA role',
            body: `## Key Safety Roles
Safe laser practice relies on clearly defined roles. The two commonly referenced are the Laser Protection Adviser (LPA) and the Laser Protection Supervisor (LPS).

## The Laser Protection Adviser (LPA)
The LPA is a suitably qualified expert, typically external, who advises on the safe use of lasers and IPL. The LPA helps the business assess risk, establish the controlled area, draft local rules, advise on protective equipment and engineering controls, and support compliance. Engaging an LPA is widely regarded as good practice and is often required for registration and insurance, and the LPA provides independent expert assurance that the setup is safe.

## The Laser Protection Supervisor (LPS)
The LPS is usually an on-site member of staff responsible for the day-to-day implementation of the local rules. The LPS ensures safety procedures are followed, eyewear is used, the controlled area is maintained and incidents are reported.

## Regulation and Registration
Requirements vary across the UK nations. In England, laser and IPL hair removal is not currently regulated by the Care Quality Commission for cosmetic use, but many local authorities operate special treatment licensing, and other nations have their own arrangements. Practitioners must check the requirements that apply to their location.

## A Culture of Safety
Roles and paperwork only work within a genuine safety culture: ongoing training, maintained equipment, honest incident reporting and a willingness to stop when something is not right. This culture, supported by the LPA and LPS, protects clients and the business alike.`,
            keyPoints: [
              'The LPA is an expert adviser on safe laser and IPL use, often required for insurance.',
              'The LPS implements the local rules on site day to day.',
              'Local authority special treatment licensing may apply; requirements vary by UK nation.',
              'Paperwork only works within a genuine, ongoing safety culture.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'GOV.UK', url: 'https://www.gov.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 5 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'What is the principal beam hazard of laser use?',
              type: 'SINGLE',
              options: ['Hearing damage', 'Eye injury', 'Dehydration', 'Magnetic interference'],
              correct: [1],
              explanation: 'Eye injury is the principal beam hazard, which is why eyewear is essential.'
            },
            {
              prompt: 'Which controls help establish a Laser Controlled Area?',
              type: 'MULTI',
              options: ['Warning signage at the entrance', 'Screened or covered windows', 'Unrestricted public access', 'Removal of reflective surfaces'],
              correct: [0, 1, 3],
              explanation: 'Signage, screened windows and removing reflective surfaces are controls; access is restricted.'
            },
            {
              prompt: 'Protective eyewear works for any laser wavelength.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Eyewear is wavelength specific; the wrong eyewear gives no protection.'
            },
            {
              prompt: 'What is the role of the Laser Protection Adviser (LPA)?',
              type: 'SINGLE',
              options: [
                'To perform all treatments personally',
                'To provide expert advice on safe laser use and risk control',
                'To sell laser devices',
                'To replace the practitioner'
              ],
              correct: [1],
              explanation: 'The LPA is an expert adviser on safe use, risk assessment and local rules.'
            },
            {
              prompt: 'Who typically implements the local rules on site day to day?',
              type: 'SINGLE',
              options: ['The Laser Protection Adviser', 'The Laser Protection Supervisor', 'The client', 'The equipment supplier'],
              correct: [1],
              explanation: 'The Laser Protection Supervisor implements the local rules day to day.'
            },
            {
              prompt: 'Local authority special treatment licensing may apply to laser and IPL premises.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Many local authorities operate special treatment licensing, and requirements vary by nation.'
            },
            {
              prompt: 'Which are recognised non-beam hazards of laser use?',
              type: 'MULTI',
              options: ['Electrical hazards', 'Fire risk near alcohol or oxygen', 'Laser plume', 'Improved skin tone'],
              correct: [0, 1, 2],
              explanation: 'Electrical hazards, fire risk and plume are non-beam hazards; improved tone is an outcome.'
            }
          ]
        }
      },
      {
        title: 'Patch Testing, Treatment Planning, Aftercare & Complications',
        summary: 'Pre-treatment testing, structured planning, aftercare advice and managing adverse effects.',
        lessons: [
          {
            title: 'Patch Testing and Treatment Planning',
            durationMin: 13,
            videoQuery: 'laser patch test treatment planning',
            body: `## The Purpose of Patch Testing
A patch test applies the intended treatment to a small, representative area before a full treatment to check the skin's response and refine settings. It helps identify an adverse or exaggerated reaction in advance, supports parameter selection for that individual, and is an important safety and medico-legal step. A test area is treated and reviewed after an appropriate interval (often around 24 to 48 hours, and sometimes longer for delayed pigmentary responses) before proceeding.

## What a Patch Test Cannot Do
A patch test reduces but does not eliminate risk, and it does not test for every possible delayed reaction. It is one part of a wider risk assessment alongside consultation, skin typing and consent.

## Structured Treatment Planning
A treatment plan turns assessment into a safe sequence of care:

- Define the goal and confirm suitability and consent.
- Select device, wavelength, fluence, pulse duration, spot size and cooling based on target and skin type.
- Plan the number and spacing of sessions and the review points.
- Record baseline photographs and the agreed plan.

## Titration and Review
Settings are titrated conservatively, starting lower and increasing as tolerated based on the observed response and endpoints. At each session the practitioner reviews the previous response, adjusts the plan and documents decisions. This individualised, evidence-based approach is the hallmark of competent Level 3 practice.`,
            keyPoints: [
              'A patch test checks skin response and informs settings before full treatment.',
              'Patch testing reduces but does not eliminate risk.',
              'A treatment plan defines goal, parameters, session spacing and review points.',
              'Titrate settings conservatively and document decisions at each visit.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Aftercare and Managing Complications',
            durationMin: 13,
            videoQuery: 'laser aftercare complications management',
            body: `## Aftercare Advice
Good aftercare protects the result and reduces complications. Typical advice includes:

- Avoid sun exposure and use broad-spectrum SPF on treated areas.
- Avoid heat (hot baths, saunas, intense exercise) for a short period after treatment.
- Keep the area clean, avoid irritating products and do not pick or scratch.
- Avoid further hair removal methods that disturb the follicle (other than shaving) between sessions.

Clear written aftercare instructions, along with how to make contact if there is a problem, demonstrate professional care and help manage minor reactions before they escalate.

## Expected Reactions
Mild erythema and perifollicular oedema are normal and usually settle within hours to a couple of days. These are expected, not complications.

## Recognising Complications
Complications require recognition and an appropriate response:

- Burns and blistering: from excessive fluence or insufficient cooling; cool, protect and follow first-aid and referral protocols.
- Pigmentary change: hyperpigmentation (more common in darker skin) or hypopigmentation; usually managed conservatively with sun protection and time.
- Crusting and scarring: minimise by correct technique; scarring is rare with good practice.
- Infection: manage with hygiene and refer where needed.

## When to Refer
Severe burns, signs of infection, an unexpected or worsening reaction, or any uncertainty warrant referral to a GP or appropriate medical service. Documenting the event, the advice given and the outcome is essential. Honest, prompt management of complications protects the client and the practitioner.`,
            keyPoints: [
              'Aftercare centres on sun protection, avoiding heat and not disturbing the area.',
              'Mild erythema and oedema are expected reactions, not complications.',
              'Burns, pigmentary change, crusting, scarring and infection are complications to recognise.',
              'Severe or worsening reactions warrant prompt referral and full documentation.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 6 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'What is the main purpose of a patch test?',
              type: 'SINGLE',
              options: [
                'To complete the treatment quickly',
                'To check skin response and inform settings before full treatment',
                'To avoid consultation',
                'To guarantee no reaction will ever occur'
              ],
              correct: [1],
              explanation: 'A patch test checks the skin response and helps refine settings before treating fully.'
            },
            {
              prompt: 'A patch test eliminates all risk of an adverse reaction.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Patch testing reduces but does not eliminate risk and cannot predict every reaction.'
            },
            {
              prompt: 'Which are appropriate aftercare instructions?',
              type: 'MULTI',
              options: ['Use broad-spectrum SPF', 'Avoid saunas and hot baths briefly', 'Pick any crusts off promptly', 'Avoid waxing between sessions'],
              correct: [0, 1, 3],
              explanation: 'Sun protection, avoiding heat and not waxing are correct; picking crusts is harmful.'
            },
            {
              prompt: 'Mild erythema and perifollicular oedema after hair removal are:',
              type: 'SINGLE',
              options: ['A serious complication', 'Expected normal reactions', 'A sign of infection', 'Always permanent'],
              correct: [1],
              explanation: 'These are expected reactions that usually settle within hours to a couple of days.'
            },
            {
              prompt: 'Which pigmentary complication is more common in darker skin types?',
              type: 'SINGLE',
              options: ['Hypopigmentation only', 'Post-inflammatory hyperpigmentation', 'No pigment change', 'Permanent whitening only'],
              correct: [1],
              explanation: 'Darker skin types are more prone to post-inflammatory hyperpigmentation.'
            },
            {
              prompt: 'How should settings generally be titrated over a course?',
              type: 'SINGLE',
              options: [
                'Start at maximum and reduce',
                'Start conservatively and increase as tolerated based on response',
                'Use random settings',
                'Never change settings'
              ],
              correct: [1],
              explanation: 'Conservative titration based on observed response and endpoints is safest.'
            },
            {
              prompt: 'A severe burn with signs of infection should be managed in the clinic without referral.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Severe burns or infection warrant prompt referral to a GP or medical service.'
            }
          ]
        }
      }
    ]
  },
  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Advanced Skin Science & Ageing',
        summary: 'The biology of skin ageing and how intrinsic and extrinsic factors shape treatment strategy.',
        lessons: [
          {
            title: 'Intrinsic and Extrinsic Ageing',
            durationMin: 16,
            videoQuery: 'intrinsic extrinsic skin ageing photoageing',
            body: `## Two Pathways of Ageing
Skin ageing results from two interacting processes. Intrinsic (chronological) ageing is genetically programmed and unavoidable, while extrinsic ageing is driven by external factors, most importantly ultraviolet radiation. Distinguishing the two helps the practitioner explain causes and target modifiable factors.

## Intrinsic Ageing
Intrinsic ageing produces a gradual decline in cellular function. Fibroblast activity falls, so collagen and elastin production slows and existing fibres degrade. Cell turnover lengthens, the dermo-epidermal junction flattens, and there is a reduction in ground substance such as hyaluronic acid. The result is fine lines, thinning, reduced elasticity and dryness. These changes are subtle and uniform compared with sun damage.

## Extrinsic Ageing and Photoageing
Photoageing, caused mainly by UVA and UVB, accounts for the majority of visible facial ageing. UV generates reactive oxygen species and activates enzymes (matrix metalloproteinases) that break down collagen. Clinical signs include coarse wrinkles, mottled pigmentation, telangiectasia, a leathery texture and solar elastosis. Other extrinsic contributors include smoking, pollution, poor nutrition and disrupted sleep.

## Implications for Practice
Because photoageing is largely preventable, sun protection is the single most effective anti-ageing intervention and should be central to every plan. Treatments work alongside, not instead of, photoprotection. Understanding the cellular basis of ageing lets the practitioner select rational interventions (for example collagen-stimulating modalities) and set honest expectations grounded in biology rather than marketing claims.`,
            keyPoints: [
              'Intrinsic ageing is genetic and gradual; extrinsic ageing is driven mainly by UV.',
              'Reduced fibroblast activity lowers collagen, elastin and hyaluronic acid over time.',
              'Photoageing causes most visible facial ageing via reactive oxygen species and MMPs.',
              'Sun protection is the most effective anti-ageing intervention.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'Skin Cancer Foundation', url: 'https://www.skincancer.org' }
            ],
            resources: []
          },
          {
            title: 'Collagen, Elastin and the Dermal Matrix',
            durationMin: 14,
            videoQuery: 'collagen elastin dermal matrix skin structure',
            body: `## The Building Blocks of Healthy Skin
The dermis owes its strength and resilience to an extracellular matrix produced by fibroblasts. Understanding its components explains how rejuvenation treatments work.

- Collagen: the main structural protein, providing tensile strength. Type I predominates in adult dermis. It declines with age and UV damage.
- Elastin: provides recoil and elasticity, allowing skin to return to shape. Elastin fibres degrade and clump (solar elastosis) with photoageing.
- Ground substance: a gel of glycosaminoglycans including hyaluronic acid, which binds water and gives volume and hydration.

## How Treatments Stimulate Renewal
Many advanced treatments work by creating controlled micro-injury that triggers the wound-healing cascade and stimulates fibroblasts to lay down new collagen (neocollagenesis). This principle underlies microneedling, certain energy devices and chemical peels. The remodelling phase continues for weeks to months, which is why results develop over time rather than immediately.

## Realistic Expectations
Neocollagenesis improves quality and firmness gradually and partially; it does not reverse ageing. Combining modalities thoughtfully, maintaining results and protecting against further UV damage gives the best outcomes.

## Clinical Reasoning
At Level 4 the practitioner moves from following protocols to reasoning about mechanisms: which structure is deficient, which modality stimulates it, what the healing timeline implies, and how to sequence and space treatments. This mechanistic understanding underpins safe, individualised and ethical advanced practice.`,
            keyPoints: [
              'Collagen gives strength, elastin gives recoil, ground substance gives hydration and volume.',
              'Controlled micro-injury stimulates fibroblasts to produce new collagen.',
              'Results develop over weeks to months as collagen remodels.',
              'Neocollagenesis improves but does not reverse ageing.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'NICE', url: 'https://www.nice.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 1 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which factor is the main driver of extrinsic skin ageing?',
              type: 'SINGLE',
              options: ['Genetics', 'Ultraviolet radiation', 'Normal cell turnover', 'Vitamin D'],
              correct: [1],
              explanation: 'UV radiation is the principal cause of extrinsic ageing (photoageing).'
            },
            {
              prompt: 'Which protein provides the skin with recoil and elasticity?',
              type: 'SINGLE',
              options: ['Collagen', 'Elastin', 'Keratin', 'Haemoglobin'],
              correct: [1],
              explanation: 'Elastin provides elasticity, allowing the skin to return to shape.'
            },
            {
              prompt: 'Which are features of intrinsic ageing?',
              type: 'MULTI',
              options: ['Reduced fibroblast activity', 'Slower cell turnover', 'Deep mottled sun pigmentation', 'Loss of hyaluronic acid'],
              correct: [0, 1, 3],
              explanation: 'Reduced fibroblast activity, slower turnover and HA loss are intrinsic; mottled pigment is photoageing.'
            },
            {
              prompt: 'Photoageing accounts for most visible facial ageing.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'The majority of visible facial ageing is attributable to UV-driven photoageing.'
            },
            {
              prompt: 'How do many rejuvenation treatments stimulate new collagen?',
              type: 'SINGLE',
              options: [
                'By cooling the dermis',
                'By creating controlled micro-injury that triggers wound healing',
                'By removing all fibroblasts',
                'By blocking blood supply'
              ],
              correct: [1],
              explanation: 'Controlled micro-injury triggers the healing cascade and fibroblast collagen production.'
            },
            {
              prompt: 'Neocollagenesis fully reverses the ageing process.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'It improves firmness and quality gradually but does not reverse ageing.'
            },
            {
              prompt: 'What is the single most effective anti-ageing intervention?',
              type: 'SINGLE',
              options: ['Daily exfoliation', 'Sun protection', 'High-strength peels', 'Frequent microneedling'],
              correct: [1],
              explanation: 'Because photoageing is largely preventable, sun protection is the most effective measure.'
            }
          ]
        }
      },
      {
        title: 'Advanced Laser & Energy Devices',
        summary: 'Ablative and non-ablative lasers, fractional technology, radiofrequency and ultrasound.',
        lessons: [
          {
            title: 'Ablative, Non-Ablative and Fractional Resurfacing',
            durationMin: 16,
            videoQuery: 'fractional ablative non ablative laser resurfacing',
            body: `## Resurfacing Concepts
Skin resurfacing improves texture, tone and fine lines by removing or remodelling damaged tissue and stimulating collagen. Devices are classified by whether they ablate (vaporise) tissue and by whether they treat the whole surface or a fraction of it.

## Ablative versus Non-Ablative
Ablative lasers (such as CO2 at 10600 nm and Er:YAG at 2940 nm) target water and vaporise the epidermis and upper dermis. They give powerful results but carry longer downtime and higher risk, including infection, scarring and pigmentary change, especially in darker skin. Non-ablative lasers heat the dermis to stimulate collagen while leaving the epidermis intact, offering less downtime but more gradual results.

## Fractional Technology
Fractional devices treat only a fraction of the skin in a pattern of microscopic treatment zones, leaving surrounding untreated tissue to speed healing. Fractional approaches can be ablative or non-ablative and balance efficacy against downtime and risk. This concept revolutionised resurfacing by improving safety margins.

## Selection and Safety
Device choice depends on the indication, the client's skin type and acceptable downtime. Higher Fitzpatrick types need particular caution because of pigmentary risk. Eye protection, cooling, plume extraction, infection control and rigorous consent apply throughout. As always, treatment is matched to the target and individualised through assessment, patch testing and a documented plan.`,
            keyPoints: [
              'Ablative lasers vaporise tissue targeting water; non-ablative heat the dermis sparing the surface.',
              'Fractional devices treat microscopic zones to speed healing and improve safety.',
              'Ablative resurfacing gives stronger results but more downtime and risk.',
              'Darker skin types require extra caution due to pigmentary risk.'
            ],
            citations: [
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Radiofrequency, Ultrasound and Other Energy Devices',
            durationMin: 13,
            videoQuery: 'radiofrequency ultrasound skin tightening devices',
            body: `## Beyond Light
Several advanced devices use energy other than light to remodel tissue, and a Level 4 practitioner should understand their mechanisms and appropriate use.

## Radiofrequency (RF)
RF devices deliver electrical energy that generates heat within the dermis through tissue resistance. The controlled heating causes immediate collagen contraction and stimulates longer-term neocollagenesis, producing gradual tightening. RF is largely colour-blind to melanin, which can make it suitable across a wider range of skin types than some light-based devices, though manufacturer guidance and proper technique remain essential.

## Microfocused Ultrasound
Focused ultrasound delivers energy to precise depths, creating small thermal coagulation points that stimulate collagen remodelling in deeper layers, including the superficial musculoaponeurotic system in some applications. It targets deeper tissue while sparing the surface.

## Other Modalities
Other technologies include intense focused energy combinations and devices marketed for body contouring. Whatever the modality, the same principles apply: understand the mechanism, confirm the indication, respect contraindications, and avoid claims unsupported by evidence.

## Critical Appraisal
Energy device marketing can outpace evidence. The professional approach is to evaluate the underlying mechanism, the strength of evidence, the manufacturer instructions and the regulatory position, and to set honest expectations. Safe operation, appropriate training, maintenance and documented consent underpin responsible use of all energy devices.`,
            keyPoints: [
              'Radiofrequency heats the dermis via tissue resistance to tighten and stimulate collagen.',
              'RF is largely colour-blind to melanin, widening suitable skin types.',
              'Microfocused ultrasound targets precise depths sparing the surface.',
              'Appraise mechanism, evidence and regulation critically before adopting a device.'
            ],
            citations: [
              { label: 'NICE', url: 'https://www.nice.org.uk' },
              { label: 'British Medical Laser Association', url: 'https://www.bmla.co.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 2 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which chromophore do ablative resurfacing lasers target?',
              type: 'SINGLE',
              options: ['Melanin', 'Haemoglobin', 'Water', 'Elastin'],
              correct: [2],
              explanation: 'Ablative lasers such as CO2 and Er:YAG target water to vaporise tissue.'
            },
            {
              prompt: 'What characterises fractional resurfacing?',
              type: 'SINGLE',
              options: [
                'It treats 100% of the surface at once',
                'It treats microscopic zones leaving surrounding tissue to aid healing',
                'It never stimulates collagen',
                'It only works on hair'
              ],
              correct: [1],
              explanation: 'Fractional devices treat a fraction of the skin in microscopic zones to speed healing.'
            },
            {
              prompt: 'Compared with non-ablative, ablative resurfacing generally has:',
              type: 'SINGLE',
              options: ['Less downtime and lower risk', 'More downtime and higher risk', 'No effect on collagen', 'Identical risk'],
              correct: [1],
              explanation: 'Ablative resurfacing gives stronger results but more downtime and higher risk.'
            },
            {
              prompt: 'Radiofrequency primarily relies on melanin absorption.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'RF heats the dermis via tissue resistance and is largely colour-blind to melanin.'
            },
            {
              prompt: 'Which devices can stimulate collagen remodelling?',
              type: 'MULTI',
              options: ['Non-ablative laser', 'Radiofrequency', 'Microfocused ultrasound', 'A standard desk lamp'],
              correct: [0, 1, 2],
              explanation: 'Non-ablative laser, RF and focused ultrasound all stimulate collagen; a lamp does not.'
            },
            {
              prompt: 'Higher Fitzpatrick types need extra caution with ablative resurfacing because of pigmentary risk.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Darker skin is more prone to pigmentary complications after ablative treatment.'
            },
            {
              prompt: 'What is the professional approach to energy-device marketing claims?',
              type: 'SINGLE',
              options: [
                'Accept all claims at face value',
                'Critically appraise mechanism, evidence and regulation',
                'Ignore manufacturer instructions',
                'Promise guaranteed results'
              ],
              correct: [1],
              explanation: 'Claims should be appraised against mechanism, evidence and the regulatory position.'
            }
          ]
        }
      },
      {
        title: 'Chemical Peels & Microneedling',
        summary: 'Mechanisms, depths, indications and safety of two core advanced skin treatments.',
        lessons: [
          {
            title: 'Chemical Peels',
            durationMin: 15,
            videoQuery: 'chemical peels superficial medium deep explained',
            body: `## What a Peel Does
A chemical peel applies a chemical agent to cause controlled exfoliation and removal of damaged skin layers, prompting regeneration and improved tone and texture. Peels are classified by depth.

- Superficial peels: reach the epidermis. Agents include alpha-hydroxy acids (glycolic, lactic) and salicylic acid. Minimal downtime; address dullness, mild pigmentation and texture.
- Medium peels: reach the upper dermis, for example trichloroacetic acid (TCA) at certain concentrations. More downtime, stronger results.
- Deep peels: reach deeper dermis (e.g. phenol). Powerful but high risk and not within the scope of most aesthetic practitioners.

## Mechanism and Indications
By removing damaged layers and stimulating renewal, peels improve fine lines, superficial pigmentation, acne and texture. Agent, concentration and contact time determine depth and must be matched to the indication and skin type.

## Safety and Contraindications
Key safety points include thorough skin typing (darker skin carries higher post-inflammatory pigmentation risk), patch testing, correct neutralisation where required, and strict aftercare with sun protection. Contraindications include active infection (e.g. herpes simplex, which may need prophylaxis), isotretinoin use, pregnancy for certain agents, and compromised barrier. Layering acids inappropriately or leaving agents on too long can cause burns and scarring, so precise protocol adherence is essential.`,
            keyPoints: [
              'Peels cause controlled exfoliation and are classified by depth: superficial, medium, deep.',
              'Agent, concentration and contact time determine depth and effect.',
              'Darker skin types carry higher post-inflammatory pigmentation risk.',
              'Active infection, isotretinoin and a compromised barrier are key contraindications.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'NICE', url: 'https://www.nice.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Microneedling and Collagen Induction',
            durationMin: 13,
            videoQuery: 'microneedling collagen induction therapy',
            body: `## How Microneedling Works
Microneedling (collagen induction therapy) uses fine needles to create controlled micro-channels in the skin. These micro-injuries trigger the wound-healing cascade and stimulate fibroblasts to produce new collagen and elastin, improving texture, fine lines, scarring and overall quality over a course of treatments.

## Depth and Technique
Needle depth is selected for the area and indication; thinner skin (around the eyes) requires shallower depths than thicker skin (cheeks, scars). Even, controlled passes produce uniform micro-channels and the desired endpoint of light, even erythema and pinpoint bleeding for deeper work. Sterile, single-use needle cartridges are essential, and devices must never be shared between clients.

## Infection Control and Safety
Because microneedling breaches the barrier, infection control is paramount: aseptic technique, single-use sterile consumables, appropriate skin preparation and clean products applied during and after treatment. Only products validated as safe for needling should be used, as some topical ingredients can cause granulomatous reactions if introduced into the dermis.

## Contraindications and Aftercare
Contraindications include active acne or infection in the area, certain skin conditions, keloid tendency, and recent isotretinoin in some protocols. Aftercare emphasises gentle care, avoiding active ingredients initially, and strict sun protection. As with all advanced treatments, individualised assessment, consent, documentation and realistic expectations are central to safe practice.`,
            keyPoints: [
              'Microneedling creates micro-channels that stimulate collagen and elastin production.',
              'Needle depth is matched to skin thickness and indication.',
              'Sterile single-use cartridges and aseptic technique are mandatory.',
              'Only needling-validated products should be applied to avoid granulomatous reactions.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 3 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Superficial chemical peels primarily affect which layer?',
              type: 'SINGLE',
              options: ['The epidermis', 'The deep dermis', 'The hypodermis', 'The muscle'],
              correct: [0],
              explanation: 'Superficial peels reach the epidermis with minimal downtime.'
            },
            {
              prompt: 'Which factors determine the depth of a chemical peel?',
              type: 'MULTI',
              options: ['The agent used', 'Its concentration', 'Contact time', 'The colour of the towel'],
              correct: [0, 1, 2],
              explanation: 'Agent, concentration and contact time determine peel depth.'
            },
            {
              prompt: 'How does microneedling improve the skin?',
              type: 'SINGLE',
              options: [
                'By bleaching pigment',
                'By creating micro-injuries that stimulate collagen and elastin',
                'By cooling the dermis',
                'By removing all melanocytes'
              ],
              correct: [1],
              explanation: 'Micro-injuries trigger healing and stimulate new collagen and elastin.'
            },
            {
              prompt: 'Microneedling cartridges can be reused between clients if wiped clean.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Cartridges are single-use sterile consumables and must never be shared.'
            },
            {
              prompt: 'Which is a contraindication common to both peels and microneedling?',
              type: 'SINGLE',
              options: ['Active infection in the treatment area', 'Dry skin generally', 'Wearing makeup that day', 'Being over 30'],
              correct: [0],
              explanation: 'Active infection in the area is a contraindication for both treatments.'
            },
            {
              prompt: 'Deep phenol peels are within the routine scope of most aesthetic practitioners.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Deep peels are high risk and not within the scope of most aesthetic practitioners.'
            },
            {
              prompt: 'Why must only needling-validated products be used during microneedling?',
              type: 'SINGLE',
              options: [
                'They smell better',
                'Some topical ingredients can cause granulomatous reactions if introduced into the dermis',
                'They are cheaper',
                'They speed up the laser'
              ],
              correct: [1],
              explanation: 'Unsuitable ingredients introduced into the dermis can cause granulomatous reactions.'
            }
          ]
        }
      },
      {
        title: 'Advanced Consultation, Psychology & Ethics',
        summary: 'In-depth assessment, psychological screening and the ethics of aesthetic practice.',
        lessons: [
          {
            title: 'Advanced Consultation and Shared Decision-Making',
            durationMin: 14,
            videoQuery: 'aesthetic consultation shared decision making ethics',
            body: `## Beyond a Checklist
At Level 4 the consultation becomes a structured clinical and ethical assessment, not just a form. The practitioner explores motivations, expectations, history and suitability, and engages in shared decision-making so the client makes an informed, autonomous choice.

## Exploring Motivation and Expectation
Understanding why a client seeks treatment is central. Helpful questions explore what specifically concerns them, how long they have felt this way, what they hope to change and whether their expectations are realistic and achievable. A mismatch between expectation and what is achievable is a warning sign that warrants caution, further discussion or declining treatment.

## Shared Decision-Making
Shared decision-making means presenting the options, their benefits, risks and alternatives (including doing nothing), and supporting the client to choose in line with their values. This respects autonomy and reduces the risk of dissatisfaction and complaints.

## Capacity, Vulnerability and Pressure
The practitioner must confirm the client has capacity to consent and is not under undue pressure (for example from a partner). Particular care is needed with vulnerable clients. Treatments must never be sold through pressure, time-limited discounts that rush decisions, or exploiting insecurity.

## Documentation
A thorough record of the discussion, options presented, risks explained, expectations explored and the decision reached protects both parties and demonstrates ethical, professional practice. The cooling-off period and time to reflect are good practice for elective procedures.`,
            keyPoints: [
              'Advanced consultation is a clinical and ethical assessment, not a form-filling exercise.',
              'Exploring motivation and expectation reveals warning signs of unsuitability.',
              'Shared decision-making presents options, risks and alternatives including no treatment.',
              'Confirm capacity, avoid pressure selling and document the discussion fully.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: [
              { label: 'JCCP standards and guidance', url: 'https://www.jccp.org.uk' }
            ]
          },
          {
            title: 'Psychology, BDD Screening and Ethics',
            durationMin: 14,
            videoQuery: 'body dysmorphic disorder screening aesthetics',
            body: `## The Psychological Dimension
Aesthetic concerns are inherently psychological as well as physical. Recognising the psychological dimension helps the practitioner act ethically and identify clients for whom treatment may be unhelpful or harmful.

## Body Dysmorphic Disorder (BDD)
Body Dysmorphic Disorder is a mental health condition in which a person is preoccupied with a perceived flaw in their appearance that is not observable or appears minor to others, causing significant distress or impairment. Importantly, cosmetic treatment usually does not help and can worsen BDD, and these clients may become repeatedly dissatisfied.

## Recognising Warning Signs
Possible indicators include:

- Preoccupation with a flaw others can barely or cannot see.
- Repeated procedures with persistent dissatisfaction.
- Unrealistic expectations or seeking perfection.
- Significant distress, social or occupational impairment.
- A belief that treatment will transform their life or relationships.

Validated screening tools exist and can support identification. Where BDD is suspected, the appropriate response is to pause and sensitively recommend the client seeks support from their GP or a mental health professional rather than proceeding with treatment.

## Ethical Principles
Practice is guided by core ethical principles: autonomy (informed, voluntary choice), beneficence (acting in the client's interest), non-maleficence (avoiding harm) and justice (fairness). Acting ethically sometimes means declining treatment that a client requests. Honest marketing, no pressure selling and working within scope are all expressions of these principles.`,
            keyPoints: [
              'Aesthetic concerns have a significant psychological dimension.',
              'BDD involves preoccupation with a minimal or unobservable flaw and usually is not helped by treatment.',
              'Warning signs include repeated dissatisfaction and unrealistic, life-changing expectations.',
              'Suspected BDD warrants sensitive referral, not treatment; ethics may mean declining.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' }
            ],
            resources: [
              { label: 'NHS information on BDD', url: 'https://www.nhs.uk' }
            ]
          }
        ],
        quiz: {
          title: 'Module 4 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'What does shared decision-making involve?',
              type: 'SINGLE',
              options: [
                'The practitioner deciding alone',
                'Presenting options, risks and alternatives so the client chooses in line with their values',
                'Persuading the client to buy more',
                'Avoiding any discussion of risk'
              ],
              correct: [1],
              explanation: 'Shared decision-making supports an informed, values-based client choice.'
            },
            {
              prompt: 'Body Dysmorphic Disorder is characterised by:',
              type: 'SINGLE',
              options: [
                'A visible severe deformity',
                'Preoccupation with a perceived flaw that is minimal or unobservable to others',
                'Complete satisfaction with appearance',
                'A purely physical skin condition'
              ],
              correct: [1],
              explanation: 'BDD involves preoccupation with a flaw others can barely see, causing distress.'
            },
            {
              prompt: 'Cosmetic treatment usually resolves BDD.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Treatment usually does not help and can worsen BDD.'
            },
            {
              prompt: 'Which are warning signs that may indicate BDD?',
              type: 'MULTI',
              options: ['Repeated procedures with persistent dissatisfaction', 'Unrealistic, life-changing expectations', 'A clearly visible major injury', 'Significant distress over a minimal flaw'],
              correct: [0, 1, 3],
              explanation: 'Persistent dissatisfaction, unrealistic expectations and distress over a minimal flaw are signs.'
            },
            {
              prompt: 'Which are the core ethical principles guiding practice?',
              type: 'MULTI',
              options: ['Autonomy', 'Beneficence', 'Profit maximisation', 'Non-maleficence'],
              correct: [0, 1, 3],
              explanation: 'Autonomy, beneficence, non-maleficence and justice guide ethical practice; profit does not.'
            },
            {
              prompt: 'What is the appropriate response when BDD is suspected?',
              type: 'SINGLE',
              options: [
                'Proceed with treatment to reassure them',
                'Sensitively recommend support from a GP or mental health professional',
                'Offer a discount',
                'Perform multiple procedures'
              ],
              correct: [1],
              explanation: 'Suspected BDD warrants sensitive referral for support rather than treatment.'
            },
            {
              prompt: 'Acting ethically may sometimes mean declining a treatment a client requests.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Non-maleficence and beneficence can require declining inappropriate treatment.'
            }
          ]
        }
      },
      {
        title: 'Legislation, Regulation & Information Governance',
        summary: 'The UK regulatory landscape, oversight bodies, licensing and data protection duties.',
        lessons: [
          {
            title: 'The UK Regulatory Landscape: JCCP, CQC, HSE and Local Authorities',
            durationMin: 16,
            videoQuery: 'UK aesthetics regulation JCCP CQC local authority',
            body: `## A Patchwork of Oversight
The non-surgical aesthetics sector in the UK is regulated through a combination of bodies and laws rather than a single regulator. Understanding who does what is essential for lawful, professional practice.

## Key Bodies

- JCCP (Joint Council for Cosmetic Practitioners): a voluntary register and standards body for non-surgical cosmetic practitioners, working with the Cosmetic Practice Standards Authority to set training and practice standards.
- CQC (Care Quality Commission): regulates certain healthcare activities in England. Some cosmetic procedures that are regulated activities require CQC registration; many laser/IPL hair removal services for cosmetic purposes currently sit outside CQC.
- HSE (Health and Safety Executive): enforces health and safety law applicable to premises and staff.
- Local authorities: operate special treatment licensing and environmental health oversight, with requirements that vary by area, including parts of England, and devolved arrangements in Scotland, Wales and Northern Ireland differ.

## Why It Matters
Operating without the correct registration or licence is unlawful and can invalidate insurance. The forthcoming licensing scheme for non-surgical cosmetic procedures in England signals tighter regulation, so practitioners should stay informed of changes that affect their scope.

## Practical Duties
Practitioners must identify which registrations, licences and insurances apply to their treatments and location, keep them current, and document compliance. When in doubt, checking with the local authority and relevant bodies is the responsible course.`,
            keyPoints: [
              'UK aesthetics is regulated by multiple bodies and laws, not one regulator.',
              'JCCP sets voluntary standards; CQC regulates certain healthcare activities in England.',
              'HSE enforces health and safety; local authorities run special treatment licensing.',
              'Requirements vary by treatment and nation and are tightening over time.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'GOV.UK', url: 'https://www.gov.uk' }
            ],
            resources: [
              { label: 'GOV.UK guidance on cosmetic procedures', url: 'https://www.gov.uk' }
            ]
          },
          {
            title: 'GDPR, Consent and Information Governance',
            durationMin: 13,
            videoQuery: 'GDPR consent special category health data clinic',
            body: `## Protecting Client Information
Aesthetic practice generates sensitive personal data, including health information, photographs and consent records. Handling this lawfully is governed by the UK GDPR and the Data Protection Act 2018, overseen by the Information Commissioner's Office.

## Special Category Data
Health data is special category data, which attracts additional protection. Practitioners must have a lawful basis for processing and, for special category data, an additional condition. Information must be processed fairly, kept secure, used only for stated purposes, kept accurate, retained no longer than necessary and handled in line with individuals' rights.

## Consent for Data and Photographs
Consent to treatment is distinct from consent to use data and images. Using before-and-after photographs for marketing requires specific, informed and freely given consent that can be withdrawn, and images must be stored securely. Bundling marketing consent into treatment consent is not acceptable.

## Practical Governance

- Store records securely with access controls; protect digital data with appropriate security.
- Provide a clear privacy notice explaining how data is used.
- Honour rights such as access and erasure where applicable.
- Have a process to recognise and report a personal data breach promptly.

## Why It Matters
Beyond legal compliance, good information governance maintains client trust and protects the business. Breaches can result in regulatory action, reputational harm and loss of confidence, so governance is a core part of professional practice, not an afterthought.`,
            keyPoints: [
              'UK GDPR and the Data Protection Act 2018 govern client data, overseen by the ICO.',
              'Health data is special category data needing a lawful basis and extra condition.',
              'Marketing/photo consent is separate from treatment consent and can be withdrawn.',
              'Secure storage, privacy notices, rights handling and breach reporting are essential.'
            ],
            citations: [
              { label: 'GOV.UK', url: 'https://www.gov.uk' },
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 5 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'What is the JCCP?',
              type: 'SINGLE',
              options: [
                'A government tax body',
                'A voluntary register and standards body for non-surgical cosmetic practitioners',
                'A laser manufacturer',
                'A medical insurer'
              ],
              correct: [1],
              explanation: 'The JCCP is a voluntary register and standards body for the sector.'
            },
            {
              prompt: 'Which body enforces health and safety law on premises and staff?',
              type: 'SINGLE',
              options: ['JCCP', 'CQC', 'HSE', 'ICO'],
              correct: [2],
              explanation: 'The Health and Safety Executive enforces health and safety law.'
            },
            {
              prompt: 'Special treatment licensing is operated by which body?',
              type: 'SINGLE',
              options: ['Local authorities', 'The Bank of England', 'Awarding bodies', 'The laser supplier'],
              correct: [0],
              explanation: 'Local authorities operate special treatment licensing, with requirements varying by area.'
            },
            {
              prompt: 'Health data is classed as special category data under UK GDPR.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Health data is special category data attracting additional protection.'
            },
            {
              prompt: 'Consent to treatment automatically includes consent to use photos for marketing.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Marketing/photo consent is separate, specific and must be freely given and withdrawable.'
            },
            {
              prompt: 'Which are core information governance duties?',
              type: 'MULTI',
              options: ['Store records securely', 'Provide a clear privacy notice', 'Keep data forever regardless of need', 'Report personal data breaches promptly'],
              correct: [0, 1, 3],
              explanation: 'Secure storage, privacy notices and breach reporting are duties; data is not kept indefinitely.'
            },
            {
              prompt: 'Operating without the correct registration or licence can invalidate insurance.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Unlawful operation can void insurance and expose the practitioner to liability.'
            }
          ]
        }
      },
      {
        title: 'Facial Anatomy, Adverse Events & Professional Practice',
        summary: 'Relevant facial anatomy, recognising and managing complications, and scope of practice.',
        lessons: [
          {
            title: 'Anatomy Relevant to Facial Aesthetics',
            durationMin: 15,
            videoQuery: 'facial anatomy aesthetics skin layers fat pads',
            body: `## Why Anatomy Matters
Safe advanced facial treatment requires a working knowledge of facial anatomy, even for non-injectable practitioners, because it informs where structures lie, why ageing changes occur and where caution is needed.

## Layers of the Face
The face is layered: skin, subcutaneous fat, the superficial musculoaponeurotic system (SMAS) and mimetic muscles, deeper fat compartments, and bone with overlying periosteum. Vessels and nerves run within these layers. Ageing involves bone resorption, fat pad deflation and descent, and skin laxity, which together produce the visible signs treatments seek to address.

## Muscles of Facial Expression
The mimetic muscles attach to skin and create expression. Key examples include the frontalis (raises eyebrows), orbicularis oculi (closes eyes), corrugator and procerus (frown lines), and orbicularis oris (around the mouth). Understanding their action explains dynamic lines and is foundational for those who progress to injectables.

## Vasculature and Areas of Caution
The facial artery and its branches, the angular artery, and the supratrochlear and supraorbital vessels supply the face and are clinically important danger zones at higher levels of practice. Even within Level 4 scope, knowing that certain areas (glabella, nose, periorbital region) carry higher risk reinforces caution and the importance of working within one's training.

## Application
This anatomical foundation supports better treatment placement, clearer client explanations of ageing, recognition of structures to avoid, and a safe progression pathway toward more advanced qualifications.`,
            keyPoints: [
              'The face is layered: skin, fat, SMAS and muscle, deep fat and bone.',
              'Ageing involves bone resorption, fat deflation and descent, and skin laxity.',
              'Mimetic muscles create expression and dynamic lines.',
              'Glabella, nose and periorbital regions are higher-risk areas warranting caution.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Managing Adverse Events & Complications',
            durationMin: 14,
            videoQuery: 'managing adverse events aesthetic complications protocol',
            body: `## Anticipate, Recognise, Act
Competent advanced practice means anticipating possible complications, recognising them early and acting decisively. Every clinic should have written protocols, emergency contacts and the means to manage foreseeable events.

## Common Complications by Treatment

- Energy devices and peels: burns, blistering, prolonged erythema, pigmentary change, infection and, rarely, scarring.
- Microneedling: infection, prolonged erythema, granulomatous reactions from unsuitable products.
- General: allergic or hypersensitivity reactions, and rarely anaphylaxis, which is a medical emergency.

## A Structured Approach

- Stop the procedure if an unexpected or excessive reaction occurs.
- Assess the client and provide immediate appropriate care.
- Escalate and refer when the event is beyond your competence or worsening.
- Document the event, the actions taken and the advice given.
- Follow up to confirm resolution.

## Anaphylaxis and Emergencies
Practitioners should recognise the signs of a severe allergic reaction (such as difficulty breathing, swelling, widespread rash and collapse) and know to call emergency services immediately. Appropriate emergency training and equipment should match the treatments offered.

## Learning from Events
Reviewing complications, recording them and adjusting practice reduces recurrence. Honest disclosure to the client, appropriate apology and support maintain trust and are part of professional duty of candour. A blame-free learning culture improves safety over time.`,
            keyPoints: [
              'Anticipate, recognise early and act decisively on complications.',
              'Stop, assess, provide care, escalate, document and follow up.',
              'Recognise anaphylaxis and call emergency services immediately.',
              'Honest disclosure and learning from events uphold the duty of candour.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Professional Practice & Scope',
            durationMin: 12,
            videoQuery: 'scope of practice professional standards aesthetics',
            body: `## Working Within Scope
Scope of practice is the boundary of what a practitioner is trained, competent and authorised to do. Operating within scope protects clients and is fundamental to professional and insured practice. Recognising the edge of one's competence and referring or declining accordingly is a strength.

## Continuing Professional Development
Standards and evidence evolve, so practitioners have a duty to keep skills and knowledge current through continuing professional development (CPD), supervised practice where appropriate, and reflection. Registration bodies such as the JCCP set expectations for ongoing competence.

## Insurance and Accountability
Appropriate, current insurance is essential, and it generally requires working within training, within the law and within manufacturer guidance. Accurate records, valid consent and adherence to protocols all support accountability if an issue arises.

## Professional Conduct
Professional conduct includes honest marketing without exaggerated claims, no pressure selling, respect for client autonomy and dignity, confidentiality, and a duty of candour when things go wrong. Treating clients with whom there is doubt conservatively, and collaborating with medical colleagues, reflects mature practice.

## The Professional Pathway
Level 4 is part of a progression. Practitioners should understand the requirements and risks of more advanced procedures, such as injectables, and pursue further qualification, prescriber relationships and supervision before extending their scope. Planning a responsible development pathway protects both clients and career.`,
            keyPoints: [
              'Scope of practice is the boundary of trained, competent, authorised activity.',
              'CPD and reflection keep skills current and meet registration expectations.',
              'Valid insurance depends on working within training, law and manufacturer guidance.',
              'Honest conduct, candour and responsible progression define professionalism.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'GOV.UK', url: 'https://www.gov.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 6 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which structures lie within the layered anatomy of the face?',
              type: 'MULTI',
              options: ['Skin', 'Subcutaneous fat and SMAS', 'Mimetic muscle and bone', 'Lung tissue'],
              correct: [0, 1, 2],
              explanation: 'The face comprises skin, fat, SMAS, muscle and bone; lung tissue is unrelated.'
            },
            {
              prompt: 'Which facial regions are considered higher-risk danger zones?',
              type: 'MULTI',
              options: ['Glabella', 'Nose', 'Periorbital region', 'Earlobe'],
              correct: [0, 1, 2],
              explanation: 'The glabella, nose and periorbital region carry higher vascular risk.'
            },
            {
              prompt: 'What is the first action when an unexpected, excessive reaction occurs during a procedure?',
              type: 'SINGLE',
              options: ['Continue to finish', 'Stop the procedure and assess', 'Increase the settings', 'Ignore it'],
              correct: [1],
              explanation: 'Stopping and assessing is the first step in managing an adverse event.'
            },
            {
              prompt: 'Signs of anaphylaxis warrant calling emergency services immediately.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Anaphylaxis is a medical emergency requiring immediate emergency services.'
            },
            {
              prompt: 'What does working within scope of practice mean?',
              type: 'SINGLE',
              options: [
                'Doing whatever the client asks',
                'Only performing what you are trained, competent and authorised to do',
                'Avoiding all referrals',
                'Ignoring manufacturer guidance'
              ],
              correct: [1],
              explanation: 'Scope of practice is the boundary of trained, competent and authorised activity.'
            },
            {
              prompt: 'The duty of candour requires which behaviour when something goes wrong?',
              type: 'SINGLE',
              options: [
                'Concealing the event',
                'Honest disclosure, apology and support for the client',
                'Blaming the client',
                'Deleting records'
              ],
              correct: [1],
              explanation: 'Candour requires honest disclosure, apology and support when things go wrong.'
            },
            {
              prompt: 'Valid insurance generally requires working within training, the law and manufacturer guidance.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Insurance cover depends on operating within training, law and manufacturer guidance.'
            }
          ]
        }
      }
    ]
  },
  {
    courseSlug: 'advanced-aesthetics-level-5-7',
    modules: [
      {
        title: 'Facial Anatomy for Injectables',
        summary: 'Detailed musculature, vasculature and danger zones essential for safe injecting.',
        lessons: [
          {
            title: 'Musculature and the Layered Face',
            durationMin: 16,
            videoQuery: 'facial muscles injectable anatomy frontalis corrugator',
            body: `## A Foundation for Safe Injecting
Advanced injectable practice rests on precise anatomical knowledge. The injector must understand the layers of the face, the muscles of facial expression and how product placement relates to depth and structure.

## The Layers
From superficial to deep, the face comprises skin, subcutaneous fat, the SMAS and mimetic muscles, retaining ligaments and spaces, deep fat compartments, and the periosteum over bone. Neurovascular structures travel at characteristic depths within these layers, so knowing the layer being injected is central to safety. Botulinum toxin targets muscle, while dermal fillers are placed at varying depths depending on the product and indication.

## Muscles of Expression
Key mimetic muscles and their actions include:

- Frontalis: elevates the brow, producing horizontal forehead lines.
- Corrugator supercilii and procerus: produce vertical and horizontal glabellar (frown) lines.
- Orbicularis oculi: closes the eye and creates lateral canthal lines (crow's feet).
- Orbicularis oris, depressor anguli oris, mentalis and the perioral muscles: shape the mouth and chin.

Understanding the origin, insertion and action of each muscle allows precise, predictable toxin placement and explains the effects and risks of treatment.

## Bone and Support
Underlying bone provides the framework. Age-related bone resorption (for example around the orbit and midface) contributes to the appearance of ageing and informs structural filler placement. A three-dimensional mental model of the face underpins competent advanced practice.`,
            keyPoints: [
              'The face is layered: skin, fat, SMAS and muscle, deep fat and bone, each with neurovascular structures.',
              'Toxin targets muscle; filler depth varies by product and indication.',
              'Frontalis, corrugator, procerus and orbicularis muscles drive common dynamic lines.',
              'Knowing muscle origin, insertion and action enables precise, safe placement.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Vasculature and Danger Zones',
            durationMin: 16,
            videoQuery: 'facial danger zones vasculature filler injection',
            body: `## Why Vasculature Is Critical
The most serious filler complications arise from injecting into or compressing blood vessels. A thorough knowledge of facial vasculature and the recognised danger zones is non-negotiable for safe injecting.

## Key Vessels
The facial artery (a branch of the external carotid) runs from the mandible toward the medial canthus, becoming the angular artery. The supratrochlear and supraorbital arteries supply the forehead and glabella and connect to the ophthalmic artery, a branch of the internal carotid. The presence of anastomoses between the external and internal carotid systems explains how filler can, rarely, reach the retinal circulation and cause visual loss.

## Recognised Danger Zones
High-risk areas include:

- The glabella: vascular events here are strongly associated with skin necrosis and, rarely, blindness.
- The nose: rich vascularity and end arteries make it high risk.
- The nasolabial and infraorbital region: proximity to the angular and infraorbital vessels.
- The temple and forehead: superficial vessels at risk.

## Risk-Reduction Principles
Safe technique includes detailed anatomical knowledge, aspiration where appropriate, slow injection with low pressure, small aliquots, moving-needle technique in some areas, using cannulas in higher-risk zones, and constant vigilance for signs of vascular compromise such as blanching, disproportionate pain or duskiness. Recognising these signs early is essential because rapid response improves outcomes, as covered later in the complications module.`,
            keyPoints: [
              'Serious filler complications arise from intravascular injection or vessel compression.',
              'The facial, angular, supratrochlear and supraorbital arteries are key structures.',
              'Anastomoses to the ophthalmic artery explain the rare risk of blindness.',
              'Glabella, nose and periorbital regions are major danger zones.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 1 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which muscles primarily produce glabellar (frown) lines?',
              type: 'MULTI',
              options: ['Corrugator supercilii', 'Procerus', 'Frontalis', 'Masseter'],
              correct: [0, 1],
              explanation: 'The corrugator and procerus produce glabellar frown lines.'
            },
            {
              prompt: 'Botulinum toxin exerts its cosmetic effect by acting on which tissue?',
              type: 'SINGLE',
              options: ['Bone', 'Muscle', 'Blood vessels', 'Sweat in all cases only'],
              correct: [1],
              explanation: 'Botulinum toxin acts at the neuromuscular junction to relax targeted muscle.'
            },
            {
              prompt: 'Which artery becomes the angular artery near the medial canthus?',
              type: 'SINGLE',
              options: ['Facial artery', 'Temporal artery', 'Maxillary artery', 'Carotid sinus'],
              correct: [0],
              explanation: 'The facial artery courses upward and becomes the angular artery near the medial canthus.'
            },
            {
              prompt: 'Why can filler rarely cause visual loss?',
              type: 'SINGLE',
              options: [
                'Because filler dissolves the retina',
                'Because anastomoses connect facial vessels to the ophthalmic/retinal circulation',
                'Because toxin spreads to the eye',
                'Because the eye absorbs filler directly'
              ],
              correct: [1],
              explanation: 'Anastomoses to the ophthalmic artery can carry filler to the retinal circulation.'
            },
            {
              prompt: 'Which areas are recognised high-risk danger zones for filler?',
              type: 'MULTI',
              options: ['Glabella', 'Nose', 'Earlobe', 'Periorbital/infraorbital region'],
              correct: [0, 1, 3],
              explanation: 'The glabella, nose and periorbital region are major danger zones; the earlobe is low risk.'
            },
            {
              prompt: 'Knowing the layer being injected is central to injection safety.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Neurovascular structures travel at characteristic depths, so layer awareness is essential.'
            },
            {
              prompt: 'Which techniques help reduce vascular risk during filler injection?',
              type: 'MULTI',
              options: ['Slow injection with low pressure', 'Small aliquots', 'Rapid high-pressure boluses', 'Using cannulas in higher-risk zones'],
              correct: [0, 1, 3],
              explanation: 'Slow low-pressure injection, small aliquots and cannulas reduce risk; rapid boluses increase it.'
            }
          ]
        }
      },
      {
        title: 'Pharmacology of Botulinum Toxin & Dermal Fillers',
        summary: 'Mechanisms, properties and rational use of the two main injectable product classes.',
        lessons: [
          {
            title: 'Botulinum Toxin Pharmacology',
            durationMin: 15,
            videoQuery: 'botulinum toxin mechanism of action SNARE',
            body: `## What Botulinum Toxin Is
Botulinum toxin is a purified neurotoxin produced by Clostridium botulinum. In aesthetics, type A preparations are used in tiny, controlled doses to temporarily relax specific muscles, softening dynamic lines. It is a prescription-only medicine (POM) in the UK.

## Mechanism of Action
Botulinum toxin acts at the neuromuscular junction. It is taken up by presynaptic nerve terminals and cleaves SNARE proteins (such as SNAP-25 for type A), preventing the release of acetylcholine. Without acetylcholine, the muscle cannot contract, producing a reversible, dose-dependent reduction in muscle activity.

## Onset, Duration and Reversibility
The effect typically begins within a few days, peaks at around two weeks and lasts approximately three to four months as nerve terminals regenerate and form new connections. The effect is therefore temporary and not reversible by an antidote; it simply wears off.

## Dosing and Products
Different brands are not interchangeable unit-for-unit because units are product specific. Reconstitution, storage and dosing must follow the specific product's guidance. Accurate dosing, correct muscle selection and appropriate placement determine both efficacy and the risk of unwanted spread to adjacent muscles.

## Safety Considerations
Contraindications include certain neuromuscular disorders, allergy to constituents, pregnancy and breastfeeding, and active infection at the site. Because it is a POM, it must be prescribed appropriately following a face-to-face assessment by the prescriber, as explored in the prescribing module.`,
            keyPoints: [
              'Botulinum toxin type A is a prescription-only neurotoxin used in tiny doses.',
              'It cleaves SNARE proteins, blocking acetylcholine release at the neuromuscular junction.',
              'Effect onsets in days, peaks around two weeks and lasts three to four months.',
              'Units are product specific and not interchangeable between brands.'
            ],
            citations: [
              { label: 'NICE', url: 'https://www.nice.org.uk' },
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Dermal Filler Pharmacology and Properties',
            durationMin: 14,
            videoQuery: 'hyaluronic acid dermal filler properties rheology',
            body: `## What Dermal Fillers Are
Most modern dermal fillers are made of hyaluronic acid (HA), a naturally occurring glycosaminoglycan in the dermis that binds water and provides volume and hydration. HA fillers are cross-linked to slow their breakdown and tailor their properties, and they restore volume, contour and hydration.

## Key Physical Properties
Filler behaviour is described by its rheology, which guides product selection by indication:

- G prime (G'): elasticity or firmness; higher G' products resist deformation and suit deep structural support.
- Cohesivity: how well the gel holds together.
- HA concentration and degree of cross-linking: influence longevity and lift.

Softer, less cross-linked products suit superficial fine lines and lips, while firmer products suit deep volumising over bone.

## A Crucial Safety Advantage
A major advantage of HA fillers is that they can be dissolved by the enzyme hyaluronidase. This is central to managing complications, particularly vascular occlusion, and is a key reason HA is the dominant material in safe practice. Non-HA fillers (such as calcium hydroxylapatite or poly-L-lactic acid) are not reversible in the same way and carry different risk profiles.

## Longevity and Selection
HA filler longevity varies by product and site, commonly several months to over a year. Rational selection matches the product's properties to the depth and goal, always with safety, reversibility and the client's anatomy in mind.`,
            keyPoints: [
              'Most fillers are cross-linked hyaluronic acid that binds water for volume.',
              'Rheology (G prime, cohesivity, cross-linking) guides product choice by indication.',
              'HA fillers can be dissolved with hyaluronidase, a key safety advantage.',
              'Non-HA fillers are not reversible the same way and carry different risks.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 2 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'How does botulinum toxin type A reduce muscle activity?',
              type: 'SINGLE',
              options: [
                'By dissolving the muscle',
                'By cleaving SNARE proteins and blocking acetylcholine release',
                'By increasing acetylcholine',
                'By cooling the nerve'
              ],
              correct: [1],
              explanation: 'It cleaves SNARE proteins (e.g. SNAP-25), preventing acetylcholine release.'
            },
            {
              prompt: 'How long does the effect of botulinum toxin typically last?',
              type: 'SINGLE',
              options: ['A few days', 'Three to four months', 'Permanently', 'Ten years'],
              correct: [1],
              explanation: 'The effect typically lasts about three to four months as nerve terminals regenerate.'
            },
            {
              prompt: 'Units of botulinum toxin are interchangeable between all brands.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Units are product specific and not interchangeable between brands.'
            },
            {
              prompt: 'Which material makes up most modern dermal fillers?',
              type: 'SINGLE',
              options: ['Silicone', 'Hyaluronic acid', 'Collagen from bovine sources', 'Saline'],
              correct: [1],
              explanation: 'Most modern fillers are cross-linked hyaluronic acid.'
            },
            {
              prompt: 'Which property describes a filler firmness or resistance to deformation?',
              type: 'SINGLE',
              options: ['G prime (G′)', 'pH', 'Osmolarity', 'Viscosity of water'],
              correct: [0],
              explanation: 'G prime describes elasticity/firmness; higher G prime suits deep structural support.'
            },
            {
              prompt: 'A key safety advantage of HA fillers is that they can be dissolved with hyaluronidase.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Hyaluronidase reversibility is central to managing complications such as occlusion.'
            },
            {
              prompt: 'Which are contraindications to botulinum toxin treatment?',
              type: 'MULTI',
              options: ['Certain neuromuscular disorders', 'Pregnancy and breastfeeding', 'Active infection at the site', 'Dry skin'],
              correct: [0, 1, 2],
              explanation: 'Neuromuscular disorders, pregnancy/breastfeeding and active infection are contraindications.'
            }
          ]
        }
      },
      {
        title: 'Prescribing & the Prescriber Relationship',
        summary: 'How prescription-only medicines are lawfully prescribed and supplied in aesthetics.',
        lessons: [
          {
            title: 'Prescription-Only Medicines and the Law',
            durationMin: 14,
            videoQuery: 'prescription only medicine botulinum toxin prescribing UK',
            body: `## POMs in Aesthetics
Botulinum toxin is a prescription-only medicine (POM) in the UK, and certain other products and emergency medicines used in aesthetics are also POMs. This places legal obligations on how they are prescribed, supplied and administered, which every advanced practitioner must understand.

## Who Can Prescribe
Only appropriately qualified prescribers (such as doctors, dentists, and independent prescriber nurses and pharmacists acting within their competence) can prescribe POMs. A prescriber must make a clinical decision to prescribe for a specific, identified patient.

## The Face-to-Face Requirement
A central principle is that botulinum toxin should not be prescribed remotely without an appropriate assessment. Good practice and professional guidance require the prescriber to undertake a proper assessment of the individual patient, generally face to face, before prescribing. Remote prescribing of botulinum toxin without such assessment is widely regarded as unacceptable and contrary to professional standards.

## Non-Prescriber Practitioners
A non-prescriber may administer a POM only when it has been lawfully prescribed for that named patient by a prescriber who has assessed them. The practitioner cannot obtain or direct the use of POMs for unnamed patients in advance. Understanding this boundary is essential to lawful practice.

## Record Keeping
Prescriptions, the assessment, consent and administration must be documented. Clear records protect the patient, the prescriber and the administering practitioner, and are required for accountability and any regulatory scrutiny.`,
            keyPoints: [
              'Botulinum toxin and some other aesthetic medicines are prescription-only medicines.',
              'Only qualified prescribers can prescribe, for a specific identified patient.',
              'Botulinum toxin should not be prescribed remotely without proper, usually face-to-face, assessment.',
              'Non-prescribers may only administer POMs lawfully prescribed for a named patient.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'GOV.UK', url: 'https://www.gov.uk' }
            ],
            resources: []
          },
          {
            title: 'Working Effectively with a Prescriber',
            durationMin: 12,
            videoQuery: 'aesthetic practitioner prescriber working relationship',
            body: `## A Shared Responsibility
Safe injectable practice often involves a partnership between a non-prescribing practitioner and a prescriber. Both share responsibility for patient safety, and a clear, professional relationship underpins lawful and high-quality care.

## What the Relationship Requires

- A genuine clinical assessment of each patient by the prescriber before prescribing.
- Clear communication of the patient's history, assessment findings and treatment plan.
- Agreement on protocols, including how complications and emergencies will be managed and who is available.
- Access to the prescriber for advice and, crucially, for prescribing emergency medicines such as hyaluronidase when needed.

## Emergency Cover
A particular concern is access to hyaluronidase, a POM used to dissolve HA filler in a vascular occlusion. Practitioners must plan in advance how they will obtain and use it promptly in an emergency, because delay worsens outcomes. This requires a prescriber relationship that supports timely access and clear emergency protocols.

## Accountability
Each professional remains accountable for their own actions within their role. The prescriber is accountable for the prescribing decision; the practitioner is accountable for assessment, technique, consent and aftercare. Documented, collaborative working that puts patient safety first is the standard expected at advanced levels.`,
            keyPoints: [
              'Injectable practice is often a partnership between practitioner and prescriber.',
              'The prescriber must genuinely assess each patient before prescribing.',
              'Plan in advance for prompt access to emergency hyaluronidase.',
              'Each professional remains accountable for their own role and actions.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'NICE', url: 'https://www.nice.org.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 3 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Botulinum toxin is classified in the UK as:',
              type: 'SINGLE',
              options: ['A general sales item', 'A pharmacy medicine', 'A prescription-only medicine', 'A food supplement'],
              correct: [2],
              explanation: 'Botulinum toxin is a prescription-only medicine (POM).'
            },
            {
              prompt: 'Who may lawfully prescribe a POM for aesthetic use?',
              type: 'SINGLE',
              options: [
                'Any trained injector',
                'Only an appropriately qualified prescriber acting within competence',
                'A receptionist',
                'The product supplier'
              ],
              correct: [1],
              explanation: 'Only qualified prescribers acting within competence can prescribe POMs.'
            },
            {
              prompt: 'Botulinum toxin can be prescribed remotely without any assessment of the patient.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'It should not be prescribed remotely without a proper, usually face-to-face, assessment.'
            },
            {
              prompt: 'A non-prescriber may administer a POM under what condition?',
              type: 'SINGLE',
              options: [
                'For any walk-in patient',
                'Only when lawfully prescribed for that named patient by a prescriber who assessed them',
                'Whenever stock is available',
                'Only on weekends'
              ],
              correct: [1],
              explanation: 'A POM must be lawfully prescribed for the named, assessed patient.'
            },
            {
              prompt: 'Why is advance planning for hyaluronidase access important?',
              type: 'SINGLE',
              options: [
                'It is needed for routine top-ups',
                'It is required promptly to manage vascular occlusion, and delay worsens outcomes',
                'It improves filler longevity',
                'It is a marketing requirement'
              ],
              correct: [1],
              explanation: 'Prompt hyaluronidase is critical in occlusion; delay worsens outcomes.'
            },
            {
              prompt: 'In a practitioner-prescriber partnership, who is accountable for the prescribing decision?',
              type: 'SINGLE',
              options: ['The administering practitioner', 'The prescriber', 'The receptionist', 'The patient'],
              correct: [1],
              explanation: 'The prescriber is accountable for the prescribing decision.'
            },
            {
              prompt: 'Which elements should a good prescriber relationship include?',
              type: 'MULTI',
              options: ['Genuine patient assessment by the prescriber', 'Agreed emergency protocols', 'Access for emergency prescribing', 'Prescribing for unnamed patients in bulk'],
              correct: [0, 1, 2],
              explanation: 'Assessment, emergency protocols and access are required; bulk prescribing for unnamed patients is not lawful.'
            }
          ]
        }
      },
      {
        title: 'Advanced Complications & Hyaluronidase Protocol',
        summary: 'Recognising and managing serious injectable complications, especially vascular occlusion.',
        lessons: [
          {
            title: 'Vascular Occlusion: Recognition and Immediate Management',
            durationMin: 17,
            videoQuery: 'vascular occlusion filler management protocol',
            body: `## The Most Feared Complication
Vascular occlusion (VO) occurs when filler obstructs or compresses a blood vessel, interrupting blood supply. Untreated, it can cause skin necrosis and, if the occlusion affects the ophthalmic circulation, irreversible visual loss. Prompt recognition and immediate action are essential.

## Recognising Vascular Occlusion
Warning signs may appear during or shortly after treatment and include:

- Disproportionate or severe pain (though VO can sometimes be painless).
- Immediate blanching or a white appearance of the skin.
- A dusky, mottled or reticulated (livedo) discolouration developing over minutes to hours.
- Delayed signs such as worsening discolouration, blistering and pain.

Visual symptoms such as sudden vision changes, severe eye pain, headache or other neurological signs are red-flag emergencies.

## Immediate Management
If VO is suspected, stop injecting immediately and act without delay:

- Stop the procedure.
- Institute the occlusion protocol, the cornerstone of which is prompt high-dose hyaluronidase to dissolve HA filler and restore flow.
- Apply measures that may support perfusion as per protocol (such as warmth and massage).
- Escalate urgently; visual or neurological symptoms require emergency referral to specialist ophthalmology/emergency services.
- Reassess frequently and re-dose hyaluronidase as guided until resolution.

## Preparedness
Every injecting clinic must have a written, rehearsed emergency protocol, immediate access to hyaluronidase, and clear escalation routes. Preparedness, not improvisation, saves tissue and sight.`,
            keyPoints: [
              'Vascular occlusion interrupts blood supply and can cause necrosis or blindness.',
              'Signs include disproportionate pain, blanching and dusky mottled discolouration.',
              'Visual or neurological symptoms are red-flag emergencies needing urgent referral.',
              'Immediate management centres on stopping and prompt high-dose hyaluronidase.'
            ],
            citations: [
              { label: 'British Association of Dermatologists', url: 'https://www.bad.org.uk' },
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' }
            ],
            resources: []
          },
          {
            title: 'Hyaluronidase, Other Complications and Aftercare',
            durationMin: 14,
            videoQuery: 'hyaluronidase protocol filler complications',
            body: `## Hyaluronidase
Hyaluronidase is an enzyme that breaks down hyaluronic acid, used to dissolve HA filler in complications such as vascular occlusion, nodules and overcorrection. It is a prescription-only medicine and must be available and used promptly in an emergency. Because it is derived from animal sources in many preparations, there is a risk of allergic reaction, so practitioners should be alert to hypersensitivity and, where indicated by protocol, consider patch testing in non-emergency use; in a true vascular emergency, the priority is restoring perfusion.

## Other Injectable Complications

- Bruising, swelling and tenderness: common and usually self-limiting.
- Infection: managed with hygiene, antibiotics and, where needed, referral; biofilm is a consideration in delayed nodules.
- Nodules and granulomas: inflammatory or non-inflammatory; managed according to type, sometimes with hyaluronidase or referral.
- Toxin-related: ptosis (eyelid or brow droop) from unwanted spread, asymmetry, or a frozen appearance from over-treatment; these are temporary but distressing.
- Hypersensitivity and, rarely, anaphylaxis: a medical emergency.

## Consent, Aftercare and Follow-Up
Clients must be consented for these risks specifically. Aftercare advice covers expected effects, what is abnormal, and how to make urgent contact. A clear follow-up and a low threshold for review allow early detection of delayed problems.

## Documentation and Learning
Every complication should be documented and reviewed. Reflective learning, audit and honest communication with the client uphold the duty of candour and continually improve safety in advanced practice.`,
            keyPoints: [
              'Hyaluronidase dissolves HA filler and is central to emergency management.',
              'It is a POM with allergy risk; perfusion is the priority in a true emergency.',
              'Other complications include infection, nodules, ptosis and rarely anaphylaxis.',
              'Specific consent, clear aftercare, follow-up and documentation are essential.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 4 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'What is vascular occlusion?',
              type: 'SINGLE',
              options: [
                'A normal bruise',
                'Filler obstructing or compressing a blood vessel, interrupting blood supply',
                'A type of peel',
                'A muscle relaxation effect'
              ],
              correct: [1],
              explanation: 'VO is obstruction or compression of a vessel by filler, interrupting blood supply.'
            },
            {
              prompt: 'Which are warning signs of vascular occlusion?',
              type: 'MULTI',
              options: ['Disproportionate pain', 'Immediate blanching', 'Dusky mottled discolouration', 'Improved skin firmness'],
              correct: [0, 1, 2],
              explanation: 'Pain, blanching and dusky mottling are warning signs; firmness is not.'
            },
            {
              prompt: 'What is the cornerstone of vascular occlusion management with HA filler?',
              type: 'SINGLE',
              options: ['More filler', 'Prompt high-dose hyaluronidase', 'Cold compress only', 'Waiting 24 hours'],
              correct: [1],
              explanation: 'Prompt high-dose hyaluronidase dissolves HA filler to restore flow.'
            },
            {
              prompt: 'Sudden vision changes after filler are a red-flag emergency.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Visual symptoms require urgent emergency referral as they may indicate ophthalmic involvement.'
            },
            {
              prompt: 'Hyaluronidase is a prescription-only medicine that can cause allergic reactions.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Hyaluronidase is a POM and carries a risk of hypersensitivity.'
            },
            {
              prompt: 'Which toxin-related complication results from unwanted spread to the levator muscle?',
              type: 'SINGLE',
              options: ['Vascular occlusion', 'Eyelid ptosis', 'Granuloma', 'Necrosis'],
              correct: [1],
              explanation: 'Spread affecting the levator can cause eyelid ptosis, which is temporary.'
            },
            {
              prompt: 'In a true vascular emergency, what is the immediate priority?',
              type: 'SINGLE',
              options: [
                'Completing a leisurely patch test first',
                'Restoring perfusion promptly via the occlusion protocol',
                'Rebooking the client for next week',
                'Adding more filler to mask it'
              ],
              correct: [1],
              explanation: 'Restoring perfusion promptly is the priority; do not delay emergency treatment.'
            }
          ]
        }
      },
      {
        title: 'Medical Assessment, Sterile Technique & Medico-Legal Practice',
        summary: 'Pre-treatment medical assessment, asepsis and the advanced consent and legal framework.',
        lessons: [
          {
            title: 'Medical Assessment and Patient Selection',
            durationMin: 14,
            videoQuery: 'aesthetic medical history assessment patient selection',
            body: `## A Medical Mindset
Injectable treatments are medical procedures, and patient selection must be approached with a medical mindset. A thorough assessment identifies contraindications, anticipates risk and confirms suitability before any prescription or treatment.

## Comprehensive History
The assessment should capture:

- Medical history, including cardiovascular, autoimmune and neuromuscular conditions.
- Medications and supplements, including anticoagulants and antiplatelets that increase bruising and bleeding risk.
- Allergies, including to lidocaine, hyaluronidase constituents or previous products.
- Previous aesthetic treatments and any prior reactions, and any permanent or semi-permanent filler already present.
- Relevant lifestyle, pregnancy or breastfeeding status, and psychological factors including BDD screening.

## Specific Contraindications
Examples include active infection at the site, pregnancy and breastfeeding, certain neuromuscular disorders (for toxin), known hypersensitivity, and unrealistic expectations. Some factors require caution or prescriber input rather than absolute avoidance.

## Examination and Decision
Assessment combines history with examination of the area, skin quality and facial anatomy. The practitioner then makes a reasoned decision to proceed, modify, defer or decline, and documents the rationale. Selecting the right patient is one of the most powerful ways to prevent complications, and declining inappropriate treatment is a core professional skill.`,
            keyPoints: [
              'Injectables are medical procedures requiring thorough medical assessment.',
              'History covers medical conditions, medication, allergies and prior treatments.',
              'Anticoagulants raise bleeding risk; allergies and infection are key concerns.',
              'Sound patient selection and willingness to decline prevent complications.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'NHS', url: 'https://www.nhs.uk' }
            ],
            resources: []
          },
          {
            title: 'Sterile Technique and Infection Prevention',
            durationMin: 13,
            videoQuery: 'aseptic non touch technique injectable infection control',
            body: `## Why Asepsis Is Critical
Every injection breaches the skin barrier and introduces a risk of infection, including delayed infections and biofilm formation around filler. Rigorous infection prevention is therefore central to safe injectable practice.

## Aseptic Non-Touch Technique
Aseptic Non-Touch Technique (ANTT) protects key parts and key sites from contamination. In practice this includes:

- Thorough hand hygiene and appropriate gloves.
- Effective skin antisepsis of the treatment area and allowing it to dry.
- Avoiding contamination of the needle, cannula tip and other key parts.
- Using single-use, sterile consumables and never reusing them.
- Maintaining a clean field and clean injectables handling.

## Sharps and Waste
Safe sharps handling prevents needlestick injury and cross-infection. Sharps go directly into a compliant sharps bin, are never re-sheathed unsafely, and clinical waste is segregated and disposed of according to regulations.

## Reducing Biofilm and Delayed Infection
Meticulous antisepsis, removing make-up before skin preparation, avoiding injecting through contaminated skin, and good technique reduce the risk of biofilm and delayed nodular infection. If a delayed infection is suspected, prompt assessment and appropriate management, including possible referral, are required.

## Environment
The treatment environment must support asepsis: clean surfaces, appropriate lighting, hand hygiene facilities and a logical, uncluttered set-up. Infection prevention is a continuous discipline, not a single step.`,
            keyPoints: [
              'Every injection risks infection, including delayed and biofilm-related infection.',
              'Aseptic Non-Touch Technique protects key parts and key sites from contamination.',
              'Use single-use sterile consumables and dispose of sharps safely.',
              'Meticulous antisepsis and technique reduce biofilm and delayed infection.'
            ],
            citations: [
              { label: 'NHS', url: 'https://www.nhs.uk' },
              { label: 'Health and Safety Executive', url: 'https://www.hse.gov.uk' }
            ],
            resources: []
          },
          {
            title: 'Advanced Consent and Medico-Legal Practice',
            durationMin: 14,
            videoQuery: 'informed consent Montgomery medico-legal aesthetics',
            body: `## Consent as a Process
At advanced levels, consent is a rigorous, documented process rather than a signature. It reflects the legal standard set by the Montgomery judgment, under which a patient must be informed of material risks (those a reasonable person in the patient's position would attach significance to) and reasonable alternatives, including doing nothing.

## Elements of Valid Consent
Valid consent requires that the patient:

- Has capacity to decide.
- Is given sufficient, balanced information about benefits, material risks, alternatives and aftercare.
- Decides voluntarily, free from undue pressure.
- Has time to consider, with a cooling-off period for elective procedures.

Consent must be specific to the treatment, revisited if the plan changes, and clearly documented.

## Medico-Legal Responsibilities
Advanced practitioners carry significant medico-legal responsibility. Key duties include accurate contemporaneous records, appropriate indemnity insurance, compliance with medicines and data protection law, honest marketing, and the duty of candour when things go wrong. Photographs require separate, specific consent and secure storage under data protection law.

## Managing Complaints and Risk
A professional complaints process, prompt and honest handling of dissatisfaction, and a willingness to involve the prescriber or refer for medical input all reduce harm and medico-legal exposure. Working within scope, maintaining competence through CPD, and documenting decisions are the foundations that protect both patient and practitioner. Ultimately, robust consent and meticulous records are as much a part of safe advanced practice as injection technique itself.`,
            keyPoints: [
              'Consent is a documented process reflecting the Montgomery material-risk standard.',
              'Valid consent needs capacity, information, voluntariness and time to reflect.',
              'Advanced practice carries medico-legal duties: records, indemnity, candour, data law.',
              'Photographs need separate specific consent and secure storage.'
            ],
            citations: [
              { label: 'Joint Council for Cosmetic Practitioners', url: 'https://www.jccp.org.uk' },
              { label: 'GOV.UK', url: 'https://www.gov.uk' }
            ],
            resources: []
          }
        ],
        quiz: {
          title: 'Module 5 Assessment',
          passMark: 70,
          questions: [
            {
              prompt: 'Which medications notably increase bruising and bleeding risk during injectables?',
              type: 'SINGLE',
              options: ['Anticoagulants and antiplatelets', 'Vitamin C tablets', 'Topical moisturisers', 'Antihistamines only'],
              correct: [0],
              explanation: 'Anticoagulants and antiplatelets increase bleeding and bruising risk.'
            },
            {
              prompt: 'What does Aseptic Non-Touch Technique aim to protect?',
              type: 'SINGLE',
              options: [
                'The clinic furniture',
                'Key parts and key sites from contamination',
                'The practitioner reputation only',
                'The product packaging'
              ],
              correct: [1],
              explanation: 'ANTT protects key parts and key sites from contamination.'
            },
            {
              prompt: 'Single-use sterile consumables may be reused if the clinic is busy.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [1],
              explanation: 'Single-use sterile consumables must never be reused.'
            },
            {
              prompt: 'The Montgomery standard requires patients to be informed of what?',
              type: 'SINGLE',
              options: [
                'Only the benefits',
                'Material risks and reasonable alternatives, including doing nothing',
                'Nothing if they trust the practitioner',
                'Only the price'
              ],
              correct: [1],
              explanation: 'Montgomery requires disclosure of material risks and reasonable alternatives.'
            },
            {
              prompt: 'Which elements are required for valid consent?',
              type: 'MULTI',
              options: ['Capacity to decide', 'Sufficient balanced information', 'Voluntariness free from pressure', 'A non-refundable deposit'],
              correct: [0, 1, 2],
              explanation: 'Capacity, information and voluntariness are required; a deposit is not a consent element.'
            },
            {
              prompt: 'Photographs for marketing require separate, specific consent and secure storage.',
              type: 'TRUEFALSE',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Image use needs separate specific consent and secure storage under data protection law.'
            },
            {
              prompt: 'Which are core medico-legal responsibilities of an advanced practitioner?',
              type: 'MULTI',
              options: ['Accurate contemporaneous records', 'Appropriate indemnity insurance', 'Duty of candour', 'Exaggerated marketing claims'],
              correct: [0, 1, 2],
              explanation: 'Records, indemnity and candour are duties; exaggerated marketing is not acceptable.'
            }
          ]
        }
      }
    ]
  }
];
