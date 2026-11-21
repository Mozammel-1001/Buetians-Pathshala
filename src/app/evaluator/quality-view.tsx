"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExModal, Tex, useExToast, type ModalSpec } from "@/app/practice/ui";
import { approveCal, calDetail, removeRef, resolveFinal, resolveRecheck } from "./actions";
import { ScriptPages } from "./script-pages";
import type { CalRow, Flagged, Recheck, RefRow, StatRow } from "./data";
import { ago, bn, num, toNum, validMarks, type Settings } from "./lib";
import { Badge, BTN_GHOST, BTN_PRI, CalTable, CARD, MUTED, Tile, TILE_COLORS, TONE, type ToneKey } from "./ui";

// মান যাচাই (evaluator_dashboard.html এর renderQuality), শিক্ষক আর অ্যাডমিনের:
// দ্বিতীয় যাচাইয়ে অমিল হলে চূড়ান্ত নম্বর, পুনর্মূল্যায়নের আবেদন, নমুনা খাতা (ক্যালিব্রেশন), মূল্যায়নকারীর পরিসংখ্যান
type Q = { scheme: string; solution: string; marks: number };
type Props = {
  flagged: Flagged[]; rechecks: Recheck[]; refs: RefRow[]; cals: CalRow[]; exams: { id: number; title: string }[]; statExam: number | null; stats: StatRow[];
  settings: Settings | null; info: Record<number, Q>; nowMs: number;
};
const RS: Record<Recheck["status"], [string, ToneKey]> = { pending: ["অপেক্ষায়", "amber"], changed: ["নম্বর বদলেছে", "green"], unchanged: ["নম্বর একই", "blue"], rejected: ["গ্রহণ হয়নি", "gray"] };
const CS: Record<CalRow["status"], [string, ToneKey]> = { approved: ["অনুমতি দেওয়া", "blue"], failed: ["মেলেনি", "red"], passed: ["মিলেছে", "green"], in_progress: ["চলছে", "amber"], not_started: ["শুরু করেননি", "gray"] };

const Sec = ({ icon, title, sub, id, children }: { icon: string; title: string; sub: string; id: string; children: React.ReactNode }) => (
  <div id={id} className={`reveal ${CARD} mb-3 p-5 md:mb-6 md:p-6`}>
    <h3 className="flex items-center gap-2 text-lg font-bold text-on-background dark:text-background"><span className="icon text-primary dark:text-primary-fixed">{icon}</span>{title}</h3>
    <p className={`mt-1 mb-2 text-xs md:mb-4 ${MUTED}`}>{sub}</p>{children}
  </div>
);
const Empty = ({ children }: { children: React.ReactNode }) => <p className={`rounded-xl bg-surface-container-low p-4 text-center text-sm dark:bg-white/5 ${MUTED}`}>{children}</p>;

