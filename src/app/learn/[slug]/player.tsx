"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bn } from "@/lib/content-schema";
import { markLessonDone, saveLessonBookmark, saveLessonNote } from "./actions";

// online_class.html হুবহু: YouTube প্লেয়ার নিজের নিয়ন্ত্রণসহ (চালু/থামা, ১০ সেকেন্ড আগে-পিছে, শব্দ, সময়, ক্যাপশন,
// গতি/রেজোলিউশন, পুরো পর্দা ও landscape), দুবার চাপলে আগে-পিছে, কীবোর্ড (Space/K, ← →, ↑ ↓, M, F),
// ৫ সেকেন্ড পর নিয়ন্ত্রণ লুকায়; নোট/বুকমার্ক/কপিরাইট ট্যাব; পাশে মডিউল (অধ্যায়) আর লেকচার, খোঁজা
// [PRODUCTION] ভিডিও আসবে Bunny থেকে (lessons.bunny_video_id); এখনো সেটা তৈরি হয়নি, তাই সব লেকচারে নমুনা ভিডিও

export type Lesson = { id: number; title: string; label: string; seconds: number; ready: boolean; done: boolean };
export type Module = { id: number; title: string; lessons: Lesson[] };

const SAMPLE_VIDEO = "UXFCpSef2pU";
// কোর্সে এখনো লেকচার না থাকলে ডিজাইন দেখানোর জন্য ডেমোর মডিউল
const L = (id: number, label: string, title: string, seconds: number, extra: Partial<Lesson> = {}): Lesson => ({ id, label, title, seconds, ready: true, done: false, ...extra });
const SAMPLE: Module[] = [
  { id: -1, title: "CS101: কম্পিউটার সায়েন্স এবং ওয়েব আর্কিটেকচার পরিচিতি", lessons: [L(-11, "লেকচার ১.১", "ওয়েব টপোলজি", 480)] },
  { id: -2, title: "CS102: কোর্স ওরিয়েন্টেশন এবং পেডাগোজিক্যাল উদ্দেশ্য", lessons: [L(-21, "লেকচার ২.১", "সিলেবাস পর্যালোচনা", 2700), L(-22, "লেকচার ২.২", "গ্রেডিং রুব্রিক", 2700), L(-23, "লেকচার ২.৩", "একাডেমিক ইন্টিগ্রিটি", 3120)] },
  { id: -3, title: "CS301: অ্যাডভান্সড এপিআই ইন্টিগ্রেশন ও অ্যাসিনক্রোনাস রেন্ডারিং", lessons: [L(-31, "লেকচার ৩৩.১", "প্রমিস আর্কিটেকচার", 10800, { done: true }), L(-32, "লেকচার ৩৩.২", "এরর বাউন্ডারি হ্যান্ডলিং", 10800, { done: true }), L(-33, "লেকচার ৩৩.৩", "অ্যাসিনক্রোনাস ডেটা ফেচিং", 10800), L(-34, "লেকচার ৩৩.৪", "অপটিমিস্টিক ইউআই আপডেট", 8940, { ready: false })] },
  { id: -4, title: "CS401: এন্টারপ্রাইজ স্কেলেবিলিটি এবং ক্লাউড ডিপ্লয়মেন্ট", lessons: [L(-41, "লেকচার ৪১.১", "লোড ব্যালেন্সিং", 7800, { ready: false }), L(-42, "লেকচার ৪১.২", "ডকার কনটেইনারাইজেশন", 7800, { ready: false }), L(-43, "লেকচার ৪১.৩", "কুবারনেটিস", 7800, { ready: false }), L(-44, "লেকচার ৪১.৪", "সিআই/সিডি", 7800, { ready: false }), L(-45, "লেকচার ৪১.৫", "মনিটরিং", 7740, { ready: false })] },
];

