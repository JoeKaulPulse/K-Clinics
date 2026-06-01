import type { Metadata } from 'next';
import { KVision } from '@/components/ai/KVision';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'K Vision — AI Skin, Smile & Hair Consultation | K Clinics',
  description:
    'Upload a photo and let K Vision, our AI consultation, analyse your skin, smile and hair and build a personalised, bookable treatment plan in seconds. Free with a K Clinics account.',
  path: '/ai-consultation',
  keywords: ['AI skin analysis London', 'AI consultation aesthetics', 'personalised treatment plan'],
});

export const dynamic = 'force-dynamic';

export default async function AiConsultationPage() {
  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getSetting } = await import('@/lib/settings');
  const [client, enabled] = await Promise.all([getCurrentClient().catch(() => null), getSetting('ai_consultation_enabled').catch(() => true)]);

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'K Vision', path: '/ai-consultation' }])} />
      <KVision signedIn={!!client} firstName={client?.firstName ?? ''} enabled={enabled} />
    </>
  );
}
