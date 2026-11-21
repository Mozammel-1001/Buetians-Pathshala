"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExModal, Tex, useExToast, type ModalSpec } from "@/app/practice/ui";
import { claimScript, releaseScript, saveMark, skipScript, type AiDraft, type Left, type Next, type Script } from "./actions";
import { Pages, type Ann, type AnnMap, type Pt, type Tool } from "./annotate";
import type { CalState } from "./data";
import { bn, num, taka, toNum, validMarks, type EvRole, type QItem } from "./lib";
import { Badge, BTN_GHOST, BTN_PRI, CalTable, CARD, MUTED, TONE } from "./ui";

// খাতা কাটার কাজের টেবিল (evaluator_dashboard.html এর renderMarking): একটা প্রশ্নের খাতা একটার পর একটা।
// খাতা নেওয়া, নম্বর, ছোট নোট, লাল দাগ (কলম, টিক, ক্রস, লেখা), এড়িয়ে যাওয়া, AI খসড়া
// কোন খাতা দেবে আর কখন নমুনা বা দ্বিতীয় যাচাই, সব database এর claim_script এ; এখানে শুধু দেখানো
type Props = { examId: number; examTitle: string; q: QItem; label: string; tolerance: number; rate: number; role: EvRole; backHref: string };
const ST: Record<string, string> = { correct: "text-emerald-600 dark:text-emerald-400", partial: "text-amber-600 dark:text-amber-400", wrong: "text-error dark:text-red-300", missing: MUTED };

