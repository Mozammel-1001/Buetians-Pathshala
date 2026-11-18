"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CopyButton } from "./copy-button";

// সাইন আপ শেষে স্বাগত বার্তা: ?welcome=BP-1001 থাকলে যেকোনো পাতায় খোলে। আইডি বড় করে, কপির বোতাম,
// রঙিন কাগজ উড়ে পড়ে। বন্ধ করলে ঠিকানা থেকে welcome সরে যায় (রিলোডে আবার আসে না)
const COLORS = ["#10b981", "#006c49", "#fbbf24", "#f472b6", "#60a5fa", "#a78bfa"];
const PIECES = Array.from({ length: 42 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 90) / 100,
  dur: 2.2 + ((i * 29) % 15) / 10,
  rot: (i * 47) % 360,
  color: COLORS[i % COLORS.length],
  w: 6 + (i % 3) * 2,
  round: i % 4 === 0,
}));

export function WelcomeModal() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const code = params.get("welcome");
  const valid = !!code && /^BP-\d{4,7}$/.test(code);
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (valid && d && !d.open) {
      d.showModal();
      setShown(code);
    }
  }, [valid, code]);

  const close = () => {
    ref.current?.close();
    const rest = new URLSearchParams(params.toString());
    rest.delete("welcome");
    router.replace(pathname + (rest.size ? `?${rest}` : ""), { scroll: false });
  };

  if (!valid && !shown) return null;
  const id = shown ?? code ?? "";
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); close(); }} aria-labelledby="welcome-title"
      className="welcome-dialog m-auto w-[min(92vw,460px)] overflow-visible bg-transparent p-0 backdrop:bg-on-background/60 backdrop:backdrop-blur-sm">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {PIECES.map((p, i) => (
          <span key={i} className="confetti" style={{
            left: `${p.left}%`, width: p.w, height: p.round ? p.w : p.w * 1.6, background: p.color,
            borderRadius: p.round ? "50%" : 2, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, rotate: `${p.rot}deg`,
          }} />
        ))}
      </div>
      <div className="pop-in card relative overflow-hidden p-7 text-center md:p-9">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/15 to-transparent" aria-hidden="true" />
        <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30">
          <svg viewBox="0 0 52 52" className="h-11 w-11" aria-hidden="true">
            <path className="check-draw" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-17" />
          </svg>
        </div>
        <h2 id="welcome-title" className="relative mt-5 text-2xl font-bold">অভিনন্দন! অ্যাকাউন্ট চালু হয়েছে 🎉</h2>
        <p className="relative mt-1 text-sm muted">বুয়েটিয়ান&apos;স পাঠশালায় আপনাকে স্বাগতম।</p>

        <div className="relative mt-6 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-5">
          <p className="text-xs font-bold tracking-wide muted">আপনার আইডি</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-wider text-primary dark:text-primary-fixed" data-testid="welcome-id">{id}</p>
          <CopyButton text={id} label="আইডি কপি করুন" className="mt-3" />
        </div>
        <p className="relative mt-4 text-sm muted">
          পরে লগইনের সময় এই <b>আইডি</b> বা আপনার <b>মোবাইল নম্বর</b>, যেকোনোটা দিলেই হবে। আইডিটা লিখে বা স্ক্রিনশট নিয়ে রাখুন।
        </p>
        <div className="relative mt-6 grid gap-2 sm:grid-cols-2">
          <Link href="/#courses" onClick={() => ref.current?.close()} className="btn-ghost py-3!">কোর্স দেখুন</Link>
          <button type="button" onClick={close} className="btn-primary py-3!" autoFocus>শুরু করুন</button>
        </div>
      </div>
    </dialog>
  );
}