// লেখার সরঞ্জাম: [আইকন, আগে, পরে, লাইনের শুরুতে]
const TOOLS: [string, string, string, boolean][] = [["format_bold", "**", "**", false], ["format_italic", "_", "_", false], ["strikethrough_s", "~~", "~~", false], ["link", "[", "](https://)", false], ["code", "`", "`", false], ["format_list_bulleted", "\n- ", "", true], ["format_list_numbered", "\n1. ", "", true]];
const hm = (s: number) => `${bn(Math.floor(s / 3600))} ঘ ${bn(Math.floor((s % 3600) / 60))} মি`;
const mmss = (s: number) => { if (!isFinite(s)) return "০:০০"; const m = Math.floor(s / 60), x = Math.floor(s % 60); return `${bn(m)}:${x < 10 ? "০" : ""}${bn(x)}`; };
const short = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------- YouTube IFrame API (একবার লোড) ----------
type YTPlayer = {
  getPlayerState: () => number; playVideo: () => void; pauseVideo: () => void; seekTo: (s: number, a: boolean) => void; getCurrentTime: () => number; getDuration: () => number;
  getVolume: () => number; setVolume: (v: number) => void; mute: () => void; unMute: () => void; isMuted: () => boolean; setPlaybackRate: (r: number) => void;
  loadModule: (m: string) => void; unloadModule: (m: string) => void; setOption: (m: string, k: string, v: unknown) => void; destroy: () => void;
};
type YTNs = { Player: new (el: HTMLElement, o: unknown) => YTPlayer; PlayerState: { PLAYING: number; ENDED: number } };
const W = () => window as unknown as { YT?: YTNs; onYouTubeIframeAPIReady?: () => void };
let ytLoading: Promise<YTNs> | null = null;
function loadYT(): Promise<YTNs> {
  if (W().YT?.Player) return Promise.resolve(W().YT!);
  if (!ytLoading) ytLoading = new Promise((res) => {
    const prev = W().onYouTubeIframeAPIReady;
    W().onYouTubeIframeAPIReady = () => { prev?.(); res(W().YT!); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  });
  return ytLoading;
}

// ---------- টোস্ট (ডেমোর toast-modal আর warning-modal) ----------
function useOcToast() {
  const [t, setT] = useState<{ msg: string; warn: boolean; on: boolean; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, warn = false) => {
    if (timer.current) clearTimeout(timer.current);
    setT({ msg, warn, on: true, key: Math.random() });
    timer.current = setTimeout(() => setT((x) => (x ? { ...x, on: false } : x)), 3000);
  }, []);
  const hide = () => setT((x) => (x ? { ...x, on: false } : x));
  const node = t && (t.warn ? (
    <div key={t.key} className={`fixed top-20 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 overflow-hidden rounded-lg border border-error/20 bg-error/10 px-4 py-3 shadow-2xl backdrop-blur-md sm:w-max md:top-28 md:right-10 md:min-w-[320px] md:gap-4 md:px-6 md:py-4 ${t.on ? "oc-toast-in" : "oc-toast-out"}`} role="alert">
      <span className="icon rounded-full bg-error p-1 text-[18px] text-white md:text-[20px]">warning</span>
      <span className="grow text-sm font-bold text-error md:text-base">{t.msg}</span>
      <button type="button" onClick={hide} aria-label="বন্ধ" className="flex items-center text-error/70 transition-colors hover:text-error"><span className="icon text-[20px] md:text-[24px]">close</span></button>
      <div className="oc-progress absolute bottom-0 left-0 h-1 w-full bg-error" />
    </div>
  ) : (
    <div key={t.key} className={`fixed top-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 overflow-hidden rounded-lg border border-outline-variant/20 bg-inverse-surface px-4 py-3 shadow-2xl sm:w-max md:top-10 md:right-10 md:min-w-[320px] md:gap-4 md:px-6 md:py-4 ${t.on ? "oc-toast-in" : "oc-toast-out"}`} role="status">
      <span className="icon rounded-full bg-emerald-500 p-1 text-[18px] text-white md:text-[20px]">check</span>
      <span className="grow text-sm font-bold text-background md:text-base">{t.msg}</span>
      <button type="button" onClick={hide} aria-label="বন্ধ" className="flex items-center text-surface-variant transition-colors hover:text-white"><span className="icon text-[20px] md:text-[24px]">close</span></button>
      <div className="oc-progress absolute bottom-0 left-0 h-1 w-full bg-emerald-500" />
    </div>
  ));
  return [show, node] as const;
}