export function Marking({ examId, examTitle, q, label, tolerance, rate, role, backHref }: Props) {
  const router = useRouter();
  const [toast, toastNode] = useExToast();
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const [phase, setPhase] = useState<"loading" | "script" | "none" | "blocked" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [cur, setCur] = useState<Script | null>(null);
  const [blocked, setBlocked] = useState<CalState | null>(null);
  const [left, setLeft] = useState<Left>({ remaining: 0, modLeft: 0 });
  const [skip, setSkip] = useState<number[]>([]);
  const [tool, setTool] = useState<Tool>("scroll");
  const [ann, setAnn] = useState<AnnMap>({});
  const [hist, setHist] = useState<string[]>([]);
  const [marks, setMarks] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<AiDraft | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const curRef = useRef<Script | null>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const marksRef = useRef<HTMLInputElement>(null);

  // একটা নতুন খাতা (বা "নেই") এলে সব পরিষ্কার
  const apply = (r: Next | { error: string }) => {
    if ("error" in r) { setErrMsg(r.error); setPhase("error"); return; }
    setLeft(r.left);
    setAnn({}); setHist([]); setMarks(""); setNote(""); setErr(""); setBusy(false);
    if (r.kind === "script") { curRef.current = r.script; setCur(r.script); setAi(r.script.ai); setBlocked(null); setPhase("script"); }
    else { curRef.current = null; setCur(null); setAi(null); setBlocked(r.kind === "blocked" ? r.cal : null); setPhase(r.kind === "blocked" ? "blocked" : "none"); }
  };
  // পাতা খোলার সময় প্রথম খাতা (দুবার ডাকলেও একই খাতা ফেরে)
  useEffect(() => {
    let live = true;
    void claimScript(examId, q.id, []).then((r) => { if (live) apply(r); });
    return () => { live = false; };
  }, [examId, q.id]);
  // অন্য পাতায় চলে গেলে হাতে থাকা খাতা ছেড়ে দেওয়া (না করলেও ২০ মিনিট পর নিজে ছাড়ে)
  useEffect(() => () => { const c = curRef.current; if (c) void releaseScript(c.attemptId, q.id); }, [q.id]);

  const leave = async () => { const c = curRef.current; curRef.current = null; if (c) await releaseScript(c.attemptId, q.id); router.push(backHref); };

  const add = (pk: string, a: Ann) => { setAnn((m) => ({ ...m, [pk]: [...(m[pk] ?? []), a] })); setHist((h) => [...h, pk]); };
  const undo = () => { const k = hist[hist.length - 1]; if (!k) return; setHist((h) => h.slice(0, -1)); setAnn((m) => ({ ...m, [k]: (m[k] ?? []).slice(0, -1) })); };
  const askText = (pk: string, p: Pt) => setModal({
    icon: "title", title: "খাতায় লিখুন",
    body: <input ref={textRef} id="ev-ann-text" className="ex-field" maxLength={60} placeholder="যেমন: একক নেই, সূত্র ভুল" autoFocus onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("ev-ann-ok")?.click(); }} />,
    actions: [{ label: "বাতিল", kind: "ghost" }, { label: "বসান", id: "ev-ann-ok", onClick: () => { const v = textRef.current?.value.trim(); if (v) add(pk, { t: "t", x: p[0], y: p[1], v }); } }],
  });

  const setM = (v: number | string) => { setMarks(String(v)); setErr(""); marksRef.current?.focus(); };
  const save = async () => {
    if (!cur || busy) return;
    const raw = marks.trim();
    const v = toNum(raw);
    if (raw === "" || Number.isNaN(v)) return setErr("নম্বর লিখুন");
    if (!validMarks(v, q.marks)) return setErr(`নম্বর ০ থেকে ${bn(q.marks)} এর মধ্যে, ০.৫ এর ঘরে হতে হবে`);
    setBusy(true);
    const r = await saveMark(examId, q.id, cur.attemptId, cur.task, v, note.trim(), ann, skip.filter((x) => x !== cur.attemptId));
    if (!r.ok) { setBusy(false); toast(r.error, "error"); return; }
    if (cur.task === "calibrate") {
      if (r.cal?.feedback) setModal({
        icon: "school", title: r.cal.cleared ? "নমুনা শেষ: নম্বর মিলেছে, এখন খাতা কাটুন" : "নমুনা শেষ: নম্বর মেলেনি",
        body: <><p className={`text-sm ${MUTED}`}>{r.cal.cleared ? "আপনার নম্বর শিক্ষকের কাছাকাছি। এখন থেকে এই প্রশ্নের আসল খাতা আসবে।" : "শিক্ষক জানতে পেরেছেন; তিনি দেখে অনুমতি দিলে এই প্রশ্নের খাতা কাটা শুরু করতে পারবেন। নম্বর বিভাজনটা আরেকবার দেখে নিন।"}</p><CalTable rows={r.cal.feedback.map((f) => ({ code: f.script_code, mine: f.mine, teacher: f.teacher, within: f.within }))} full={q.marks} /></>,
      });
      else toast(`নমুনা ${bn(r.cal?.done ?? 0)}/${bn(r.cal?.refs ?? 0)} সংরক্ষিত`, "info");
    } else if (r.task === "moderate") toast(role === "admin" ? "দ্বিতীয় যাচাই সংরক্ষিত" : `দ্বিতীয় যাচাই সংরক্ষিত · ${taka(r.pay)} সম্মানী যোগ হয়েছে`);
    else toast(role === "admin" ? `খাতা #${cur.code} এ ${num(v)} নম্বর সংরক্ষিত` : `সংরক্ষিত · ${taka(r.pay)} সম্মানী যোগ হয়েছে`);
    setSkip((s) => s.filter((x) => x !== cur.attemptId));
    apply(r.next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const doSkip = async () => {
    if (!cur || busy) return;
    setBusy(true);
    const r = await skipScript(examId, q.id, cur.attemptId, skip);
    if ("error" in r) { setBusy(false); toast(r.error, "error"); return; }
    setSkip((s) => [...s, cur.attemptId]);
    apply(r);
    toast("খাতাটা পরে কাটার জন্য রাখা হলো", "info");
  };
  const retry = async () => { setSkip([]); setPhase("loading"); apply(await claimScript(examId, q.id, [])); };

  // AI খসড়া: server এর /api/ai/draft-marks (Gemini); খসড়া দেখে মূল্যায়নকারী নিজে নম্বর দেন
  const askAi = async () => {
    if (!cur) return;
    const sid = cur.attemptId;
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/draft-marks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attempt_id: sid, question_id: q.id }) });
      const j = (await res.json()) as { ok?: boolean; draft?: AiDraft; message?: string };
      if (j.ok && j.draft) { if (curRef.current?.attemptId === sid) setAi(j.draft); } else toast(j.message ?? "এখন AI খসড়া পাওয়া যাচ্ছে না", "error");
    } catch { toast("নেট সংযোগ দেখে আবার চেষ্টা করুন", "error"); }
    setAiBusy(false);
  };
  const useAi = () => {
    if (!ai) return;
    if (!note.trim()) setNote(ai.parts.filter((p) => p.got < p.max).map((p) => `${p.label}: ${p.comment}`).join("; "));
    setM(ai.marks);
  };

  const back = (
    <button type="button" className={`${BTN_GHOST} mb-2 px-3! py-1.5! md:mb-4`} onClick={() => void leave()}><span className="icon text-[18px]">arrow_back</span>প্রশ্ন তালিকা</button>
  );

  let body: React.ReactNode;
  if (phase === "loading") body = <div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />;
  else if (phase === "error") body = <>{back}<div className={`${CARD} max-w-2xl p-8`}><span className="icon text-5xl text-error">error</span><h3 className="mt-3 text-xl font-bold text-on-background dark:text-background">{errMsg}</h3></div></>;
  else if (phase === "blocked" && blocked) {
    body = (
      <>{back}
        <div className={`${CARD} max-w-2xl p-8`}>
          <span className="icon text-5xl text-error">school</span>
          <h3 className="mt-3 text-xl font-bold text-on-background dark:text-background">নমুনা খাতায় নম্বর শিক্ষকের সাথে মেলেনি</h3>
          <p className={`mt-2 text-sm ${MUTED}`}>{examTitle} · {label}। শিক্ষক জানতে পেরেছেন; তিনি দেখে অনুমতি দিলে এই প্রশ্নের খাতা কাটা শুরু করতে পারবেন। ততক্ষণ অন্য প্রশ্ন কাটতে পারেন।</p>
          {blocked.feedback && <CalTable rows={blocked.feedback.map((f) => ({ code: f.script_code, mine: f.mine, teacher: f.teacher, within: f.within }))} full={q.marks} />}
          <button type="button" className={`${BTN_GHOST} mt-5`} onClick={() => void leave()}>অন্য প্রশ্ন বেছে নিন</button>
        </div>
      </>
    );
  } else if (phase === "none" || !cur) {
    body = (
      <>{back}
        <div className={`${CARD} p-10 text-center`}>
          <span className="icon text-5xl text-primary dark:text-primary-fixed">task_alt</span>
          <h3 className="mt-3 text-xl font-bold text-on-background dark:text-background">{skip.length ? "শুধু এড়িয়ে যাওয়া খাতা বাকি" : left.remaining ? "বাকি খাতাগুলো অন্যদের হাতে আছে" : "এই প্রশ্নের সব খাতা কাটা হয়ে গেছে 🎉"}</h3>
          <p className={`mt-2 text-sm ${MUTED}`}>{examTitle} · {label}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 md:mt-6 md:gap-3">
            {skip.length > 0 && <button type="button" className={BTN_PRI} onClick={() => void retry()}>এড়িয়ে যাওয়াগুলো কাটুন</button>}
            <button type="button" className={BTN_GHOST} onClick={() => void leave()}>অন্য প্রশ্ন বেছে নিন</button>
          </div>
        </div>
      </>
    );
  } else {
    const task = cur.task, pay = role === "admin" || task === "calibrate" ? 0 : q.marks * rate;
    const toolBtn = (k: Tool, icon: string, text: string) => (
      <button key={k} type="button" data-tool={k} className={`ev-tool ${BTN_GHOST} px-3! py-1.5! ${tool === k ? "is-on" : ""}`} onClick={() => setTool(k)}><span className="icon text-[18px]">{icon}</span>{text}</button>
    );
    body = (
      <>
        <div className="mb-2 flex flex-wrap items-center gap-3 md:mb-4">
          <button type="button" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={() => void leave()}><span className="icon text-[18px]">arrow_back</span>প্রশ্ন তালিকা</button>
          <div className="min-w-0"><div className="font-bold text-on-background dark:text-background">{examTitle} · {label}</div>
            <div className={`text-xs ${MUTED}`}>খাতা <b id="ev-code" className="font-mono">#{cur.code}</b> · এই প্রশ্নে বাকি {bn(left.remaining)}টি{left.modLeft ? ` · দ্বিতীয় যাচাই বাকি ${bn(left.modLeft)}টি` : ""}</div></div>
        </div>
        {task === "calibrate" && cur.cal && (
          <div className={`mb-2 rounded-2xl border p-4 text-sm md:mb-4 ${TONE.blue}`}><b className="flex items-center gap-1"><span className="icon text-[18px]">school</span>নমুনা খাতা {bn(cur.cal.done + 1)}/{bn(cur.cal.refs)}: আসল খাতা কাটার আগে</b>
            <p className="mt-1">শিক্ষক এই খাতাটা আগে কেটে রেখেছেন। আপনি নিজের মতো কাটুন; সব নমুনা শেষে শিক্ষকের নম্বরের সাথে মেলানো হবে (পার্থক্য পূর্ণমানের {bn(tolerance)}% পর্যন্ত চলে)। নমুনার সম্মানী নেই।</p></div>
        )}
        {task === "moderate" && (
          <div className={`mb-2 rounded-2xl border p-4 text-sm md:mb-4 ${TONE.purple}`}><b className="flex items-center gap-1"><span className="icon text-[18px]">difference</span>দ্বিতীয় যাচাই</b>
            <p className="mt-1">আরেকজন মূল্যায়নকারী এই খাতাটা কেটেছেন। তাঁর নম্বর আর দাগ দেখানো হচ্ছে না, আপনি নিজের মতো কাটুন। দুজনের পার্থক্য পূর্ণমানের {bn(tolerance)}% এর বেশি হলে শিক্ষক চূড়ান্ত নম্বর দেবেন। সম্মানী সাধারণ খাতার মতোই।</p></div>
        )}
        {cur.returnReason && (
          <div className={`mb-2 rounded-2xl border p-4 text-sm md:mb-4 ${TONE.red}`}><b className="flex items-center gap-1"><span className="icon text-[18px]">undo</span>এই খাতা আবার কাটতে ফেরত এসেছে</b>
            <p className="mt-1">{cur.returnReason}</p>{cur.prevMarks != null && <p className="mt-1 text-xs opacity-80">আগে দেওয়া নম্বর: {num(cur.prevMarks)}/{bn(q.marks)}</p>}</div>
        )}
        <div className="grid grid-cols-1 items-start gap-3 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="sticky top-20 z-20 mb-1.5 flex flex-wrap gap-2 rounded-2xl border border-outline-variant/20 bg-surface/95 p-2 backdrop-blur md:top-[88px] md:mb-3 dark:bg-on-background/95">
              {toolBtn("scroll", "pan_tool", "স্ক্রল")}{toolBtn("pen", "edit", "কলম")}{toolBtn("tick", "check", "টিক")}{toolBtn("cross", "close", "ক্রস")}{toolBtn("text", "title", "লেখা")}
              <button type="button" id="ev-undo" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={undo} disabled={!hist.length}><span className="icon text-[18px]">undo</span>পূর্বাবস্থা</button>
              <button type="button" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={() => { setAnn({}); setHist([]); }}><span className="icon text-[18px]">ink_eraser</span>সব মুছুন</button>
            </div>
            <div id="ev-page"><Pages urls={cur.pages} code={cur.code} ann={ann} tool={tool} onAdd={add} onText={askText} /></div>
            <p className={`mt-2 text-xs ${MUTED}`}>কলম দিয়ে ভুলের নিচে দাগ দিন, টিক বা ক্রস দিন, বা লেখা দিয়ে ছোট মন্তব্য লিখুন। শিক্ষার্থী ফল প্রকাশের পর এই দাগসহ খাতা দেখবে।</p>
          </div>
          <div className="space-y-2 md:space-y-4 xl:sticky xl:top-[88px]">
            <div className={`${CARD} rounded-2xl! p-5`}>
              <label htmlFor="ev-marks" className={`mb-1.5 block text-xs font-bold ${MUTED}`}>নম্বর (০ থেকে {bn(q.marks)}, ০.৫ এর ঘরে)</label>
              <div className="flex items-center gap-2">
                <input ref={marksRef} id="ev-marks" type="text" inputMode="decimal" value={marks} className={`ex-field w-28! text-center text-xl! font-bold! ${err ? "is-invalid" : ""}`}
                  onChange={(e) => { setMarks(e.target.value); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void save(); }} />
                <span className={`font-bold ${MUTED}`}>/ {bn(q.marks)}</span>
                <div className="ml-auto flex gap-1">{[0, q.marks / 2, q.marks].map((v) => <button key={v} type="button" className={`${BTN_GHOST} px-2.5! py-1! text-xs!`} onClick={() => setM(v)}>{num(v)}</button>)}</div>
              </div>
              {err && <p id="ev-marks-err" className="mt-1.5 text-xs font-bold text-error dark:text-red-300">{err}</p>}
              <label htmlFor="ev-note" className={`mt-2.5 mb-1.5 block text-xs font-bold md:mt-4 ${MUTED}`}>শিক্ষার্থীর জন্য মন্তব্য (ঐচ্ছিক)</label>
              <textarea id="ev-note" rows={3} value={note} maxLength={500} className="ex-field resize-y" placeholder="যেমন: খ অংশে একক লেখোনি, ০.৫ কাটা হয়েছে"
                onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void save(); }} />
              <p className={`mt-2 rounded-xl border p-2.5 text-xs md:mt-3 ${role === "admin" || task === "calibrate" ? TONE.gray : TONE.purple}`}>{task === "calibrate" ? "নমুনা খাতার সম্মানী নেই" : role === "admin" ? "অ্যাডমিন হিসেবে কাটা খাতার সম্মানী হয় না" : <>এই খাতার জন্য পাবেন <b>{taka(pay)}</b> (পূর্ণমান {bn(q.marks)} × {taka(rate)})</>}</p>
              <div className="mt-2 flex gap-2 md:mt-4">
                <button id="ev-save" type="button" className={`${BTN_PRI} flex-1`} disabled={busy} onClick={() => void save()}><span className="icon text-[18px]">save</span>সংরক্ষণ ও পরের খাতা</button>
                {task !== "calibrate" && <button type="button" id="ev-skip" className={BTN_GHOST} disabled={busy} onClick={() => void doSkip()} title="পরে কাটবেন">এড়িয়ে যান</button>}
              </div>
              <p className={`mt-2 text-[11px] ${MUTED}`}>Ctrl + Enter চাপলেও সংরক্ষণ হয়</p>
            </div>
            {task === "mark" && (
              <div id="ev-ai" className={`${CARD} rounded-2xl! p-5`}>
                <div className="flex items-center justify-between gap-2"><b className="flex items-center gap-1.5 text-on-background dark:text-background"><span className="icon text-[20px] text-purple-600 dark:text-purple-300">auto_awesome</span>AI খসড়া নম্বর</b>{ai && <Badge tone="purple">খসড়া</Badge>}</div>
                {aiBusy ? <p className={`mt-3 flex items-center gap-2 text-sm ${MUTED}`}><span className="icon animate-spin text-[18px]">progress_activity</span>AI খাতাটা দেখছে…</p>
                  : !ai ? (
                    <>
                      <p className={`mt-2 text-xs ${MUTED}`}>খাতা, সমাধান আর নম্বর বিভাজন মিলিয়ে AI অংশভিত্তিক নম্বর আর মন্তব্য প্রস্তাব করবে। আপনি দেখে নিজে নম্বর দেবেন।</p>
                      <button id="ev-ai-run" type="button" className={`${BTN_GHOST} mt-3 w-full`} onClick={() => void askAi()}><span className="icon text-[18px]">auto_awesome</span>AI খসড়া দেখুন</button>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 flex items-baseline gap-2"><b id="ev-ai-total" className="text-2xl text-on-background dark:text-background">{num(ai.marks)}</b><span className={MUTED}>/ {bn(q.marks)}</span></div>
                      <div className="mt-2 divide-y divide-outline-variant/20">{ai.parts.map((p, i) => <div key={i} className="flex items-start gap-2 py-1.5 text-sm"><b className="w-6 shrink-0">{p.label}</b><span className={`grow ${MUTED}`}>{p.comment}</span><b className={`whitespace-nowrap ${ST[p.status] ?? ""}`}>{num(p.got)}/{num(p.max)}</b></div>)}</div>
                      {ai.comment && <p className={`mt-2 text-xs ${MUTED}`}>{ai.comment}</p>}
                      <button id="ev-ai-use" type="button" className={`${BTN_GHOST} mt-3 w-full`} onClick={useAi}><span className="icon text-[18px]">input</span>খসড়া নম্বর বসান</button>
                      <p className={`mt-2 rounded-lg border p-2 text-[11px] ${TONE.purple}`}>AI ভুল করতে পারে, নিজে দেখে নম্বর দিন। আপনার নম্বর AI থেকে পূর্ণমানের {bn(tolerance)}% এর বেশি দূরে হলে খাতাটা দ্বিতীয় যাচাইয়ে যাবে।</p>
                    </>
                  )}
              </div>
            )}
            <details className={`ev-det ${CARD} rounded-2xl! p-5`} open>
              <summary className="flex items-center justify-between font-bold text-on-background dark:text-background">নম্বর বিভাজন<span className="ev-chev icon transition-transform">expand_more</span></summary>
              <Tex as="div" src={q.scheme} className={`mt-3 text-sm ${MUTED}`} />
            </details>
            <details className={`ev-det ${CARD} rounded-2xl! p-5`}>
              <summary className="flex items-center justify-between font-bold text-on-background dark:text-background">সমাধান<span className="ev-chev icon transition-transform">expand_more</span></summary>
              <Tex as="div" src={q.solution} className={`mt-3 text-sm ${MUTED}`} />
            </details>
            <details className={`ev-det ${CARD} rounded-2xl! p-5`}>
              <summary className="flex items-center justify-between font-bold text-on-background dark:text-background">প্রশ্ন<span className="ev-chev icon transition-transform">expand_more</span></summary>
              <Tex as="div" src={q.body} className={`mt-3 text-sm ${MUTED}`} />
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL, আকার জানা নেই
                <img className="ev-qimg" src={q.imageUrl} alt="প্রশ্নের চিত্র" />
              )}
            </details>
          </div>
        </div>
      </>
    );
  }
  return <>{body}<ExModal spec={modal} close={closeModal} />{toastNode}</>;
}
