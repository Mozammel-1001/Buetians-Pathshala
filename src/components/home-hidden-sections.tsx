import Link from "next/link";
import type { ReactNode } from "react";
import { lines, type SiteContent } from "@/lib/content-schema";

// হোমপেজের যে দুটো অংশ আপাতত বন্ধ: প্ল্যাটফর্ম ("কমপ্লিট ডিজিটাল একাডেমিক প্ল্যাটফর্ম") আর "আমাদের ব্রাঞ্চসমূহ"।
// ফেরাতে app/page.tsx এ import আর ব্যবহারের comment তুলে দিন; লেখা অ্যাডমিন প্যানেলের পুরনো অংশেই থাকে
const green = "text-primary dark:text-primary-fixed";
const delay = (ms: number) => ({ transitionDelay: `${ms}ms` });

function Go({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (/^https?:\/\//.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  return <Link href={href} className={className}>{children}</Link>;
}

export function PlatformSection({ platform }: { platform: SiteContent["platform"] }) {
  return (
    <>
      {(platform.title || platform.image_url) && (
        <section className="mx-auto max-w-[1200px] px-margin-mobile py-10 transition-colors duration-300 md:px-margin-desktop md:py-20">
          <div className="flex flex-col items-center gap-12 rounded-[3rem] border border-outline-variant/30 bg-surface-container-lowest p-8 md:flex-row md:p-16 dark:border-outline-variant/10 dark:bg-inverse-surface">
            <div className="reveal flex-1" style={delay(100)}>
              <h2 className="mb-6 text-5xl leading-tight font-bold tracking-tight text-on-background md:text-6xl md:leading-none dark:text-background">
                {[{ t: platform.title, g: false }, ...lines(platform.highlight).map((t) => ({ t, g: true }))].filter((x) => x.t).map((x, k, all) => (
                  <span key={k}>
                    <span className="kinetic-text"><span className={x.g ? green : ""} style={{ animationDelay: `${0.1 + k * 0.2}s` }}>{x.t}</span></span>
                    {k < all.length - 1 && <br />}
                  </span>
                ))}
              </h2>
              {platform.text && (
                <p className="mb-10 max-w-md text-lg text-on-surface-variant dark:text-surface-variant">
                  {lines(platform.text).map((t, k, all) => (
                    <span key={k}>
                      <span className="kinetic-text"><span style={{ animationDelay: `${0.7 + k * 0.2}s` }}>{t}</span></span>
                      {k < all.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-4">
                {platform.app_label && (
                  <PlatformButton href={platform.app_href} icon="android" className="bg-on-background text-background dark:bg-background dark:text-on-background">{platform.app_label}</PlatformButton>
                )}
                {platform.web_label && (
                  <PlatformButton href={platform.web_href} icon="laptop_mac" className="border-2 border-on-background text-on-background dark:border-background dark:text-background">{platform.web_label}</PlatformButton>
                )}
              </div>
            </div>
            {platform.image_url && (
              <div className="reveal w-full flex-1" style={delay(400)}>
                <div className="card-float h-[400px] w-full md:h-[500px]">
                  <div className="group border-3d relative h-full w-full overflow-hidden rounded-2xl shadow-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element -- অ্যাডমিনের দেওয়া যেকোনো ঠিকানার ছবি */}
                    <img className="h-full w-full object-cover" src={platform.image_url} alt="" loading="lazy" />
                    {platform.chip && (
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-8">
                        <div className="w-fit rounded-lg border border-white/30 bg-white/20 px-4 py-2 text-sm font-bold text-white backdrop-blur-md">{platform.chip}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

export function BranchesSection({ branches }: { branches: SiteContent["branches"] }) {
  return (
    <>
      {branches.items.length > 0 && (
        <section className="mx-auto max-w-[1200px] rounded-[3rem] border border-outline-variant/40 bg-surface-container-low shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] px-margin-mobile py-10 md:py-20 transition-colors duration-300 md:px-margin-desktop dark:border-outline-variant/10 dark:bg-inverse-surface/30">
          <div className="reveal mb-10 text-center">
            <h2 className="text-headline-lg font-bold text-on-background dark:text-background">{branches.title} {branches.highlight && <span className={green}>{branches.highlight}</span>}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {branches.items.map((b, i) => {
              const inner = (
                <div className="tilt-card flex h-full items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 dark:border-outline-variant/10 dark:bg-inverse-surface">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed">
                    <span className="icon text-sm">location_on</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-on-background dark:text-background">{b.name}</h4>
                    {b.address && <p className="text-xs whitespace-pre-line text-on-surface-variant dark:text-surface-variant">{b.address}</p>}
                    {b.phone && <p className="text-xs text-on-surface-variant dark:text-surface-variant">{b.phone}</p>}
                  </div>
                </div>
              );
              return (
                <div key={i} className="reveal h-full" style={delay(Math.min(i, 5) * 100)}>
                  {b.map_url ? <a href={b.map_url} target="_blank" rel="noopener noreferrer" className="block h-full" title="ম্যাপে দেখুন">{inner}</a> : inner}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

// প্ল্যাটফর্ম অংশের বোতাম: লিংক থাকলে খোলে, না থাকলে "শীঘ্রই আসছে"
function PlatformButton({ href, icon, className, children }: { href: string; icon: string; className: string; children: ReactNode }) {
  const cls = `flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-transform hover:scale-105 ${className}`;
  if (!href) return <span className={`${cls} cursor-default`} title="শীঘ্রই আসছে"><span className="icon">{icon}</span>{children}</span>;
  return <Go href={href} className={cls}><span className="icon">{icon}</span>{children}</Go>;
}