export function QualityView({ flagged, rechecks, refs, cals, exams, statExam, stats, settings, info, nowMs }: Props) {
  const router = useRouter();
  const [toast, toastNode] = useExToast();
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const finalRef = useRef<HTMLInputElement>(null);
  const finalNote = useRef<HTMLTextAreaElement>(null);
  const rcMarks = useRef<HTMLInputElement>(null);
  const rcReply = useRef<HTMLTextAreaElement>(null);
  const tol = settings?.tolerance ?? 15, mod = settings?.modPercent ?? 10, days = settings?.recheckDays ?? 3;

  const run = (p: Promise<{ ok?: boolean; error?: string }>, okMsg: string, tone: "success" | "info" = "success") => {
    void p.then((r) => { if (r.ok) { closeModal(); toast(okMsg, tone); router.refresh(); } else toast(r.error ?? "কাজটা হলো না", "error"); });
  };
  const readMarks = (el: HTMLInputElement | null, full: number) => {
    const v = toNum(el?.value ?? "");
    if (!el || el.value.trim() === "" || !validMarks(v, full)) { el?.classList.add("is-invalid"); return null; }
    return v;
  };
  const marksField = (r: React.RefObject<HTMLInputElement | null>, id: string, full: number, value: string) => (
    <div className="flex items-center gap-2"><input ref={r} id={id} type="text" inputMode="decimal" defaultValue={value} className="ex-field w-28! text-center text-lg! font-bold!" /><span className={`font-bold ${MUTED}`}>/ {bn(full)}</span></div>
  );

  const resolve = (x: Flagged) => setModal({
    icon: "description", title: `খাতা #${x.code} · চূড়ান্ত নম্বর`, wide: true,
    body: (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className={`rounded-xl border p-3 ${TONE.gray}`}><div className={`text-xs ${MUTED}`}>প্রথম: {x.firstBy}</div><b className="text-lg">{num(x.first)}/{bn(x.full)}</b>{x.note && <div className="mt-1 text-xs">{x.note}</div>}</div>
          <div className={`rounded-xl border p-3 ${TONE.purple}`}><div className="text-xs">দ্বিতীয়: {x.secondBy}</div><b className="text-lg">{num(x.second)}/{bn(x.full)}</b></div>
        </div>
        <ScriptPages paths={x.pages} code={x.code} />
        <div className="mt-4 grid gap-3">
          <label className={`block text-xs font-bold ${MUTED}`} htmlFor="ev-final">চূড়ান্ত নম্বর</label>{marksField(finalRef, "ev-final", x.full, "")}
          <label className={`block text-xs font-bold ${MUTED}`} htmlFor="ev-final-note">শিক্ষার্থীর জন্য মন্তব্য (ঐচ্ছিক)</label><textarea ref={finalNote} id="ev-final-note" rows={2} className="ex-field" defaultValue={x.note} />
          {info[x.questionId]?.scheme && <details className="ev-det"><summary className="text-sm font-bold text-primary dark:text-primary-fixed">নম্বর বিভাজন</summary><Tex as="div" src={info[x.questionId].scheme} className={`mt-2 text-sm ${MUTED}`} /></details>}
        </div>
      </>
    ),
    actions: [{ label: "বাতিল", kind: "ghost" }, {
      label: "চূড়ান্ত করুন", id: "ev-final-go", onClick: () => {
        const v = readMarks(finalRef.current, x.full);
        if (v === null) return false;
        run(resolveFinal(x.attemptId, x.questionId, v, finalNote.current?.value.trim() ?? ""), `খাতা #${x.code} এ চূড়ান্ত নম্বর ${num(v)}`);
        return false;
      },
    }],
  });

  const recheck = (r: Recheck) => {
    const finish = (newMarks: number | null) => {
      const reply = rcReply.current?.value.trim() ?? "";
      if (reply.length < 3) { rcReply.current?.classList.add("is-invalid"); return false; }
      run(resolveRecheck(r.id, newMarks, reply), "সিদ্ধান্ত জানানো হয়েছে, শিক্ষার্থী নোটিফিকেশন পাবে");
      return false;
    };
    setModal({
      icon: "description", title: `পুনর্মূল্যায়ন · খাতা #${r.code}`, wide: true,
      body: (
        <>
          <div className={`mb-4 rounded-xl border p-3 text-sm ${TONE.amber}`}><b>শিক্ষার্থীর কারণ:</b> {r.reason}<div className="mt-1 text-xs">{r.exam} · প্রশ্ন {bn(r.no)} · আগের নম্বর {num(r.old)}/{bn(r.full)} · কেটেছিলেন {r.marker}</div></div>
          <ScriptPages paths={r.pages} code={r.code} />
          <div className="mt-4 grid gap-3">
            <label className={`block text-xs font-bold ${MUTED}`} htmlFor="ev-rc-marks">নম্বর (একই রাখলে &quot;নম্বর একই&quot; হবে)</label>{marksField(rcMarks, "ev-rc-marks", r.full, String(r.old))}
            <label className={`block text-xs font-bold ${MUTED}`} htmlFor="ev-rc-reply">শিক্ষার্থীর জন্য উত্তর</label><textarea ref={rcReply} id="ev-rc-reply" rows={2} className="ex-field" placeholder="যেমন: গ অংশে বিকল্প পদ্ধতি সঠিক, ১ নম্বর যোগ হলো" />
            {info[r.questionId] && <details className="ev-det"><summary className="text-sm font-bold text-primary dark:text-primary-fixed">নম্বর বিভাজন আর সমাধান</summary><Tex as="div" src={`${info[r.questionId].scheme}\n\n${info[r.questionId].solution}`} className={`mt-2 text-sm ${MUTED}`} /></details>}
          </div>
        </>
      ),
      actions: [{ label: "আবেদন বাতিল", kind: "ghost", id: "ev-rc-reject", onClick: () => finish(null) }, {
        label: "সিদ্ধান্ত দিন", id: "ev-rc-go", onClick: () => { const v = readMarks(rcMarks.current, r.full); return v === null ? false : finish(v); },
      }],
    });
  };

  const calOf = (c: CalRow) => {
    setModal({ icon: "school", title: `${c.name}: নমুনার ফল`, body: <p className={`text-sm ${MUTED}`}>লোড হচ্ছে…</p>, actions: [{ label: "বন্ধ করুন", kind: "ghost" }] });
    void calDetail(c.userId, c.questionId).then((r) => {
      if (!r.ok) { closeModal(); toast(r.error, "error"); return; }
      setModal({
        icon: "school", title: `${c.name}: নমুনার ফল`,
        body: <><p className={`text-sm ${MUTED}`}>প্রশ্ন {bn(c.no)} এর নমুনায় {bn(c.within)}/{bn(c.refs)}টি কাছাকাছি হয়েছে। নম্বর বিভাজন নিয়ে কথা বলে নিশ্চিত হলে অনুমতি দিন।</p><CalTable rows={r.rows} full={info[c.questionId]?.marks ?? 0} /></>,
        actions: [{ label: "পরে", kind: "ghost" }, { label: "অনুমতি দিন", id: "ev-cal-ok", onClick: () => { run(approveCal(c.userId, c.questionId), `${c.name} এখন প্রশ্ন ${bn(c.no)} কাটতে পারবেন`); return false; } }],
      });
    });
  };

  const failed = cals.filter((c) => c.status === "failed"), pending = rechecks.filter((r) => r.status === "pending");
  const byQ = new Map<string, { ex: string; no: number; qid: number; list: RefRow[]; ov: CalRow[] }>();
  for (const r of refs) { const k = r.examId + ":" + r.questionId; if (!byQ.has(k)) byQ.set(k, { ex: r.examTitle, no: r.no, qid: r.questionId, list: [], ov: [] }); byQ.get(k)!.list.push(r); }
  for (const c of cals) byQ.get(c.examId + ":" + c.questionId)?.ov.push(c);

  return (
    <>
      <h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">মান যাচাই</h2>
      <p className={`mt-1 mb-3 text-sm md:mb-6 ${MUTED}`}>খাতার নম্বর যেন সবার জন্য একই মানে হয়: দ্বিতীয় যাচাই, নমুনা খাতা, পুনর্মূল্যায়ন আর মূল্যায়নকারীর পরিসংখ্যান</p>
      <div className="reveal mb-4 grid grid-cols-2 gap-2 md:mb-8 md:gap-4 xl:grid-cols-4">
        <Tile icon="difference" cls={TILE_COLORS.red} value={bn(flagged.length)} label="পার্থক্য, সিদ্ধান্ত বাকি" />
        <Tile icon="fact_check" cls={TILE_COLORS.amber} value={bn(pending.length)} label="পুনর্মূল্যায়নের আবেদন" />
        <Tile icon="school" cls={TILE_COLORS.blue} value={bn(refs.length)} label="নমুনা খাতা" />
        <Tile icon="person_alert" cls={TILE_COLORS.purple} value={bn(failed.length)} label="নমুনায় মেলেননি" />
      </div>

      <Sec id="ev-sec-flagged" icon="difference" title="দ্বিতীয় যাচাইয়ে পার্থক্য" sub={`প্রত্যেক মূল্যায়নকারীর প্রথম ২টা আর তারপর ${bn(mod)}% খাতা আরেকজন না দেখে কাটেন। পার্থক্য পূর্ণমানের ${bn(tol)}% এর বেশি হলে আপনি চূড়ান্ত নম্বর দেবেন। যিনি কেটেছেন তিনি নিজে চূড়ান্ত করতে পারেন না। এগুলো শেষ না হলে ফল প্রকাশ হয় না।`}>
        {flagged.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className={`border-b border-outline-variant/20 text-left text-xs ${MUTED}`}><th className="py-2 pr-3">পরীক্ষা ও প্রশ্ন</th><th className="py-2 pr-3">খাতা</th><th className="py-2 pr-3">প্রথম</th><th className="py-2 pr-3">দ্বিতীয়</th><th className="py-2 pr-3">পার্থক্য</th><th className="py-2 text-right">অ্যাকশন</th></tr></thead>
            <tbody>{flagged.map((x, i) => (
              <tr key={`${x.attemptId}-${x.questionId}`} data-flag={x.code} className="ev-row border-b border-outline-variant/10" style={{ "--i": i } as React.CSSProperties}>
                <td className="py-3 pr-3"><b>প্রশ্ন {bn(x.no)}</b><div className={`text-xs ${MUTED}`}>{x.examTitle}</div></td>
                <td className="py-3 pr-3 font-mono font-bold">#{x.code}</td>
                <td className="py-3 pr-3"><b>{num(x.first)}</b>/{bn(x.full)}<div className={`text-xs ${MUTED}`}>{x.firstBy}</div></td>
                <td className="py-3 pr-3"><b>{num(x.second)}</b>/{bn(x.full)}<div className={`text-xs ${MUTED}`}>{x.secondBy}</div></td>
                <td className="py-3 pr-3"><Badge tone="red">{num(Math.abs(x.first - x.second))} নম্বর</Badge></td>
                <td className="py-3 text-right"><button type="button" data-act="resolve" className={`${BTN_PRI} px-3! py-1.5!`} onClick={() => resolve(x)}><span className="icon text-[18px]">gavel</span>চূড়ান্ত নম্বর</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>কোনো পার্থক্য সিদ্ধান্তের অপেক্ষায় নেই</Empty>}
      </Sec>

      <Sec id="ev-sec-recheck" icon="fact_check" title="পুনর্মূল্যায়নের আবেদন" sub={`ফল প্রকাশের ${bn(days)} দিনের মধ্যে শিক্ষার্থী প্রশ্নভিত্তিক আবেদন করে (এক পরীক্ষায় সর্বোচ্চ ${bn(3)}টি)। যিনি প্রথমে কেটেছিলেন তিনি নন, অন্য শিক্ষক বা অ্যাডমিন দেখেন। নম্বর বদলালে মোট নম্বর আর মেধাক্রম নিজে থেকে আবার হিসাব হয়, শিক্ষার্থী কারণসহ দেখে।`}>
        {rechecks.length ? (
          <div className="space-y-1.5 md:space-y-3">{rechecks.map((r, i) => (
            <div key={r.id} data-recheck={r.code} className="ev-row flex flex-col gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 md:flex-row md:items-center dark:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
              <div className="min-w-0 grow"><div className="flex flex-wrap items-center gap-2"><b>{r.exam} · প্রশ্ন {bn(r.no)}</b><span className="font-mono text-xs font-bold">#{r.code}</span><Badge tone={RS[r.status][1]}>{RS[r.status][0]}</Badge></div>
                <p className="mt-1 text-sm">&quot;{r.reason}&quot;</p>
                <p className={`mt-1 text-xs ${MUTED}`}>আগের নম্বর {num(r.old)}/{bn(r.full)} · কেটেছিলেন {r.marker} · {ago(r.at, nowMs)}{r.status !== "pending" ? ` · ${r.status === "changed" && r.newMarks != null ? "নতুন নম্বর " + num(r.newMarks) + " · " : ""}${r.reply ?? ""}` : ""}</p></div>
              {r.status === "pending" && <button type="button" data-act="recheck" className={`${BTN_PRI} shrink-0`} onClick={() => recheck(r)}><span className="icon text-[18px]">fact_check</span>দেখে সিদ্ধান্ত দিন</button>}
            </div>
          ))}</div>
        ) : <Empty>কোনো আবেদন নেই</Empty>}
      </Sec>

      <Sec id="ev-sec-cal" icon="school" title="নমুনা খাতা (ক্যালিব্রেশন)" sub="নতুন মূল্যায়নকারী কোনো প্রশ্নের আসল খাতা পাওয়ার আগে আপনার বাছাই করা নমুনাগুলো কাটেন, আপনার নম্বর না দেখে। অন্তত দুই-তৃতীয়াংশ কাছাকাছি হলে কাটা শুরু; না হলে আপনি দেখে অনুমতি দেবেন।">
        {byQ.size ? [...byQ.values()].map((g) => (
          <div key={g.qid} className="mb-1.5 rounded-2xl border border-outline-variant/20 p-4 md:mb-3">
            <div className="font-bold">{g.ex} · প্রশ্ন {bn(g.no)}</div>
            <div className="mt-2 flex flex-wrap gap-2">{g.list.map((r) => (
              <span key={r.attemptId} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${TONE.blue}`}>নমুনা #{r.code} · শিক্ষকের নম্বর {num(r.marks)}
                <button type="button" data-act="unref" className="hover:text-error" title="নমুনা থেকে সরান" onClick={() => run(removeRef(r.attemptId, r.questionId), "নমুনা থেকে সরানো হলো", "info")}><span className="icon text-[16px]">close</span></button></span>
            ))}</div>
            {g.ov.length ? (
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className={`border-b border-outline-variant/20 text-left text-xs ${MUTED}`}><th className="py-2 pr-3">মূল্যায়নকারী</th><th className="py-2 pr-3">কাটা নমুনা</th><th className="py-2 pr-3">কাছাকাছি</th><th className="py-2 pr-3">অবস্থা</th><th className="py-2 text-right" /></tr></thead>
                <tbody>{g.ov.map((c) => (
                  <tr key={c.userId} className="border-b border-outline-variant/10"><td className="py-2 pr-3 font-bold">{c.name}</td><td className="py-2 pr-3">{bn(c.done)}/{bn(c.refs)}</td><td className="py-2 pr-3">{bn(c.within)}</td><td className="py-2 pr-3"><Badge tone={CS[c.status][1]}>{CS[c.status][0]}</Badge></td>
                    <td className="py-2 text-right">{c.status === "failed" && <button type="button" data-act="cal" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={() => calOf(c)}>দেখে অনুমতি দিন</button>}</td></tr>
                ))}</tbody></table></div>
            ) : <p className={`mt-3 text-xs ${MUTED}`}>যাঁরা এই প্রশ্ন আগে কাটেননি, তাঁরা প্রথমবার খুললেই নমুনা পাবেন।</p>}
          </div>
        )) : <Empty>এখনো কোনো নমুনা খাতা নেই। &quot;খাতা কাটা&quot; থেকে প্রশ্নের &quot;কাটা খাতা দেখুন&quot; এ গিয়ে ভালো করে কাটা খাতায় &quot;নমুনা&quot; চাপুন।</Empty>}
      </Sec>

      <Sec id="ev-sec-stats" icon="monitoring" title="মূল্যায়নকারীর পরিসংখ্যান" sub="কে কতটা নরম বা কড়া, কত দ্রুত কাটছেন আর দ্বিতীয় যাচাইয়ে কতবার অমিল হচ্ছে">
        <select id="ev-stat-exam" className="ex-field mb-2.5 md:mb-4 md:w-80!" value={statExam ?? ""} onChange={(e) => router.push(`/evaluator/quality?exam=${e.target.value}`)}>
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        {stats.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
            <thead><tr className={`border-b border-outline-variant/20 text-left text-xs ${MUTED}`}><th className="py-2 pr-3">মূল্যায়নকারী</th><th className="py-2 pr-3">প্রশ্ন</th><th className="py-2 pr-3">খাতা</th><th className="py-2 pr-3">গড় নম্বর</th><th className="py-2 pr-3">খাতাপ্রতি সময়</th><th className="py-2 pr-3">দ্বিতীয় যাচাই</th><th className="py-2 pr-3">ফেরত</th><th className="py-2">সংকেত</th></tr></thead>
            <tbody>{stats.map((r, i) => (
              <tr key={`${r.marker}-${r.questionId}`} className="ev-row border-b border-outline-variant/10" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <td className="py-3 pr-3 font-bold">{r.marker}</td><td className="py-3 pr-3">প্রশ্ন {bn(r.no)}</td><td className="py-3 pr-3">{bn(r.scripts)}</td>
                <td className="py-3 pr-3"><b>{r.scripts ? bn(Math.round(r.avg)) + "%" : "—"}</b><div className={`text-xs ${MUTED}`}>সবার গড় {bn(Math.round(r.qAvg))}%</div></td>
                <td className="py-3 pr-3">{r.scripts ? bn(Math.round((r.secs / 60) * 10) / 10) + " মিনিট" : "—"}<div className={`text-xs ${MUTED}`}>গড় {bn(Math.round((r.qSecs / 60) * 10) / 10)}</div></td>
                <td className="py-3 pr-3">{bn(r.moderated)}টি{r.flagged ? `, অমিল ${bn(r.flagged)}` : ""}</td><td className="py-3 pr-3">{bn(r.returned)}</td>
                <td className="py-3">{r.flags.length ? <span className="flex flex-wrap gap-1">{r.flags.map((f) => <Badge key={f} tone="amber">{f}</Badge>)}</span> : <span className={`text-xs ${MUTED}`}>—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>এই পরীক্ষায় এখনো কেউ খাতা কাটেননি</Empty>}
        <p className={`mt-1.5 text-xs md:mt-3 ${MUTED}`}>সংকেত মানে শুধু খেয়াল করা দরকার, শাস্তি নয়: নরম/কড়া (সবার গড়ের চেয়ে ১৫% বেশি বা কম নম্বর), খুব দ্রুত (গড় সময়ের ৪০% এর কম), দ্বিতীয় যাচাইয়ে প্রায়ই অমিল।</p>
      </Sec>
      <ExModal spec={modal} close={closeModal} />
      {toastNode}
    </>
  );
}
