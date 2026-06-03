import 'server-only';

export type GoLiveStatus = 'ready' | 'action' | 'optional';
export type GoLiveItem = { title: string; status: GoLiveStatus; what: string; how?: string[] };
export type GoLiveGroup = { heading: string; intro: string; items: GoLiveItem[] };

const has = (v?: string | null) => Boolean(v && v.trim());

export async function goLiveChecklist(): Promise<{ groups: GoLiveGroup[]; ready: number; action: number; total: number }> {
  const env = process.env;
  const stripeSecret = env.STRIPE_SECRET_KEY || '';
  const stripeLive = stripeSecret.startsWith('sk_live');
  const stripeReady = has(stripeSecret) && has(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  // A few DB/setting signals (best-effort).
  let services = 0, products = 0, ga4 = false, metaPixel = false, connections = 0, consentTemplates = 0;
  try {
    const { db } = await import('@/lib/db');
    const [svc, prod, conn, tmpl, tracking] = await Promise.all([
      db.service.count({ where: { active: true } }),
      db.product.count(),
      db.externalConnection.count(),
      db.consentTemplate.count(),
      db.setting.findUnique({ where: { key: 'tracking_config' } }),
    ]);
    services = svc; products = prod; connections = conn; consentTemplates = tmpl;
    if (tracking?.value) { const t = JSON.parse(tracking.value); ga4 = has(t.ga4Id); metaPixel = has(t.metaPixelId); }
  } catch { /* DB not reachable at build */ }

  const groups: GoLiveGroup[] = [
    {
      heading: 'Your domain & website address',
      intro: 'Point your web address (e.g. kclinics.co.uk) at the site.',
      items: [
        { title: 'Connect your domain (DNS)', status: 'action', what: 'Make your domain show the new website.', how: ['In your hosting/Vercel project, add your domain.', 'Add the DNS records it gives you at your domain registrar (you’ve got this!).', 'Wait for it to verify (usually minutes, up to a few hours).'] },
      ],
    },
    {
      heading: 'Taking payments (Stripe)',
      intro: 'Lets clients pay deposits, buy gift cards and shop products.',
      items: [
        stripeReady && stripeLive
          ? { title: 'Stripe is live', status: 'ready', what: 'Real payments are switched on.' }
          : stripeReady
            ? { title: 'Switch Stripe to LIVE keys', status: 'action', what: 'You’re currently in test mode — no real money moves.', how: ['In Stripe, toggle to “Live”.', 'Copy your live Publishable key and Secret key.', 'Send them to your developer / add them to the environment as STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.'] }
            : { title: 'Add your Stripe keys', status: 'action', what: 'Needed before you can take any payment.', how: ['Create/sign in to Stripe.', 'Copy your Publishable + Secret keys.', 'Add them to the environment (or send them to your developer).'] },
      ],
    },
    {
      heading: 'Sending emails (Resend)',
      intro: 'Booking confirmations, receipts, gift cards and campaigns.',
      items: [
        has(env.RESEND_API_KEY)
          ? { title: 'Email sending is on', status: 'ready', what: 'Emails will send from the clinic address.' }
          : { title: 'Connect email sending', status: 'action', what: 'Without this, no emails go out.', how: ['Create a Resend account.', 'Verify your sending domain (add the DNS records they give you).', 'Add RESEND_API_KEY to the environment.'] },
        has(env.RESEND_WEBHOOK_SECRET)
          ? { title: 'Email open/click tracking', status: 'ready', what: 'Campaign opens & clicks are tracked.' }
          : { title: 'Turn on email analytics (optional)', status: 'optional', what: 'See opens & clicks on campaigns.', how: ['In Resend, add a webhook to …/api/webhooks/resend.', 'Add RESEND_WEBHOOK_SECRET to the environment.', 'Enable open & click tracking in Resend.'] },
      ],
    },
    {
      heading: 'Clinical data security',
      intro: 'Encrypts health records, consent forms and before-photos.',
      items: [
        has(env.HEALTH_ENCRYPTION_KEY)
          ? { title: 'Health-data encryption key', status: 'ready', what: 'Sensitive records are encrypted at rest.' }
          : { title: 'Add the health-data encryption key', status: 'action', what: 'Required for consent forms, photos & health records.', how: ['Ask your developer to generate and set HEALTH_ENCRYPTION_KEY.'] },
        has(env.CRON_SECRET)
          ? { title: 'Daily automations', status: 'ready', what: 'Reminders, birthdays & data retention run daily.' }
          : { title: 'Enable daily automations', status: 'action', what: 'Powers reminders, win-backs & data clean-up.', how: ['Ask your developer to set CRON_SECRET and the daily schedule.'] },
      ],
    },
    {
      heading: 'Marketing & tracking (optional, but recommended)',
      intro: 'Measure visits, run ads and connect your platforms.',
      items: [
        ga4 || metaPixel
          ? { title: 'Analytics / ad pixels added', status: 'ready', what: 'Your tracking IDs are saved.' }
          : { title: 'Add analytics & ad pixels', status: 'optional', what: 'Track visitors and ad performance.', how: ['Go to SEO & AI search → Tracking & pixels.', 'Paste your GA4, Google Ads and Meta Pixel IDs.'] },
        connections > 0
          ? { title: `${connections} platform connection(s)`, status: 'ready', what: 'Ad/analytics platforms connected.' }
          : { title: 'Connect Google / Meta / TikTok', status: 'optional', what: 'One-click connect your ad accounts.', how: ['Go to Marketing → Connections and follow each card’s guided setup.'] },
        has(env.ANTHROPIC_API_KEY)
          ? { title: 'AI assistant', status: 'ready', what: 'AI consultation & marketing assistant are on.' }
          : { title: 'Enable the AI assistant (optional)', status: 'optional', what: 'AI consultations & campaign help.', how: ['Add ANTHROPIC_API_KEY to the environment.'] },
      ],
    },
    {
      heading: 'Content you control in here',
      intro: 'Final bits to set before launch — all editable in the dashboard.',
      items: [
        services > 0 ? { title: `${services} service(s) priced`, status: 'ready', what: 'Your bookable menu is set.' } : { title: 'Add your services & prices', status: 'action', what: 'So clients can book.', how: ['Go to Services & pricing and import or add your menu.'] },
        { title: 'Approve your consent wording', status: 'action', what: 'Starter wording is in place — review it with your insurer.', how: ['Go to Consent forms.', 'Edit each form’s wording and confirmations.', 'When happy, turn on “Require signed consent” in Settings.'] },
        products > 0 ? { title: `${products} product(s) in the shop`, status: 'ready', what: 'Your shop has stock.' } : { title: 'Add shop products (optional)', status: 'optional', what: 'Only if you’ll sell products.', how: ['Go to Products and add items, prices and stock.'] },
      ],
    },
  ];

  const all = groups.flatMap((g) => g.items);
  return { groups, ready: all.filter((i) => i.status === 'ready').length, action: all.filter((i) => i.status === 'action').length, total: all.length };
}