export function Player({ course, modules: real, currentId }: { course: { slug: string; title: string; thumb: string | null }; modules: Module[]; currentId: number | null }) {
  const router = useRouter();
  const sample = real.length === 0;
  const modules = sample ? SAMPLE : real;
  const all = modules.flatMap((m) => m.lessons);
  const cur = sample ? all.find((l) => l.id === -33)! : all.find((l) => l.id === currentId) ?? all[0];
  const curMod = modules.find((m) => m.lessons.some((l) => l.id === cur.id))!;
  const idx = all.findIndex((l) => l.id === cur.id);
  const [toast, toastNode] = useOcToast();

  // ---------- প্লেয়ার ----------
  const box = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null), yt = useRef<YTPlayer | null>(null), YTr = useRef<YTNs | null>(null);
  const [ready, setReady] = useState(false), [state, setState] = useState(-1), [started, setStarted] = useState(false), [loading, setLoading] = useState(false);
  const [time, setTime] = useState({ cur: 0, dur: 0 }), [vol, setVol] = useState(100), [muted, setMuted] = useState(false);
  const [showCtl, setShowCtl] = useState(false), [cc, setCc] = useState(false), [menu, setMenu] = useState(false), [speed, setSpeed] = useState(1), [res, setRes] = useState("720p");
  const [anim, setAnim] = useState<{ icon: string; k: number } | null>(null);
  const ctlTimer = useRef<ReturnType<typeof setTimeout> | null>(null), clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null), lastTap = useRef(0);
  const doneSent = useRef(false);

  const pop = useCallback((icon: string) => { setAnim({ icon, k: Math.random() }); setTimeout(() => setAnim(null), 500); }, []);
  const playing = () => !!yt.current && YTr.current && yt.current.getPlayerState() === YTr.current.PlayerState.PLAYING;
  const reveal = useCallback(() => {
    setShowCtl(true);
    if (ctlTimer.current) clearTimeout(ctlTimer.current);
    ctlTimer.current = setTimeout(() => { if (yt.current && YTr.current && yt.current.getPlayerState() === YTr.current.PlayerState.PLAYING) setShowCtl(false); }, 5000);
  }, []);
  const togglePlay = useCallback(() => {
    const p = yt.current, Y = YTr.current; if (!p || !Y) return;
    const s = p.getPlayerState();
    if (s === Y.PlayerState.PLAYING) p.pauseVideo();
    else { setLoading(true); if (s === Y.PlayerState.ENDED) p.seekTo(0, true); p.playVideo(); }
  }, []);
  const seek = useCallback((d: number) => { const p = yt.current; if (!p) return; p.seekTo(p.getCurrentTime() + d, true); pop(d > 0 ? "fast_forward" : "fast_rewind"); }, [pop]);
  const setVolume = useCallback((v: number) => {
    const p = yt.current; if (!p) return;
    p.setVolume(v); setVol(v);
    if (v > 0) { p.unMute(); setMuted(false); } else { p.mute(); setMuted(true); }
  }, []);
  const toggleMute = useCallback(() => {
    const p = yt.current; if (!p) return;
    if (p.isMuted()) { p.unMute(); setMuted(false); setVol(p.getVolume()); pop("volume_up"); }
    else { p.mute(); setMuted(true); setVol(0); pop("volume_off"); }
  }, [pop]);
  const toggleFull = useCallback(() => {
    const el = box.current; if (!el) return;
    type O = ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (!document.fullscreenElement) el.requestFullscreen?.().then(() => { const o = screen.orientation as O; o?.lock?.("landscape-primary").catch(() => o.lock?.("landscape").catch(() => {})); }).catch(() => {});
    else document.exitFullscreen?.().then(() => { try { screen.orientation?.unlock?.(); } catch { /* ignore */ } });
  }, []);

  useEffect(() => {
    let dead = false, tick: ReturnType<typeof setInterval> | null = null;
    loadYT().then((Y) => {
      if (dead || !host.current) return;
      YTr.current = Y;
      const el = document.createElement("div"); el.className = "h-full w-full"; host.current.innerHTML = ""; host.current.appendChild(el);
      yt.current = new Y.Player(el, {
        height: "100%", width: "100%", videoId: SAMPLE_VIDEO,
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => { setReady(true); setShowCtl(true); setTime({ cur: 0, dur: yt.current!.getDuration() }); },
          onStateChange: (ev: { data: number }) => {
            setState(ev.data);
            if (tick) { clearInterval(tick); tick = null; }
            if (ev.data === Y.PlayerState.PLAYING) {
              setLoading(false); setStarted(true);
              tick = setInterval(() => { const p = yt.current; if (p) setTime({ cur: p.getCurrentTime(), dur: p.getDuration() }); }, 500);
            } else if (ev.data === Y.PlayerState.ENDED) {
              setStarted(false);
              // দেখা শেষ: অগ্রগতি সেভ (নমুনা লেকচারে নয়)
              if (!sample && !doneSent.current) { doneSent.current = true; markLessonDone({ lessonId: cur.id, seconds: yt.current?.getDuration() ?? 0 }).then(() => router.refresh()); }
            }
          },
        },
      });
    });
    return () => { dead = true; if (tick) clearInterval(tick); try { yt.current?.destroy(); } catch { /* ignore */ } yt.current = null; };
  }, [cur.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // কীবোর্ড (লেখার ঘরে নয়)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
      const p = yt.current; if (!p || !ready) return;
      switch (e.code) {
        case "Space": case "KeyK": e.preventDefault(); pop(playing() ? "pause" : "play_arrow"); togglePlay(); break;
        case "ArrowRight": e.preventDefault(); seek(10); break;
        case "ArrowLeft": e.preventDefault(); seek(-10); break;
        case "ArrowUp": e.preventDefault(); setVolume(Math.min(100, p.getVolume() + 5)); pop("volume_up"); break;
        case "ArrowDown": { e.preventDefault(); const v = Math.max(0, p.getVolume() - 5); setVolume(v); pop(v === 0 ? "volume_off" : "volume_down"); break; }
        case "KeyM": e.preventDefault(); toggleMute(); break;
        case "KeyF": e.preventDefault(); toggleFull(); break;
      }
    };
    const out = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-settings]")) setMenu(false); };
    document.addEventListener("keydown", k); document.addEventListener("click", out);
    return () => { document.removeEventListener("keydown", k); document.removeEventListener("click", out); };
  }, [ready, pop, seek, setVolume, toggleMute, toggleFull, togglePlay]);

  // YouTube এর অবস্থা: ১ = চলছে, ০ = শেষ
  const isPlaying = ready && state === 1;
  const isEnded = ready && state === 0;
  const pct = time.dur > 0 ? (time.cur / time.dur) * 100 : 0;
  const ctlOpacity = showCtl || !isPlaying ? 1 : 0;

  // ---------- ট্যাব, নোট, বুকমার্ক ----------
  const [tab, setTab] = useState<"notes" | "bookmarks" | "copyright">("notes");
  const [note, setNote] = useState({ title: "", body: "" }), [bm, setBm] = useState({ title: "", note: "" });
  const [busy, setBusy] = useState(false);
  const saveNote = async () => {
    if (!note.title.trim()) { toast("নোটের শিরোনাম ফাঁকা রাখা যাবে না।", true); return; }
    if (sample) { toast("নোট নিরাপদে ক্লাউডে সেভ করা হয়েছে।"); return; }
    setBusy(true);
    const r = await saveLessonNote({ lessonId: cur.id, title: note.title, body: note.body, at: yt.current?.getCurrentTime() ?? 0 });
    setBusy(false);
    if (r.error) toast(r.error, true); else { toast("নোট নিরাপদে ক্লাউডে সেভ করা হয়েছে।"); setNote({ title: "", body: "" }); }
  };
  const saveBm = async () => {
    if (!bm.title.trim()) { toast("বুকমার্কের শিরোনাম আবশ্যক।", true); return; }
    if (sample) { toast("বুকমার্ক সফলভাবে তৈরি হয়েছে।"); return; }
    setBusy(true);
    const r = await saveLessonBookmark({ lessonId: cur.id, title: bm.title, note: bm.note });
    setBusy(false);
    if (r.error) toast(r.error, true); else { toast("বুকমার্ক সফলভাবে তৈরি হয়েছে।"); setBm({ title: "", note: "" }); }
  };
  // লেখার সরঞ্জাম: বাছাই করা লেখার দুপাশে মার্কডাউন চিহ্ন
  const ta = useRef<HTMLTextAreaElement>(null);
  const wrap = (a: string, b = a, line = false) => {
    const t = ta.current; if (!t) return;
    const s = t.selectionStart, e = t.selectionEnd, v = note.body;
    const next = line ? v.slice(0, s) + a + v.slice(s) : v.slice(0, s) + a + v.slice(s, e) + b + v.slice(e);
    setNote((n) => ({ ...n, body: next }));
    requestAnimationFrame(() => { t.focus(); t.setSelectionRange(s + a.length, e + a.length); });
  };

  const go = (l: Lesson | undefined, msg: string) => {
    if (!l) { toast(msg.startsWith("পূর্ব") ? "এটাই প্রথম লেকচার" : "এটাই শেষ লেকচার", true); return; }
    if (!l.ready) { toast("এই লেকচারটি এখনো খোলা হয়নি", true); return; }
    toast(msg);
    if (!sample) setTimeout(() => router.push(`/learn/${course.slug}?lesson=${l.id}`, { scroll: false }), 400);
  };

  // ---------- মডিউল ----------
  const [open, setOpen] = useState<Set<number>>(() => new Set([curMod.id]));
  const [q, setQ] = useState("");
  const fold = (s: string) => s.normalize("NFC").replace(/[‌‍]/g, "").toLowerCase();
  const shown = modules.map((m) => ({ ...m, lessons: q.trim() ? m.lessons.filter((l) => fold(`${l.label} ${l.title} ${m.title}`).includes(fold(q.trim()))) : m.lessons })).filter((m) => !q.trim() || m.lessons.length);
  const doneAll = all.filter((l) => l.done).length;
  const thumb = course.thumb || `https://img.youtube.com/vi/${SAMPLE_VIDEO}/mqdefault.jpg`;
  const tabBtn = (k: typeof tab, icon: string, label: string) => (
    <button type="button" onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 px-2 pb-3 text-sm font-bold whitespace-nowrap transition-colors md:gap-2 md:text-base ${tab === k ? "-mb-[2px] border-b-2 border-primary text-primary dark:border-primary-fixed dark:text-primary-fixed" : "text-on-surface-variant hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed"}`}>
      <span className="icon text-[18px] md:text-[20px]">{icon}</span> {label}
    </button>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1440px] grow flex-col gap-4 px-4 pt-2.5 pb-6 md:px-8 md:pt-5 md:pb-12 lg:flex-row lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between border-b border-outline-variant/20 pb-2 md:mb-4 md:pb-4 dark:border-outline-variant/10">
          <div className="flex flex-col">
            <h1 className="line-clamp-2 text-lg font-bold md:text-2xl">{sample ? curMod.title : course.title}</h1>
            <span className="mt-1 text-sm font-medium text-on-surface-variant dark:text-surface-variant">{cur.label}: {cur.title}</span>
          </div>
          <div className="flex shrink-0 gap-4">
            <Link href="/notes" aria-label="আমার নোট" className="text-on-surface-variant transition-colors hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed"><span className="icon text-[28px]">description</span></Link>
            <Link href="/bookmarks" aria-label="আমার বুকমার্ক" className="text-on-surface-variant transition-colors hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed"><span className="icon text-[28px]">bookmark</span></Link>
          </div>
        </div>

        {sample && <p className="mb-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 md:mb-3 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200"><span className="icon text-[16px]">science</span>এই কোর্সে এখনো লেকচার যোগ হয়নি। ডিজাইন দেখানোর জন্য নমুনা লেকচার; নোট বা বুকমার্ক সেভ হবে না।</p>}

        {/* ভিডিও */}
        <div ref={box} className="group relative -mx-4 aspect-video w-[calc(100%+32px)] cursor-pointer overflow-hidden rounded-none border-y border-outline-variant/20 bg-black shadow-lg md:mx-0 md:w-full md:rounded-xl md:border dark:border-outline-variant/10"
          onMouseMove={reveal}
          onTouchStart={(e) => {
            reveal();
            if ((e.target as HTMLElement).closest("[data-ctl]")) return;
            const now = new Date().getTime(), d = now - lastTap.current;
            if (d < 400 && d > 0) { const r = box.current!.getBoundingClientRect(); seek(e.touches[0].clientX - r.left < r.width / 2 ? -10 : 10); }
            lastTap.current = now;
          }}
          onClick={(e) => {
            reveal();
            if ((e.target as HTMLElement).closest("[data-ctl]") || !window.matchMedia("(pointer: fine)").matches) return;
            if (e.detail === 1) clickTimer.current = setTimeout(() => { pop(playing() ? "pause" : "play_arrow"); togglePlay(); }, 250);
            else if (e.detail === 2) { if (clickTimer.current) clearTimeout(clickTimer.current); const r = box.current!.getBoundingClientRect(); seek(e.clientX - r.left < r.width / 2 ? -10 : 10); }
          }}>
          <div ref={host} className="pointer-events-none h-full w-full" />

          <div className={`absolute inset-0 z-30 flex items-center justify-center bg-black bg-cover bg-center transition-opacity duration-500 ${started && !isEnded ? "pointer-events-none opacity-0" : ""}`}
            style={{ backgroundImage: `url('https://img.youtube.com/vi/${SAMPLE_VIDEO}/maxresdefault.jpg')` }} data-ctl onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
            <button type="button" aria-label="চালু করুন" className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 shadow-xl backdrop-blur-sm transition-transform hover:scale-110 md:h-20 md:w-20 dark:bg-primary-fixed/90">
              <span className="icon text-4xl text-white md:text-5xl dark:text-on-primary-fixed">play_arrow</span>
            </button>
          </div>

          {loading && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <svg className="h-12 w-12 animate-spin text-primary md:h-16 md:w-16 dark:text-primary-fixed" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
          </div>}

          {anim && <div key={anim.k} className="animate-pop-fade pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 md:h-20 md:w-20"><span className="icon text-4xl text-white drop-shadow-md md:text-5xl">{anim.icon}</span></div>
          </div>}

          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300" style={{ opacity: ready ? ctlOpacity : 0 }}>
            <button type="button" data-ctl aria-label={isPlaying ? "থামান" : "চালু করুন"} onClick={(e) => { e.stopPropagation(); pop(isPlaying ? "pause" : "play_arrow"); togglePlay(); }}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/70 md:h-16 md:w-16">
              <span className="icon text-3xl text-white md:text-4xl">{isEnded ? "replay" : isPlaying ? "pause" : "play_arrow"}</span>
            </button>
          </div>

          <div data-ctl onClick={(e) => e.stopPropagation()} className="absolute right-0 bottom-0 left-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 transition-opacity duration-300 md:p-4" style={{ opacity: ready ? ctlOpacity : 0 }}>
            <div className="relative flex h-2 w-full cursor-pointer items-center">
              <input type="range" aria-label="ভিডিওর সময়" className="oc-range absolute inset-0 z-20 m-0 w-full opacity-0" min={0} max={100} step={0.1} value={pct}
                onChange={(e) => { const p = yt.current; if (!p) return; const t = p.getDuration() * (+e.target.value / 100); p.seekTo(t, true); setTime({ cur: t, dur: p.getDuration() }); }} />
              <div className="pointer-events-none relative z-10 h-1 w-full overflow-hidden rounded-full bg-white/30"><div className="h-full bg-primary-fixed" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="mt-1 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 md:gap-4">
                <button type="button" aria-label="চালু/থামা" className="transition-colors hover:text-primary-fixed" onClick={togglePlay}><span className="icon text-2xl md:text-3xl">{isEnded ? "replay" : isPlaying ? "pause" : "play_arrow"}</span></button>
                <button type="button" aria-label="১০ সেকেন্ড পেছনে" className="hidden transition-colors hover:text-primary-fixed sm:block" onClick={() => seek(-10)}><span className="icon text-xl">fast_rewind</span></button>
                <button type="button" aria-label="১০ সেকেন্ড সামনে" className="hidden transition-colors hover:text-primary-fixed sm:block" onClick={() => seek(10)}><span className="icon text-xl">fast_forward</span></button>
                <div className="group/volume relative flex items-center">
                  <button type="button" aria-label="শব্দ" className="flex items-center transition-colors hover:text-primary-fixed" onClick={toggleMute}><span className="icon text-lg md:text-xl">{muted || vol === 0 ? "volume_off" : "volume_up"}</span></button>
                  <div className="flex w-0 items-center overflow-hidden opacity-0 transition-all duration-300 group-hover/volume:ml-2 group-hover/volume:w-16 group-hover/volume:opacity-100 md:group-hover/volume:ml-3 md:group-hover/volume:w-20">
                    <div className="relative flex h-2 w-full cursor-pointer items-center">
                      <input type="range" aria-label="শব্দের মাত্রা" className="oc-range absolute inset-0 z-20 m-0 w-full cursor-pointer opacity-0" min={0} max={100} value={vol} onChange={(e) => setVolume(+e.target.value)} />
                      <div className="pointer-events-none relative z-10 h-1.5 w-full overflow-hidden rounded-full bg-white/30"><div className="h-full rounded-full bg-primary-fixed transition-all duration-150" style={{ width: `${vol}%` }} /></div>
                    </div>
                  </div>
                </div>
                <span className="pointer-events-none ml-1 text-xs font-bold whitespace-nowrap md:ml-3 md:text-sm">{mmss(time.cur)} / {mmss(time.dur)}</span>
              </div>
              <div className="relative flex items-center gap-3 md:gap-4">
                <button type="button" aria-label="ক্যাপশন" className={`transition-colors hover:text-primary-fixed ${cc ? "text-primary-fixed" : ""}`}
                  onClick={() => { const p = yt.current; if (!p) return; const on = !cc; setCc(on); if (on) { p.loadModule("captions"); p.setOption("captions", "track", { languageCode: "bn" }); toast("ক্যাপশন চালু হয়েছে"); } else { p.unloadModule("captions"); toast("ক্যাপশন বন্ধ হয়েছে"); } }}>
                  <span className="icon text-lg md:text-xl">closed_caption</span></button>
                <div className="relative" data-settings>
                  <button type="button" aria-label="সেটিংস" className="transition-colors hover:text-primary-fixed" onClick={() => setMenu((m) => !m)}><span className="icon text-lg md:text-xl">settings</span></button>
                  {menu && (
                    <div className="custom-scrollbar absolute right-0 bottom-full z-50 mb-3 flex max-h-[160px] min-w-[120px] flex-col gap-2 overflow-y-auto rounded-md border border-outline-variant/20 bg-inverse-surface p-2 shadow-lg md:max-h-[300px]">
                      <div className="border-b border-outline-variant/20 pb-1 text-xs font-bold text-surface-variant">গতি</div>
                      {([[0.5, "০.৫x"], [1, "১.০x (স্বাভাবিক)"], [1.5, "১.৫x"], [2, "২.০x"]] as const).map(([s, l]) => (
                        <button key={s} type="button" className={`text-left text-sm transition-colors ${speed === s ? "text-primary-fixed" : "hover:text-primary-fixed"}`} onClick={() => { yt.current?.setPlaybackRate(s); setSpeed(s); setMenu(false); }}>{l}</button>
                      ))}
                      <div className="mt-2 border-b border-outline-variant/20 pb-1 text-xs font-bold text-surface-variant">রেজোলিউশন</div>
                      {(["1080p (HD)", "720p", "480p"] as const).map((r) => (
                        <button key={r} type="button" className={`text-left text-sm transition-colors ${res === r ? "text-primary-fixed" : "hover:text-primary-fixed"}`} onClick={() => setRes(r)}>{r}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" aria-label="পুরো পর্দা" className="transition-colors hover:text-primary-fixed" onClick={toggleFull}><span className="icon text-xl md:text-2xl">fullscreen</span></button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-4 md:mt-4">
          <button type="button" onClick={() => go(all[idx - 1], "পূর্ববর্তী লেকচারে যাওয়া হচ্ছে...")} className="rounded-md border border-outline-variant/50 px-8 py-2 text-sm font-bold shadow-sm transition-colors hover:bg-surface-container-low dark:hover:bg-inverse-surface">পূর্ববর্তী</button>
          <button type="button" onClick={() => go(all[idx + 1], "পরবর্তী লেকচারে যাওয়া হচ্ছে...")} className="rounded-md border border-transparent bg-primary-container px-8 py-2 text-sm font-bold text-on-primary-container transition-all hover:shadow-md dark:border-primary-fixed/30 dark:bg-primary-fixed/20 dark:text-primary-fixed">পরবর্তী</button>
        </div>

        <div className="mt-4 md:mt-8">
          <div className="no-scrollbar flex gap-4 overflow-x-auto border-b border-outline-variant/20 md:gap-6 dark:border-outline-variant/10">
            {tabBtn("notes", "sticky_note_2", "নোটস")}{tabBtn("bookmarks", "bookmark", "বুকমার্কস")}{tabBtn("copyright", "info", "কপিরাইট সতর্কতা")}
          </div>
          {tab === "notes" && (
            <div className="mt-3 md:mt-6">
              <div className="flex flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface">
                <input type="text" value={note.title} onChange={(e) => setNote((n) => ({ ...n, title: e.target.value }))} placeholder="একটি শিরোনাম যোগ করুন..." aria-label="নোটের শিরোনাম"
                  className="w-full border-b border-outline-variant/20 bg-transparent p-4 text-sm font-bold text-on-surface focus:outline-none dark:border-outline-variant/10 dark:text-background" />
                <div className="flex border-b border-outline-variant/20 bg-surface-container-low dark:border-outline-variant/10 dark:bg-on-background/30">
                  <button type="button" className="border-r border-outline-variant/20 bg-surface-container-highest px-6 py-2.5 text-xs font-bold text-primary dark:border-outline-variant/10 dark:bg-inverse-surface dark:text-primary-fixed">লিখুন</button>
                </div>
                <div className="flex flex-wrap gap-1 border-b border-outline-variant/20 bg-surface-container-lowest p-2 text-on-surface-variant dark:border-outline-variant/10 dark:bg-inverse-surface dark:text-surface-variant">
                  {TOOLS.map(([ic, a, b, line]) => (
                    <button key={ic} type="button" aria-label={ic} onClick={() => wrap(a, b, line)} className="rounded p-1 transition-colors hover:bg-surface-container-low dark:hover:bg-on-background/50"><span className="icon text-[18px]">{ic}</span></button>
                  ))}
                </div>
                <textarea ref={ta} value={note.body} onChange={(e) => setNote((n) => ({ ...n, body: e.target.value }))} placeholder="মার্কডাউন সাপোর্টসহ আপনার নোট এখানে লিখুন..." aria-label="নোট"
                  className="h-40 w-full resize-none bg-transparent p-4 text-sm leading-relaxed text-on-surface focus:outline-none dark:text-background" />
                <div className="flex justify-end border-t border-outline-variant/20 bg-surface-container-low p-3 dark:border-outline-variant/10 dark:bg-on-background/20">
                  <button type="button" disabled={busy} onClick={saveNote} className="rounded-md border border-primary bg-primary px-8 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60 dark:bg-primary-fixed dark:text-on-primary-fixed dark:hover:bg-primary-fixed/90">নোট সেভ করুন</button>
                </div>
              </div>
            </div>
          )}
          {tab === "bookmarks" && (
            <div className="mt-3 md:mt-6">
              <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm md:p-6 dark:border-outline-variant/10 dark:bg-inverse-surface">
                <input type="text" maxLength={12} value={bm.title} onChange={(e) => setBm((b) => ({ ...b, title: e.target.value }))} placeholder="বুকমার্কের শিরোনাম লিখুন..." aria-label="বুকমার্কের শিরোনাম"
                  className="w-full rounded-md border border-outline-variant/20 bg-transparent p-3 text-sm font-bold text-on-surface focus:border-primary focus:outline-none dark:border-outline-variant/10 dark:text-background dark:focus:border-primary-fixed" />
                <textarea value={bm.note} maxLength={500} onChange={(e) => setBm((b) => ({ ...b, note: e.target.value }))} placeholder="একটি ঐচ্ছিক নোট যোগ করুন..." aria-label="বুকমার্কের নোট"
                  className="h-24 w-full resize-none rounded-md border border-outline-variant/20 bg-transparent p-3 text-sm leading-relaxed text-on-surface focus:border-primary focus:outline-none dark:border-outline-variant/10 dark:text-background dark:focus:border-primary-fixed" />
                <div className="flex justify-end pt-2">
                  <button type="button" disabled={busy} onClick={saveBm} className="flex items-center gap-2 rounded-md border border-transparent bg-primary-container px-8 py-2 text-sm font-bold text-on-primary-container transition-all hover:shadow-md disabled:opacity-60 dark:border-primary-fixed/30 dark:bg-primary-fixed/20 dark:text-primary-fixed">
                    <span className="icon text-sm">bookmark_add</span> বুকমার্ক সেভ করুন</button>
                </div>
              </div>
            </div>
          )}
          {tab === "copyright" && (
            <div className="mt-3 rounded-xl border border-l-4 border-outline-variant/30 border-l-error bg-surface-container-lowest p-4 text-on-surface-variant md:mt-6 md:p-6 dark:border-outline-variant/10 dark:bg-inverse-surface dark:text-surface-variant">
              <h3 className="mb-2 font-bold text-error">কপিরাইট সতর্কতা</h3>
              <p className="text-sm">অনুমতি ছাড়া এই কনটেন্ট ডাউনলোড, পুনরায় বিতরণ বা শেয়ার করা কঠোরভাবে নিষিদ্ধ এবং এর ফলে আপনার অ্যাকাউন্ট বাতিল হতে পারে।</p>
            </div>
          )}
        </div>
      </div>

      {/* মডিউল (অধ্যায়) আর লেকচার */}
      <div className="flex shrink-0 flex-col lg:w-[380px]">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm font-bold text-on-surface dark:text-background">বর্তমান মডিউল: {sample ? "CS301" : curMod.title}</span>
          <div className="flex w-32 items-center gap-3">
            <div className="h-1.5 grow overflow-hidden rounded-full bg-surface-container-high dark:bg-inverse-surface"><div className="h-full bg-primary-container dark:bg-primary-fixed" style={{ width: `${sample ? 30 : all.length ? (doneAll / all.length) * 100 : 0}%` }} /></div>
            <span className="text-xs font-bold whitespace-nowrap text-on-surface-variant dark:text-surface-variant">{sample ? "৩/১০" : `${bn(doneAll)}/${bn(all.length)}`}</span>
          </div>
        </div>
        <div className="relative mb-2 md:mb-4">
          <span className="icon absolute top-1/2 left-4 -translate-y-1/2 text-[20px] text-on-surface-variant dark:text-surface-variant">search</span>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="একাডেমিক সিলেবাস খুঁজুন" aria-label="লেকচার খুঁজুন"
            className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest py-3 pr-4 pl-12 text-sm text-on-surface transition-colors focus:border-primary focus:outline-none dark:border-outline-variant/10 dark:bg-inverse-surface/60 dark:text-background dark:focus:border-primary-fixed" />
        </div>
        <div className="custom-scrollbar flex max-h-[750px] flex-col gap-3 overflow-y-auto pr-2">
          {shown.length === 0 && <p className="rounded-xl border border-dashed border-outline-variant/40 p-6 text-center text-sm text-on-surface-variant dark:text-surface-variant">{q ? "কিছু পাওয়া যায়নি" : "এখনো কোনো লেকচার নেই"}</p>}
          {shown.map((m) => {
            const isCur = m.id === curMod.id, isOpen = open.has(m.id) || !!q.trim();
            const secs = m.lessons.reduce((t, l) => t + l.seconds, 0);
            return (
              <div key={m.id} onClick={(e) => { if ((e.target as HTMLElement).closest("[data-lessons]")) return; setOpen((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; }); }}
                className={`cursor-pointer rounded-xl border border-outline-variant/30 p-4 transition-all duration-300 dark:border-outline-variant/10 ${isCur ? "border-r-4 border-r-primary bg-surface-container-low shadow-sm dark:border-r-primary-fixed dark:bg-inverse-surface/80" : `bg-surface-container-lowest hover:border-outline-variant dark:bg-inverse-surface dark:hover:border-outline-variant/50 ${isOpen ? "border-r-4 border-r-primary dark:border-r-primary-fixed" : ""}`}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={`text-sm leading-snug font-bold ${isCur ? "text-primary dark:text-primary-fixed" : "text-on-surface dark:text-background"}`}>{m.title}</h3>
                    <p className={`mt-2 text-[11px] font-bold tracking-wide ${isCur ? "text-primary/80 dark:text-primary-fixed/80" : "text-on-surface-variant dark:text-surface-variant"}`}>{hm(secs)} • {bn(m.lessons.length)} লেকচার</p>
                  </div>
                  <button type="button" aria-label={isOpen ? "বন্ধ করুন" : "খুলুন"} className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/5 text-primary transition-colors hover:bg-primary hover:text-white dark:bg-primary-fixed/10 dark:text-primary-fixed"><span className="icon text-[16px]">{isOpen ? "remove" : "add"}</span></button>
                </div>
                {isOpen && (
                  <div data-lessons className="mt-3 flex flex-col gap-3 border-t border-outline-variant/20 pt-3 dark:border-outline-variant/10">
                    {m.lessons.map((l) => {
                      const here = l.id === cur.id;
                      const body = (
                        <>
                          <div className="relative shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={thumb} alt="" className="aspect-video w-16 rounded-md border border-outline-variant/20 object-cover shadow-sm md:w-24" />
                            <div className="absolute right-1 bottom-1 rounded bg-black/80 px-1 text-[10px] font-bold text-white">{sample ? "14:35" : short(l.seconds)}</div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-on-surface-variant transition-colors hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed">
                            <span className={`icon text-[18px] ${here ? "text-primary dark:text-primary-fixed" : ""}`}>{!l.ready ? "lock" : l.done && !here ? "check_circle" : "play_circle"}</span>
                            <span className={here ? "text-primary dark:text-primary-fixed" : ""}>{l.label}: {l.title}</span>
                          </div>
                        </>
                      );
                      return sample || !l.ready || here
                        ? <div key={l.id} className="flex gap-3" onClick={() => { if (!l.ready) toast("এই লেকচারটি এখনো খোলা হয়নি", true); }}>{body}</div>
                        : <Link key={l.id} href={`/learn/${course.slug}?lesson=${l.id}`} scroll={false} className="flex gap-3">{body}</Link>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {toastNode}
    </main>
  );
}
