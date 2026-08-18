import { latestNews } from '@/lib/google-business';
import { SectionHeading } from '@/components/ui/Section';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';

/**
 * Latest News (BLD-481) — the clinic's Google Business Profile "From the
 * Business" posts, mirrored automatically by the daily cron so anything the
 * team publishes on Google appears here with no manual re-entry. Renders
 * nothing until posts exist, so the homepage is unchanged until the first
 * post syncs. Images come from Google's CDN (not in next/image's
 * remotePatterns), so they render as plain lazy <img> tags.
 */
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const TOPIC_LABEL: Record<string, string> = { STANDARD: 'News', EVENT: 'Event', OFFER: 'Offer', ALERT: 'Notice' };

export async function LatestNews() {
  const posts = await latestNews(3);
  if (!posts.length) return null;

  return (
    <section className="container-lux py-20 md:py-28">
      <SectionHeading eyebrow="From the clinic" title="Latest news" />
      <Stagger className="mt-10 grid gap-6 md:grid-cols-3">
        {posts.map((p) => {
          const href = p.ctaUrl || p.searchUrl;
          const body = (
            <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)]">
              {p.mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- Google CDN host isn't in next/image remotePatterns
                <img src={p.mediaUrl} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-6">
                <p className="eyebrow mb-3 text-[var(--color-gold-deep)]">
                  {TOPIC_LABEL[p.topicType || 'STANDARD'] || 'News'}
                  {p.createTime && <span className="ml-2 normal-case tracking-normal text-[var(--color-stone)]">· {fmtDate(p.createTime)}</span>}
                </p>
                {p.summary && <p className="flex-1 whitespace-pre-line text-[var(--color-ink-soft)]">{p.summary.length > 220 ? `${p.summary.slice(0, 220)}…` : p.summary}</p>}
                {href && <span className="link-underline mt-4 inline-block text-sm font-medium text-[var(--color-gold-deep)]">Read more</span>}
              </div>
            </article>
          );
          return (
            <StaggerItem key={p.googleName}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">{body}</a>
              ) : body}
            </StaggerItem>
          );
        })}
      </Stagger>
      <Reveal>
        <p className="mt-6 text-sm text-[var(--color-stone)]">Posted via our Google Business Profile — updated automatically.</p>
      </Reveal>
    </section>
  );
}
