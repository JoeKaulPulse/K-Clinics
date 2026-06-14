// Content model for the KClinics Staff Operating Manual.
// Plain English for a non-technical team. Edit here, then run build-pdf.cjs.
// Role tags map to CSS classes: Owner, Admin, Front desk, Clinician, All staff, Soon.

const CONTENT = {
  coverSub: 'One platform runs the clinic: bookings, clients, payments, marketing, the academy and the website. This manual explains every part, what you do in your role, and what the owner must set up and keep compliant.',
  sections: [

    // ===== PART 1 — ORIENTATION =====
    {
      title: 'How to use this manual',
      lead: 'Read the part for your role, keep the rest for reference. Every screen named here is reached from the left-hand menu in the admin at <code>kclinics.co.uk/admin</code>.',
      blocks: [
        { h3: 'Who this is for' },
        { p: 'Everyone who works in the clinic uses the admin. What you can see and do depends on your role. The owner sets roles up. If a screen named here is not in your menu, your role does not have access to it — that is normal.' },
        { h3: 'The role tags' },
        { p: 'Each instruction carries a tag showing who it is for. Tags are a guide; the owner can grant or remove individual permissions for any person.' },
        { table: { head: ['Tag', 'Who it means'], widths: ['26%', '74%'], rows: [
          ['<span class="role r-owner">Owner</span>', 'You own the business. Full access, plus the security and money controls no one else has.'],
          ['<span class="role r-admin">Admin</span>', 'Manages day-to-day clinic operations. Almost everything except staff accounts, settings and security.'],
          ['<span class="role r-frontdesk">Front desk</span>', 'Reception. Booking, checking clients in, taking payment, answering calls and chat.'],
          ['<span class="role r-clinician">Clinician</span>', 'Practitioner or doctor. Appointments, client clinical records, consent, stock used in treatment.'],
          ['<span class="role r-allstaff">All staff</span>', 'Everyone with a login, whatever the role.'],
          ['<span class="role r-soon">Soon</span>', 'Planned feature, not live yet. Listed so you know it is coming.'],
        ] } },
        { h3: 'How instructions are written' },
        { p: 'Numbered steps are one action each, naming the button or field exactly as it appears. A line starting "Done when:" tells you what success looks like, so you know you have finished.' },
        { note: { label: 'Golden rule', note: 'Never share your login. Each person has their own account so the activity log shows who did what. If someone needs access, ask the owner to add them.' } },
      ],
    },

    {
      title: 'Signing in, your account and 2FA',
      lead: 'Your login protects client and health data. Treat it the way you would treat keys to the clinic.',
      blocks: [
        { shot: { src: 'admin-login', device: 'desk', url: 'kclinics.co.uk/admin', caption: 'The admin sign-in. Your email, your password, then a code or your fingerprint.' } },
        { ktip: 'Add a passkey on your own phone, then signing in is just your face or thumb — and there is no password to forget.' },
        { task: { title: 'Sign in to the admin', roles: ['All staff'], steps: [
          'Go to <code>kclinics.co.uk/admin</code>.',
          'Enter your work email and password, then press <b>Sign in</b>.',
          'If asked for a 6-digit code, open your authenticator app and type the current code. If asked for Face ID or a fingerprint, follow the prompt on your device.',
        ], done: 'you land on the dashboard with your name in the greeting.' } },
        { task: { title: 'Turn on two-factor (2FA) for yourself', roles: ['All staff'], intro: 'A second step at login so a stolen password is not enough to get in. The owner can require this for your role.', steps: [
          'Open <code>/admin/security</code> (or ask the owner to send you the setup link).',
          'Choose <b>Authenticator app</b>, scan the square code with Google Authenticator or Authy, and enter the 6-digit code it shows.',
          'Save the <b>recovery codes</b> somewhere safe — they get you in if you lose your phone.',
        ], done: 'your security page shows 2FA as on.' } },
        { task: { title: 'Add Face ID or a fingerprint (passkey)', roles: ['All staff'], intro: 'Sign in with your face or fingerprint instead of typing a password. Your password still works as a backup.', steps: [
          'On the device you use most, open <code>/admin/security</code>.',
          'Press <b>Add passkey</b> and follow your device prompt (Face ID, Touch ID or Windows Hello).',
          'Name the device so you recognise it later.',
        ], done: 'the device is listed under your passkeys.' } },
        { note: { label: 'If you are locked out', note: 'Five wrong passwords locks the account for 15 minutes. The owner can unlock you straight away from <code>/admin/security</code>. After three wrong tries you may be asked to pass a quick "I am human" check.' } },
        { h3: 'Passwords' },
        { ul: [
          'Use a long password you do not use anywhere else. A short memorable phrase of several words beats a single complex word.',
          'Never reuse your clinic password on personal sites.',
          'The owner should ask everyone to change passwords if a device is lost or a person leaves.',
        ] },
      ],
    },

    {
      title: 'The admin at a glance',
      lead: 'The left-hand menu groups every screen into ten sections. This manual follows that order. Below is the whole map and who each role can reach.',
      blocks: [
        { table: { head: ['Menu group', 'What lives there'], widths: ['24%', '76%'], rows: [
          ['Today', 'Dashboard, My day, Calendar, Tasks, Time off'],
          ['Clients &amp; Bookings', 'Bookings, Waitlist, Consultations, Live chat, Calls, Clients, Reviews, NPS'],
          ['Loyalty &amp; Offers', 'Discounts, Promotions, Rewards, Membership, Gift vouchers'],
          ['Catalogue', 'Services &amp; pricing, Products'],
          ['Website', 'Pages, Reusable blocks, Journal, Media, Before &amp; after'],
          ['K Academy', 'Courses, Applications, Trainees, Exam practice, Live classes, Careers'],
          ['Operations', 'Schedules, Session insights, Inventory, Reorder, Suppliers, SOPs, Consent, Health forms, Devices, Day close, Facility'],
          ['Marketing', 'Hub, Campaigns, Performance, Audiences, Email, Templates, Automations, A/B testing, Insights, Brand kit, Connections, QR codes'],
          ['Finance', 'Till (POS), Orders, Cashflow, Reports, Financial controls'],
          ['Administration', 'Go live, Status, API health, Build &amp; issues, Contractors, Staff &amp; access, Security, Activity log, Site &amp; globals, Locations, SEO, Redirects, Integrations, Credentials, Settings'],
        ] } },
        { h3: 'What each role can reach' },
        { table: { head: ['Role', 'Access'], widths: ['20%', '80%'], rows: [
          ['Owner', 'Everything, with no limits. Only the owner manages staff accounts, settings, security and the money controls.'],
          ['Admin', 'All clinic operations and clinical records. Cannot manage staff, settings or security.'],
          ['Clinician', 'Dashboard, calendar, bookings, clients and clinical records, consent, stock, day close, facility, the build board.'],
          ['Front desk', 'Bookings and payments, consultations, clients (non-clinical), chat and calls, schedule, stock, the till, day close.'],
          ['Developer', 'Dashboard, build board, platform status and API health only. No client or clinical data.'],
          ['Contractor', 'Dashboard, facility documents and their assigned tasks only, plus clock in and out.'],
          ['Staff', 'Read-only view of bookings, consultations, clients, calendar and stock, plus day close and facility.'],
        ] } },
        { note: { label: 'Report a problem', note: 'See something broken or wrong on any screen? Use the small <b>Report a problem</b> button at the bottom-right of the page. It grabs a screenshot and files it on the Build &amp; Issues board for the owner and the dev to pick up.' } },
      ],
    },

    // ===== PART 2 — THE ADMIN, GROUP BY GROUP =====
    {
      title: 'Today — dashboard, day and tasks',
      lead: 'Your starting point each shift: what is happening today and what needs doing.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['18%', '64%', '18%'], rows: [
          ['Dashboard <code>/admin</code>', 'Your home screen. Greeting, live clock, weather, key numbers and the jobs that need attention. The layout shapes itself to your role.', 'All staff'],
          ['My day <code>/admin/my-day</code>', 'Your personal agenda — your appointments, prep and tasks for today.', 'All staff'],
          ['Calendar <code>/admin/calendar</code>', 'The whole day on a grid, every clinician side by side, 8am to 9pm. Add time blocks here.', 'Front desk, Clinician'],
          ['Tasks <code>/admin/tasks</code>', 'Shared to-do board for the team. The menu shows a count of open tasks.', 'All staff'],
          ['Time off <code>/admin/time-off</code>', 'Request and approve holiday, sick, training and personal time.', 'All staff'],
        ] } },
        { task: { title: 'Clock in and out', roles: ['All staff'], steps: [
          'On the dashboard, find the clock-in pill near the top.',
          'Press it once when you start your shift, and again when you finish.',
        ], done: 'the pill shows you as clocked in, with the time.' } },
        { task: { title: 'Add a task for the team', roles: ['All staff'], steps: [
          'Open <code>/admin/tasks</code> and press <b>New task</b>.',
          'Type a clear title, add detail, set a priority and a due date.',
          'Pick an <b>Assignee</b> if it is for a specific person; link a client if it relates to one.',
          'Press <b>Save</b>. The task appears in the Open column.',
        ], done: 'the task shows in Open with its reference (e.g. TSK-42) and assignee.' } },
        { task: { title: 'Request time off', roles: ['All staff'], steps: [
          'Open <code>/admin/time-off</code> and press <b>Request time off</b>.',
          'Choose the type: Holiday, Sick, Training or Personal.',
          'Pick the dates (all day, or a time range), add a short reason, and submit.',
        ], done: 'your request shows as Pending until an approver decides.' } },
        { task: { title: 'Approve or decline time off', roles: ['Admin', 'Owner'], intro: 'Approvers have a count of pending requests in the menu.', steps: [
          'Open <code>/admin/time-off</code>.',
          'Open a request marked Pending, check the team calendar below it for clashes, and press <b>Approve</b> or <b>Decline</b>.',
        ], done: 'the request moves to Approved or Declined and the person is notified.' } },
        { ktip: 'Clock in the moment you arrive. Day close reads your hours from it, so it only works if it is on.' },
      ],
    },

    {
      title: 'Clients &amp; Bookings',
      lead: 'Every appointment, every client record, and every way clients reach you — calls, chat and enquiries — in one place.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['18%', '64%', '18%'], rows: [
          ['Bookings <code>/admin/bookings</code>', 'The master appointment list. Filter by Upcoming, Requests, Past, Confirmed, Completed, Cancelled. Search by client or treatment.', 'Front desk, Clinician'],
          ['Waitlist <code>/admin/waitlist</code>', 'Clients waiting for a slot. When a matching cancellation opens, they are offered it automatically.', 'Front desk'],
          ['Consultations <code>/admin/consultations</code>', 'New enquiries from the website. Move each from New to Contacted to Booked.', 'Front desk'],
          ['Live chat <code>/admin/chat</code>', 'Web chat, SMS and WhatsApp messages. The menu shows unread count.', 'Front desk'],
          ['Calls <code>/admin/calls</code>', 'Phone log with recordings and transcripts; click a number to dial out.', 'Front desk'],
          ['Clients <code>/admin/clients</code>', 'The full client database. Profiles, history, tags and (for clinicians) encrypted health records.', 'Front desk, Clinician'],
          ['Reviews <code>/admin/reviews</code>', 'Approve and publish client reviews to the website.', 'Admin'],
          ['NPS <code>/admin/nps</code>', 'Satisfaction score and survey replies over time.', 'Admin'],
        ] } },
        { task: { title: 'Take a booking over the phone or desk', roles: ['Front desk'], steps: [
          'Open <code>/admin/bookings</code> and press <b>New booking</b>.',
          'Search the client by name; if new, add them with name, phone and email.',
          'Choose the treatment and variant (for example "Laser — underarms"), then a date and time from the free slots.',
          'Pick the clinician if the client has a preference.',
          'Confirm. Choose whether to take a card now or on the day, per clinic policy.',
        ], done: 'the appointment shows under Upcoming and the client gets a confirmation email.' } },
        { task: { title: 'Reschedule or cancel an appointment', roles: ['Front desk'], steps: [
          'Open <code>/admin/bookings</code>, find the appointment (search by name), and open it.',
          'Press <b>Reschedule</b> and pick a new free slot, or press <b>Cancel</b> and choose a reason.',
        ], done: 'the new time shows, and the client is emailed the change.' } },
        { task: { title: 'Check a client in for their appointment', roles: ['Front desk', 'Clinician'], steps: [
          'Open the client’s appointment from <code>/admin/bookings</code> or the Calendar.',
          'Confirm their health form and consent are complete (see Operations). If not, send the form before treatment.',
          'Mark the appointment as arrived / in session.',
        ], done: 'the room display outside shows the room as in session.' } },
        { task: { title: 'Open a client’s clinical record', roles: ['Clinician'], intro: 'Health data is encrypted and only opens for staff with clinical permission.', steps: [
          'Open <code>/admin/clients</code> and search the client.',
          'Open their profile and select the <b>Clinical</b> area to read allergies, medications and notes.',
          'Add a treatment note after the appointment so the record stays current.',
        ], done: 'your note is saved against the client and dated.' } },
        { ktip: 'Send the health form when you take the booking, never on the day. It saves the clinician chasing it at the door.' },
        { note: { label: 'Client privacy', note: 'Exporting or deleting a client is recorded in the activity log and limited to senior roles. Never download client lists to a personal device. See the GDPR section for the right way to handle access and erasure requests.' } },
      ],
    },

    {
      title: 'Loyalty &amp; Offers',
      lead: 'The tools that bring clients back: discount codes, timed promotions, points, memberships and gift cards.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['20%', '62%', '18%'], rows: [
          ['Discounts <code>/admin/discounts</code>', 'Create codes (percentage or fixed amount), set limits and expiry, and override welcome-offer claims.', 'Admin'],
          ['Promotions <code>/admin/promotions</code>', 'Timed offers shown on the site and in client accounts.', 'Admin'],
          ['Rewards <code>/admin/rewards</code>', 'Staff points and leaderboard — a motivation layer for the team, not for clients.', 'Admin, Owner'],
          ['Membership <code>/admin/membership</code>', 'Subscription tiers and their benefits; see active members.', 'Admin'],
          ['Gift vouchers <code>/admin/gift-vouchers</code>', 'Issue and track gift cards; check balances and expiry.', 'Front desk'],
        ] } },
        { task: { title: 'Create a discount code', roles: ['Admin'], steps: [
          'Open <code>/admin/discounts</code> and press <b>New code</b>.',
          'Type the code, choose percentage or fixed amount, and set a usage limit and expiry date.',
          'Save. Share the code, or add it to a campaign.',
        ], done: 'the code appears in the list and works at checkout.' } },
        { task: { title: 'Put an offer live on the site', roles: ['Admin'], steps: [
          'Open <code>/admin/promotions</code> and press <b>New promotion</b>.',
          'Set the headline, the offer, and start and end dates.',
          'Save. It shows in the offers strip on the booking page while active.',
        ], done: 'the offer appears on <code>/offers</code> and on the booking page.' } },
        { p: 'Clients earn points for spending and for leaving reviews, redeemable against future visits. Referrals give both people credit once the new client’s first treatment is done. These run automatically; you only step in to fix a dispute.' },
        { shot: { src: 'gift', device: 'desk', url: 'kclinics.co.uk/gift-vouchers', caption: 'Clients buy gift cards here; you can also issue and track them from the admin.' } },
        { ktip: 'Points and referral rewards land on their own. If a client says theirs are missing, check the activity log before you adjust anything.' },
      ],
    },

    {
      title: 'Catalogue — services and products',
      lead: 'Your treatment menu and your retail shelf. Prices set here flow to the website, the booking page and the till.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['22%', '60%', '18%'], rows: [
          ['Services &amp; pricing <code>/admin/services</code>', 'Every treatment, its variants, price, cost, duration and VAT class. Bulk price changes and offers live here.', 'Admin'],
          ['Products <code>/admin/products</code>', 'Retail stock — skincare and supplements. Prices, images, stock and 18+ flags.', 'Admin'],
        ] } },
        { task: { title: 'Add or edit a treatment', roles: ['Admin'], steps: [
          'Open <code>/admin/services</code> and pick the category, or press <b>New service</b>.',
          'Set the name, price, cost of goods, duration and VAT class.',
          'Add variants if the treatment has options (different areas or strengths), each with its own price and time.',
          'Make sure <b>Active</b> is ticked so clients can book it. Save.',
        ], done: 'the treatment shows on the website and in the booking list at the right price.' } },
        { task: { title: 'Add a retail product', roles: ['Admin'], steps: [
          'Open <code>/admin/products</code> and press <b>New product</b>.',
          'Add the name, price, an image and the stock quantity.',
          'Tick <b>18+</b> if it must be age-checked at checkout. Save.',
        ], done: 'the product shows in the shop and on the till.' } },
        { ktip: 'Fill in the cost price as well as the retail price. That one field is what makes the margin reports tell the truth.' },
      ],
    },

    {
      title: 'Website',
      lead: 'Build and edit the public site without code. The design is locked to the brand, so pages stay on-brand whoever edits them.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['20%', '62%', '18%'], rows: [
          ['Pages <code>/admin/pages</code>', 'The page builder. Drag on-brand sections to build landing and treatment pages.', 'Admin'],
          ['Reusable blocks <code>/admin/blocks</code>', 'Build a section once and reuse it across many pages.', 'Admin'],
          ['Journal <code>/admin/journal</code>', 'The blog. Posts appear at <code>/journal</code>.', 'Admin'],
          ['Media <code>/admin/media</code>', 'One shared library for all images and files.', 'Admin'],
          ['Before &amp; after <code>/admin/gallery</code>', 'Result photo pairs, tagged by treatment, with consent flags.', 'Admin'],
        ] } },
        { task: { title: 'Edit and publish a page', roles: ['Admin'], intro: 'You can draft freely; only people with publish permission make it live.', steps: [
          'Open <code>/admin/pages</code> and open the page, or press <b>New page</b>.',
          'Add or rearrange sections by dragging. Edit text and images in place.',
          'Press <b>Preview</b> to see it as visitors will. When happy, press <b>Publish</b>.',
        ], done: 'the live page shows your changes.' } },
        { ktip: 'Press Preview before Publish. What you see in Preview is exactly what a visitor gets — no surprises.' },
        { note: { label: 'Before &amp; after photos', note: 'Only upload result photos where the client has signed consent for their images to be shown. Tag each pair with the treatment so it appears on the right page.' } },
      ],
    },

    {
      title: 'K Academy — the training platform',
      lead: 'A full training academy inside the platform: market courses, enrol students, deliver theory and quizzes online, run practical days and live classes, and issue certificates.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['20%', '62%', '18%'], rows: [
          ['Courses <code>/admin/academy</code>', 'The course catalogue and cohorts — levels, prices, dates, capacity.', 'Admin'],
          ['Applications <code>/admin/academy/enrolments</code>', 'The enrolment pipeline. Accept applicants, take deposits, enrol them.', 'Admin'],
          ['Trainees <code>/admin/academy/students</code>', 'Student accounts, progress, quiz scores and certificates.', 'Admin'],
          ['Exam practice <code>/admin/academy/practice</code>', 'The question bank, mock papers and past papers.', 'Admin'],
          ['Live classes <code>/admin/academy/live-classes</code>', 'Schedule online sessions and track attendance.', 'Admin'],
          ['Careers <code>/admin/careers</code>', 'Post jobs and manage applicants for the clinic and academy.', 'Admin'],
        ] } },
        { task: { title: 'Open a course for enrolment', roles: ['Admin'], steps: [
          'Open <code>/admin/academy</code> and open the course, or press <b>New course</b>.',
          'Set the level, price, learning outcomes and accreditations.',
          'Add a cohort with start and end dates, a cap on numbers and a location.',
          'Make sure the lessons are published before you let people enrol. Save.',
        ], done: 'the course shows on <code>/academy</code> with an Enrol button.' } },
        { task: { title: 'Enrol an applicant', roles: ['Admin'], steps: [
          'Open <code>/admin/academy/enrolments</code> and open the application.',
          'Review their details and press <b>Accept</b>.',
          'Take the deposit (instalments are supported) and confirm the place.',
        ], done: 'the trainee can sign in to the portal and start the course.' } },
        { shot: { src: 'academy', device: 'desk', url: 'kclinics.co.uk/academy', caption: 'The public academy page that markets your courses.', pins: [ { x: '12%', y: '76%', n: 1 }, { x: '25%', y: '76%', n: 2 }, { x: '50%', y: '98%', n: 3 } ], legend: ['Explore courses — browse and enrol', 'Trainee login', 'Ofqual / VTCT / CPD accreditations'] } },
        { p: 'Trainees learn in a guided, bite-size format with a friendly on-screen guide, quizzes, points, badges and streaks, on phone or desktop. Content grows automatically through a standing job, so the course library keeps expanding without manual work.' },
        { shot: { src: 'academy-portal', device: 'phone', url: '/academy/portal', caption: 'How a trainee signs in on their phone.', pins: [ { x: '52%', y: '80%', n: 1 }, { x: '52%', y: '93%', n: 2 } ], legend: ['Email and password', 'Or sign in with Face ID / fingerprint'] } },
        { ktip: 'Show new trainees how to install the portal like an app and sign in with their face. They will actually keep their streak going.' },
      ],
    },

    {
      title: 'Operations',
      lead: 'Keep the clinic staffed, stocked, safe and consistent — rotas, inventory, suppliers, procedures, forms, devices and the end-of-day close.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['20%', '62%', '18%'], rows: [
          ['Schedules <code>/admin/schedule</code>', 'Staff hours, breaks, rooms, equipment and clinic closures. Links to Google Calendar if enabled.', 'Admin, Front desk'],
          ['Session insights <code>/admin/reports/sessions</code>', 'How long appointments really take and where time is lost.', 'Admin'],
          ['Inventory <code>/admin/inventory</code>', 'Stock with cost, expiry and usage. Items expiring within 90 days are flagged.', 'Front desk, Clinician'],
          ['Reorder <code>/admin/reorder</code>', 'Low-stock list and purchase orders.', 'Front desk'],
          ['Suppliers <code>/admin/suppliers</code>', 'Vendor contacts and bills (links to Xero).', 'Admin'],
          ['SOPs <code>/admin/sops</code>', 'Step-by-step procedures per treatment, with sign-off.', 'Admin, Clinician'],
          ['Consent <code>/admin/consent</code>', 'Consent form templates and signed-form history.', 'Admin, Clinician'],
          ['Health forms <code>/admin/health-forms</code>', 'Medical intake questionnaires and completed responses.', 'Admin, Clinician'],
          ['Devices <code>/admin/devices</code>', 'Card readers, screens, kiosks and printers.', 'Admin'],
          ['Day close <code>/admin/day-close</code>', 'End-of-day cash-up, stock check and shutdown checklist.', 'Front desk'],
          ['Facility <code>/admin/facility</code>', 'Floor plans, equipment guides and where things are kept.', 'All staff'],
        ] } },
        { task: { title: 'Receive a stock delivery', roles: ['Front desk', 'Clinician'], steps: [
          'Open <code>/admin/inventory</code> and find the item, or add it.',
          'Press <b>Receive stock</b> and enter the quantity, batch number, expiry date and cost.',
          'Save. The stock level goes up and the expiry is tracked.',
        ], done: 'the item shows the new quantity and a future expiry date.' } },
        { task: { title: 'Send a consent form before treatment', roles: ['Front desk', 'Clinician'], steps: [
          'Open the client’s booking.',
          'Choose the right consent template (for example "Laser consent") and press <b>Send for signature</b>.',
          'The client gets a secure link, reads it, ticks the boxes and signs.',
        ], done: 'the signed form shows against the client, dated and locked.' } },
        { task: { title: 'Run day close', roles: ['Front desk'], intro: 'The end-of-day ritual. Do it before leaving.', steps: [
          'Open <code>/admin/day-close</code>.',
          'Mark any in-progress treatments complete.',
          'Count the cash and card takings and enter them to reconcile.',
          'Do the stock check and tick off the shutdown list (clean, lights, alarm).',
          'Submit to lock the day.',
        ], done: 'the day shows as closed and reconciled.' } },
        { ktip: 'Receive stock with its expiry date in the box. The 90-day "expiring soon" warning only works if the date is actually entered.' },
      ],
    },

    {
      title: 'Marketing',
      lead: 'A marketing department inside the platform: plan campaigns across channels, see what works, and let routine follow-ups run themselves.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['20%', '62%', '18%'], rows: [
          ['Marketing hub <code>/admin/marketing</code>', 'Overview of revenue, bookings, conversion and new clients, with links to every tool.', 'Admin'],
          ['Campaigns <code>/admin/marketing/campaigns</code>', 'Email, SMS and paid campaigns with AI copy help and scheduling.', 'Admin'],
          ['Performance <code>/admin/marketing/performance</code>', 'Which sources and campaigns bring revenue, plus a 90-day forecast.', 'Admin'],
          ['Audiences <code>/admin/marketing/audiences</code>', 'Reusable client segments with live size counts.', 'Admin'],
          ['Email <code>/admin/marketing/email</code>', 'Newsletters and bulk email, with opens and clicks.', 'Admin'],
          ['Templates <code>/admin/marketing/templates</code>', 'Preview every client email the system sends.', 'Admin'],
          ['Automations <code>/admin/automations</code>', 'Hands-off journeys: birthdays, post-treatment follow-ups, win-backs.', 'Admin'],
          ['A/B testing <code>/admin/marketing/ab</code>', 'Test two versions of a page to see which converts better.', 'Admin'],
          ['Insights <code>/admin/marketing/insights</code>', 'Click heatmaps, scroll depth and session replays.', 'Admin'],
          ['Brand kit <code>/admin/brand</code>', 'Logos, colours, fonts and tone, used across pages and emails.', 'Admin'],
          ['Connections <code>/admin/marketing/connections</code>', 'Connect Google, Meta and TikTok ad accounts.', 'Admin'],
          ['QR codes <code>/admin/qr</code>', 'Printable QR codes with scan tracking, including kiosk codes.', 'Admin'],
        ] } },
        { task: { title: 'Send an email campaign', roles: ['Admin'], intro: 'Sending needs the campaigns.send permission. Only email clients who opted in.', steps: [
          'Open <code>/admin/marketing/campaigns</code> and press <b>New campaign</b>.',
          'Pick an audience segment, write the subject and body (use the AI suggestions if helpful), and choose a template.',
          'Send a test to yourself first.',
          'Schedule a send time or press <b>Send now</b>.',
        ], done: 'the campaign shows as sent, with opens and clicks updating over the next hours.' } },
        { ktip: 'Send yourself a test first. Always. It is the cheapest way to catch a wrong link or a broken image before 2,000 clients do.' },
        { note: { label: 'Consent matters', note: 'Marketing email and SMS only go to clients who agreed to receive them. Never add people from outside lists. The platform suppresses anyone who bounces or complains automatically.' } },
      ],
    },

    {
      title: 'Finance',
      lead: 'Take payment, see every transaction, plan cash, and run the books with the right controls.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['20%', '62%', '18%'], rows: [
          ['Till / POS <code>/admin/pos</code>', 'Ring up treatments and products, take card or cash, print receipts, refund.', 'Front desk'],
          ['Orders <code>/admin/orders</code>', 'Every sale and receipt. Filter, download and refund.', 'Front desk, Admin'],
          ['Cashflow <code>/admin/cashflow</code>', 'Cash reserves and a forward forecast.', 'Admin, Owner'],
          ['Reports <code>/admin/reports</code>', 'Revenue by period, by clinician and by service; margins and costs.', 'Owner, Admin'],
          ['Financial controls <code>/admin/finance/controls</code>', 'VAT and tax settings, refund policy, audit locks, Xero link.', 'Owner'],
        ] } },
        { task: { title: 'Take a payment at the till', roles: ['Front desk'], steps: [
          'Open <code>/admin/pos</code>.',
          'Search and add the treatment or product to the sale.',
          'Apply any discount, then press <b>Charge</b> and take card or cash.',
          'Offer a printed or emailed receipt.',
        ], done: 'the sale shows in Orders and the takings update day close.' } },
        { ktip: 'Reports stay locked until you unlock them, and unlocking is deliberately slow to brute-force. That is a safety feature, not a fault.' },
        { note: { label: 'Finance is locked by default', note: 'Reports stay locked until unlocked at <code>/admin/finance/unlock</code>, which is rate-limited on purpose. Only finance roles see money figures. The owner holds the controls for VAT, refunds and audit locks.' } },
      ],
    },

    {
      title: 'Administration',
      lead: 'Run the platform itself: launch checks, system health, the issues board, staff accounts, security, the audit log, site settings and integrations. Most of this is owner territory.',
      blocks: [
        { table: { head: ['Screen', 'What it is for', 'For'], widths: ['20%', '62%', '18%'], rows: [
          ['Go live <code>/admin/go-live</code>', 'The pre-launch checklist to point the domain and switch payments live.', 'Owner'],
          ['Status <code>/admin/status</code>', 'Platform health and uptime.', 'Owner, Admin'],
          ['API health <code>/admin/api-health</code>', 'Green/red checks for Stripe, email, AI, Xero and more.', 'Owner, Admin'],
          ['Build &amp; issues <code>/admin/build</code>', 'Bug tracker and backlog; reported problems land here.', 'Admin, Owner'],
          ['Contractors <code>/admin/contractors</code>', 'Check-in and tasks for visiting workers.', 'Admin'],
          ['Staff &amp; access <code>/admin/staff</code>', 'Add people, set roles and fine-tune permissions.', 'Owner'],
          ['Security <code>/admin/security</code>', '2FA policy, sessions, key health and threat monitoring.', 'Owner'],
          ['Activity log <code>/admin/activity</code>', 'Who did what, when — the audit trail.', 'Owner, Admin'],
          ['Site &amp; globals <code>/admin/site</code>', 'Header, footer and navigation for the public site.', 'Admin'],
          ['Locations <code>/admin/locations</code>', 'Set up and manage multiple clinic branches.', 'Owner'],
          ['SEO <code>/admin/seo</code>', 'Search health, page titles and descriptions, on-site search.', 'Admin'],
          ['Redirects <code>/admin/redirects</code>', 'Forward old links to new ones to protect search ranking.', 'Admin'],
          ['Integrations <code>/admin/integrations</code>', 'Connect and check third-party services.', 'Owner'],
          ['Credentials <code>/admin/settings/credentials</code>', 'Store and rotate API keys inside the app.', 'Owner'],
          ['Settings <code>/admin/settings</code>', 'Clinic-wide preferences and feature toggles.', 'Owner'],
        ] } },
        { task: { title: 'Add a new team member', roles: ['Owner'], steps: [
          'Open <code>/admin/staff</code> and press <b>Add staff</b>.',
          'Enter their name and work email and choose a role (for example Front desk or Clinician).',
          'Adjust individual permissions only if they need more or less than the role default.',
          'Save. They get an email to set their password.',
        ], done: 'the person appears in the staff list and can sign in.' } },
        { task: { title: 'Remove access when someone leaves', roles: ['Owner'], steps: [
          'Open <code>/admin/staff</code> and open their profile.',
          'Press <b>Deactivate</b>.',
          'Open <code>/admin/security</code> and force sign-out of all sessions.',
        ], done: 'they can no longer sign in and existing sessions are ended.' } },
      ],
    },

    // ===== PART 3 — FRONT OF HOUSE & CLIENT-FACING =====
    {
      title: 'The public website and booking flow',
      lead: 'What clients see, and what you do behind it. The site turns visitors into bookings; the booking flow saves a card securely and only charges when the service is delivered.',
      blocks: [
        { shot: { src: 'book', device: 'desk', url: 'kclinics.co.uk/book', caption: 'The booking flow runs left to right across the top of the widget.', pins: [ { x: '57%', y: '86%', n: 1 }, { x: '70%', y: '86%', n: 2 }, { x: '87%', y: '86%', n: 3 } ], legend: ['Choose the treatment', 'Pick a time', 'Confirm — card saved, charged only after the visit'] } },
        { h3: 'The client’s journey to a booking' },
        { ul: [
          'They browse treatments and prices, or use the treatment finder quiz at <code>/treatment-finder</code> for a recommendation.',
          'They start a booking at <code>/book</code>, pick a treatment, date and time, and sign in or create a free account (new clients get a welcome discount).',
          'They save a card securely. No money is taken then — only when the treatment is done, with free cancellation up to 24 hours before.',
          'They get a confirmation email with a calendar invite and a link to manage the booking themselves.',
        ] },
        { h3: 'What you watch and do' },
        { ul: [
          'Confirm new requests and consultation enquiries promptly from <code>/admin/consultations</code> and <code>/admin/bookings</code>.',
          'Chase failed payments: the client gets an automatic recovery email; if it is still unpaid after a couple of days, call them.',
          'Send health and consent forms before the appointment so the clinician is ready.',
          'After treatment, the system asks the client for a review automatically. Keep an eye on new ones in <code>/admin/reviews</code>.',
        ] },
        { shot: { src: 'finder', device: 'desk', url: '/treatment-finder', caption: 'The treatment finder quiz suggests treatments for clients who are not sure what they want.' } },
        { ktip: 'No card is charged at booking — only after the treatment, with free cancellation up to 24 hours before. Tell nervous clients that up front.' },
        { note: { label: 'If booking looks down', note: 'If the database is briefly unreachable, the booking page shows a "please call us" message rather than an error, so you can still take the booking by phone and enter it in the admin.' } },
      ],
    },

    {
      title: 'The kiosk and in-clinic screens',
      lead: 'Screens that work for you in the clinic and the window — a self-serve skin and smile check, and live room displays.',
      blocks: [
        { h3: 'The Skin &amp; Smile kiosk' },
        { p: 'A screen in the window or reception shows a QR code. A passer-by scans it, takes a selfie on their own phone, and gets a friendly skin and smile read-out with suggested treatments and a link to book. The photo is handled securely and deleted automatically after 30 days.' },
        { shot: { src: 'kiosk', device: 'phone', url: '/kiosk/display', caption: 'What the window screen shows.', pins: [ { x: '50%', y: '17%', n: 1 }, { x: '50%', y: '63%', n: 2 }, { x: '50%', y: '95%', n: 3 } ], legend: ['Sits on the window screen', 'The client scans with their own phone', 'The code refreshes itself'] } },
        { task: { title: 'Set up and check the kiosk', roles: ['Admin', 'Front desk'], steps: [
          'Mount the screen and point it at <code>/kiosk/display</code> (find the link and QR under <code>/admin/qr</code>).',
          'Check the QR is on screen and the WiFi is stable each morning.',
          'If the screen freezes, reload the page or power-cycle the device.',
        ], done: 'the window screen shows the live QR and scanning opens the check on a phone.' } },
        { h3: 'Room displays' },
        { p: 'Small screens outside treatment rooms show the room, the current client’s first name only, the treatment and the time, plus what is next. They refresh by themselves. Generate a screen link per room under Devices in Operations.' },
        { ktip: 'Glance at the window screen every morning. A frozen QR code books nobody.' },
      ],
    },

    {
      title: 'The client portal',
      lead: 'What clients do for themselves once they have an account, which keeps work off the front desk.',
      blocks: [
        { table: { head: ['Client screen', 'What they can do'], widths: ['28%', '72%'], rows: [
          ['Dashboard <code>/account</code>', 'See their next appointment, points balance and personal offers.'],
          ['Appointments', 'View, add to calendar, reschedule or cancel within the rules.'],
          ['Health forms', 'Complete medical questionnaires before a visit.'],
          ['Invoices', 'Download receipts and invoices.'],
          ['Rewards', 'Track points, find their referral link, redeem points off a visit.'],
          ['Gift cards', 'Add a gift code to their balance.'],
          ['Profile', 'Update details, marketing choices, and request a data export or deletion.'],
        ] } },
        { shot: { src: 'portal-login', device: 'desk', url: 'kclinics.co.uk/account/login', caption: 'Where clients sign in to manage their own bookings, forms and points.' } },
        { p: 'Most of this is self-service. Your job is to make sure forms are completed before treatment and to help anyone who calls in stuck.' },
        { ktip: 'Half of "can you change my appointment" calls can be a 20-second nudge: clients can reschedule themselves from here.' },
      ],
    },

    {
      title: 'Consent, before-photos and clinical safety',
      lead: 'The records that protect the client, the clinician and the business. Treat these as non-negotiable before any treatment.',
      blocks: [
        { ul: [
          'Consent: send the correct consent form before treatment. The client signs on a secure page; the signed record is stored encrypted and cannot be altered.',
          'Health forms: the client completes their medical history before the visit. The clinician reads it from the clinical record.',
          'Before-photos: capture required laser before-photos through the platform, never on a personal phone. They are stored encrypted with the clinical record.',
          'Age policy: age-restricted treatments and products are checked at the point of booking or sale. No ID images are stored.',
        ] },
        { ktip: 'No consent signed, no treatment. If you are not sure which form applies, ask the clinician before you send it.' },
        { note: { label: 'No treatment without consent', note: 'A booking should not be completed until the matching consent is signed and the health form is done. If you are unsure which form applies, ask the clinician before proceeding.' } },
      ],
    },

    // ===== PART 4 — OWNER & COMPLIANCE =====
    {
      title: 'Owner: APIs, tokens and webhooks',
      lead: 'The platform talks to outside services and to itself through a handful of addresses. Each is protected by a secret only you hold. You will rarely touch these once set, but here is what they are.',
      blocks: [
        { table: { head: ['Address', 'What it does', 'Protected by'], widths: ['30%', '44%', '26%'], rows: [
          ['<code>/api/cron/daily</code>', 'Runs the nightly jobs: campaigns, loyalty, retention cleanup, syncs.', '<code>CRON_SECRET</code>'],
          ['<code>/api/cron/dispatch</code>', 'Sends scheduled email through the day.', '<code>CRON_SECRET</code>'],
          ['<code>/api/build/queue</code>', 'The work queue routine sessions read and log findings to.', '<code>BOARD_QUEUE_TOKEN</code>'],
          ['<code>/api/stripe/webhook</code>', 'Stripe tells the platform a payment succeeded or failed.', 'Stripe signature'],
          ['<code>/api/webhooks/resend</code>', 'Email opens, clicks and bounces come back here.', 'Resend signature'],
          ['<code>/api/integrations/yay</code>', 'Phone calls and voicemails are logged here.', '<code>YAY_WEBHOOK_SECRET</code>'],
          ['<code>/api/health</code>', 'A simple "is it up" check. Public, no secret.', 'None'],
        ] } },
        { note: { label: 'Where these are registered', note: 'For Stripe, Resend and yay.com, paste the platform address into that provider’s dashboard as the webhook target, then copy their signing secret back into your hosting settings. The Go-Live guide walks through each one.' } },
      ],
    },

    {
      title: 'Owner: environment variables and secrets',
      lead: 'These are the keys that switch each service on. They live in your hosting settings (Vercel &rarr; k-clinics &rarr; Settings &rarr; Environment Variables) or in <code>/admin/settings/credentials</code>. Keep them out of email and chat.',
      blocks: [
        { h3: 'Core platform (required)' },
        { table: { head: ['Key', 'What it is for'], widths: ['38%', '62%'], rows: [
          ['<code>DATABASE_URL</code>', 'The database connection. The most sensitive secret you hold.'],
          ['<code>ADMIN_JWT_SECRET</code>', 'Signs staff logins. Change it to sign everyone out.'],
          ['<code>CLIENT_JWT_SECRET</code>', 'Signs client-portal logins. Keep different from the admin one.'],
          ['<code>ACADEMY_JWT_SECRET</code>', 'Signs academy trainee logins. Keep different again.'],
          ['<code>NEXT_PUBLIC_SITE_URL</code>', 'Your live web address, used in links and emails.'],
        ] } },
        { h3: 'Health data encryption (required if storing health data)' },
        { table: { head: ['Key', 'What it is for'], widths: ['38%', '62%'], rows: [
          ['<code>HEALTH_ENCRYPTION_KEY</code>', 'Locks health records. Never change it once data exists, except through the proper rotation steps.'],
          ['<code>HEALTH_HMAC_KEY</code>', 'Proves health records have not been tampered with.'],
        ] } },
        { h3: 'Services you switch on as needed' },
        { table: { head: ['Service', 'Keys', 'Used for'], widths: ['18%', '46%', '36%'], rows: [
          ['Stripe', '<code>STRIPE_SECRET_KEY</code>, <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>', 'Card payments and deposits'],
          ['Resend', '<code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code>, <code>RESEND_WEBHOOK_SECRET</code>', 'All email'],
          ['Twilio', '<code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_FROM</code>', 'SMS reminders'],
          ['Anthropic', '<code>ANTHROPIC_API_KEY</code>', 'Kiosk AI, live chat help, marketing copy'],
          ['Vercel Blob', '<code>BLOB_READ_WRITE_TOKEN</code>', 'Image and video uploads'],
          ['Google', '<code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>', 'Calendar sync, reviews, business profile'],
          ['Xero', '<code>XERO_CLIENT_ID</code>, <code>XERO_CLIENT_SECRET</code>', 'Accounting'],
          ['TrueLayer', '<code>TRUELAYER_CLIENT_ID</code>, <code>TRUELAYER_CLIENT_SECRET</code>', 'Live bank balance'],
          ['yay.com', '<code>YAY_WEBHOOK_SECRET</code>', 'Call logging and click-to-dial'],
          ['Cloudflare', '<code>TURNSTILE_SECRET_KEY</code>, <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>', 'Bot protection at login'],
          ['Upstash', '<code>UPSTASH_REDIS_REST_URL</code>, <code>UPSTASH_REDIS_REST_TOKEN</code>', 'Rate limiting and speed'],
          ['Automation', '<code>CRON_SECRET</code>, <code>BOARD_QUEUE_TOKEN</code>', 'Nightly jobs and the work queue'],
        ] } },
        { note: { label: 'Make a strong secret', note: 'For any token or JWT secret, run <code>openssl rand -base64 32</code> and paste the result. Store a copy in a password manager, never in a note or a doc. Keep an offline backup of <code>HEALTH_ENCRYPTION_KEY</code> in particular.' } },
        { ktip: 'You will set these once and rarely touch them again. Keep them in a password manager, never in a chat or an email.' },
      ],
    },

    {
      title: 'Owner: data retention',
      lead: 'The platform deletes old data on a schedule, run by the nightly job. This is what is removed and when. Anything not listed is kept until you delete it.',
      blocks: [
        { table: { head: ['Data', 'Kept for', 'Then'], widths: ['40%', '24%', '36%'], rows: [
          ['Kiosk selfies and results', '30 days', 'Deleted automatically'],
          ['Website session replays', '90 days', 'Deleted automatically'],
          ['Failed-login security events', '90 days', 'Deleted automatically'],
          ['Heatmap clicks and scrolls', '180 days', 'Deleted automatically'],
          ['Loyalty points', '12 months from earning', 'Expired'],
          ['Call recordings and transcripts', '~13 months', 'Number and length kept; recording and transcript scrubbed'],
          ['Signed consent forms', '8 years', 'Deleted (UK clinical norm)'],
          ['Before-photos', '8 years', 'Deleted (UK clinical norm)'],
        ] } },
        { ktip: 'If a kind of data is not in this table, nothing deletes it automatically. Decide a policy and write it into your privacy notice.' },
        { note: { label: 'Your decision to make', note: 'There is no automatic deletion yet for client profiles, bookings, consultations or audit logs — they are kept until removed by hand. Decide a policy (for example, anonymise clients with no visit for five years) and ask for it to be built. Note it in your privacy policy either way.' } },
      ],
    },

    {
      title: 'Owner: GDPR and data protection',
      lead: 'The clinic handles personal and health (special-category) data under UK GDPR. Health records are encrypted, and there are tools to answer access and deletion requests. Here is what to do, and the gaps to be aware of.',
      blocks: [
        { h3: 'Consent' },
        { ul: [
          'Marketing email and SMS only go to clients who gave clear, opt-in consent. Keep a note of when and how each person agreed.',
          'The cookie banner is opt-in with no pre-ticked boxes, and reject is as easy as accept.',
          'For health questionnaires, show a privacy notice and capture separate consent for processing health data, kept apart from marketing consent.',
        ] },
        { ktip: 'An access request starts a one-month clock. Begin it the day it lands, not the day you have time.' },
        { h3: 'Access requests (a client asks for their data)' },
        { task: { title: 'Answer a subject access request', roles: ['Owner'], steps: [
          'Open the client at <code>/admin/clients</code> and choose the export option (a senior role plus a passkey step is required).',
          'The platform produces a readable file of their records, including health data, decrypted for the response.',
          'Send it to the verified client securely, within one month.',
        ], done: 'the client has their data and the export is recorded in the activity log.' } },
        { h3: 'Erasure (a client asks to be deleted)' },
        { task: { title: 'Erase a client’s data', roles: ['Owner'], steps: [
          'Open the client at <code>/admin/clients</code> and choose the privacy / erase option.',
          'Confirm. The platform pseudonymises the profile and hard-deletes health records, photos, consents, reviews and messages in one step, keeping only the minimum billing facts the law requires.',
        ], done: 'the client shows as erased and the action is in the audit log.' } },
        { h3: 'Call recording and other duties' },
        { ul: [
          'Tell callers their call may be recorded (a line in the phone greeting). This is a legal requirement.',
          'Register with the ICO as a data controller if you have not already.',
          'If personal data is ever exposed, assess the risk and report to the ICO within 72 hours where required.',
        ] },
        { note: { label: 'Known gaps to close', note: 'A recent audit flagged items still to do: a stored timestamp and source on each marketing opt-in; a log when clinical data is viewed routinely (not only on export); retention rules for chat, referral and waitlist data; and finishing erasure cover for call records. Track these on the Build board.' } },
      ],
    },

    {
      title: 'Owner: security baseline',
      lead: 'The platform ships with strong defaults — encrypted health data, signed logins, brute-force limits, 2FA, security headers. Your job is to switch on what needs switching on and keep good habits.',
      blocks: [
        { ktip: 'Turn on two-factor for your own login first. You are the biggest target in the building.' },
        { h3: 'Before you go live' },
        { ul: [
          'Generate fresh secrets for every key (do not reuse test values), and store them in a password manager.',
          'Turn on 2FA for your own account and add a passkey. Require 2FA for admins and clinicians.',
          'Point the Stripe, Resend and yay webhooks at the platform and paste their signing secrets back in.',
          'Turn on your hosting firewall and add rate limits to the login addresses.',
          'Confirm the database has automatic nightly backups, and test that a backup actually restores.',
          'Use a read-only database login for any data audit, never the main one.',
        ] },
        { h3: 'Every month' },
        { ul: [
          'Review who has access at <code>/admin/staff</code> and remove anyone who has left.',
          'Check <code>/admin/security</code> for lockouts and unusual login attempts.',
          'Confirm the nightly job ran (the status page shows the last run).',
          'Skim the activity log for exports and deletions.',
        ] },
        { h3: 'Never do this' },
        { ul: [
          'Share an admin login by email, chat or a shared document.',
          'Change <code>HEALTH_ENCRYPTION_KEY</code> without following the rotation steps first — historic health records would become unreadable.',
          'Put a webhook secret in a web address; it belongs in the header or body.',
        ] },
      ],
    },

    // ===== PART 5 — ROADMAP & HELP =====
    {
      title: 'On the roadmap',
      lead: 'Planned features, listed so the team knows what is coming. These are not live yet. Order and timing can change.',
      blocks: [
        { table: { head: ['Coming feature', 'What it will do'], widths: ['34%', '66%'], rows: [
          ['Role-based dashboards <span class="role r-soon">Soon</span>', 'A home screen built around each job — clinicians see prep and rooms, reception sees front-of-house, developers see build and CI.'],
          ['Exceptional appointment view <span class="role r-soon">Soon</span>', 'A guided, step-by-step appointment from check-in to leaving, with optional voice notes that draft the clinical record for the clinician to edit and the client to sign.'],
          ['In-app bookkeeping <span class="role r-soon">Soon</span>', 'Payroll, suppliers, bills and receipts in the admin, linked to Xero.'],
          ['Storefront QR kiosk <span class="role r-soon">Soon</span>', 'The window Skin &amp; Smile kiosk, with share-to-claim discounts and storefront-screen integration.'],
          ['Two-way SMS <span class="role r-soon">Soon</span>', 'Hold a real text conversation with clients, not just one-way reminders.'],
          ['Smart waitlist fill <span class="role r-soon">Soon</span>', 'Automatically offer a cancelled slot to the best-matched waiting client.'],
          ['Memberships &amp; subscriptions <span class="role r-soon">Soon</span>', 'Recurring plans with member benefits and billing.'],
          ['Photo progress timelines <span class="role r-soon">Soon</span>', 'A dated photo history of a client’s results over a course of treatment.'],
          ['Payment plans <span class="role r-soon">Soon</span>', 'Built-in instalments for higher-cost treatments and courses.'],
          ['Clinician mobile app <span class="role r-soon">Soon</span>', 'An installable app for practitioners on the move.'],
          ['No-show prediction <span class="role r-soon">Soon</span>', 'A flag on bookings likely to no-show, so you can confirm them.'],
          ['Security certifications <span class="role r-soon">Soon</span>', 'Cyber Essentials, NHS DSPT, then ISO 27001 and SOC 2 over time.'],
        ] } },
        { p: 'The academy course library also grows on its own: a standing job adds new bite-size training content regularly, so trainees keep getting more without anyone authoring by hand.' },
      ],
    },

    {
      title: 'Glossary and where to get help',
      lead: 'Plain definitions for the words that come up, and who to ask.',
      blocks: [
        { table: { head: ['Word', 'Means'], widths: ['26%', '74%'], rows: [
          ['Admin', 'The staff side of the platform at <code>/admin</code>.'],
          ['Permission', 'A switch that lets a role do one thing (for example, see clinical records).'],
          ['2FA', 'A second login step, like a code or your fingerprint.'],
          ['Passkey', 'Signing in with Face ID or a fingerprint instead of a password.'],
          ['Webhook', 'A message another service sends the platform when something happens.'],
          ['Environment variable', 'A secret key, set in hosting, that switches a service on.'],
          ['Cron / nightly job', 'A task that runs on a schedule, such as the overnight cleanup.'],
          ['SAR', 'Subject access request — a client asking for a copy of their data.'],
          ['NPS', 'A simple 0-10 score of how likely clients are to recommend you.'],
        ] } },
        { h3: 'Getting help' },
        { ul: [
          'Something broken on a screen: use <b>Report a problem</b> (bottom-right) so it is logged with a screenshot.',
          'A "how do I" question: check this manual first, then ask the owner or admin.',
          'A client data request or anything legal: route it to the owner.',
          'Support email: <code>support@kclinics.co.uk</code>.',
        ] },
        { note: { label: 'Keep this current', note: 'This manual is generated from the platform. When features change, regenerate it with <code>node docs/staff-manual/build-pdf.cjs</code> so the team always has the right version.' } },
      ],
    },

  ],
};

module.exports = { CONTENT };
