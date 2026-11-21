"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExModal, Tex, useExToast, type ModalSpec } from "@/app/practice/ui";
import { resolveFinal, returnScript, setRef } from "./actions";
import type { AnnMap } from "./annotate";
import { ScriptPages } from "./script-pages";
import { bn, fmtDate, num, ago, toNum, validMarks } from "./lib";
import { Badge, BTN_GHOST, BTN_PRI, CARD, MOD, MUTED, TONE } from "./ui";

// কাটা খাতার তালিকা (evaluator_dashboard.html এর renderReview): শিক্ষক আর অ্যাডমিন যাচাই করে ফেরত দেন, চূড়ান্ত নম্বর দেন,
// ভালো খাতা "নমুনা" করেন; মূল্যায়নকারী শুধু নিজের কাটাগুলো দেখেন
export type ScriptRow = {
  attemptId: number; code: string; marks: number; note: string; at: number; marker: string; moderation: string | null;
  second: number | null; secondBy: string | null; first: number | null; isRef: boolean; pages: string[]; ann: AnnMap | null;
};
type Props = { examId: number; qid: number; qLabel: string; examTitle: string; full: number; scheme: string; rows: ScriptRow[]; manager: boolean; canReturn: boolean; evaluator: boolean; nowMs: number };

export function ReviewTable({ qid, qLabel, full, scheme, rows, manager, canReturn, nowMs }: Props) {
  const router = useRouter();
  const [toast, toastNode] = useExToast();
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const refs = rows.filter((r) => r.isRef).length;
  const whyRef = useRef<HTMLTextAreaElement>(null);
  const finalRef = useRef<HTMLInputElement>(null);
  const finalNoteRef = useRef<HTMLTextAreaElement>(null);
  const refMarksRef = useRef<HTMLInputElement>(null);

  // সার্ভারে কাজ: সফল হলে মেসেজ আর তালিকা নতুন, না হলে modal খোলা রেখে ত্রুটি
  const run = (p: Promise<{ ok?: boolean; error?: string }>, okMsg: string, tone: "success" | "info" = "success") => {
    void p.then((r) => { if (r.ok) { closeModal(); toast(okMsg, tone); router.refresh(); } else toast(r.error ?? "কাজটা হলো না", "error"); });
  };
  const readMarks = (el: HTMLInputElement | null) => {
    const v = toNum(el?.value ?? "");
    if (!el || el.value.trim() === "" || !validMarks(v, full)) { el?.classList.add("is-invalid"); return null; }
    return v;
  };

  const view = (r: ScriptRow) => setModal({
    icon: "description", title: `খাতা #${r.code} · ${num(r.marks)}/${bn(full)}`, wide: true,
    body: <><ScriptPages paths={r.pages} code={r.code} ann={r.ann} />{r.note && <p className={`mt-3 rounded-xl border p-3 text-sm ${TONE.red}`}><b>মন্তব্য:</b> {r.note}</p>}<p className={`mt-2 text-xs ${MUTED}`}>কেটেছেন {r.marker} · {fmtDate(r.at)}</p></>,
    actions: [{ label: "বন্ধ করুন", kind: "ghost" }],
  });
  const askReturn = (r: ScriptRow) => setModal({
    icon: "undo", title: `খাতা #${r.code} ফেরত দিন`,
    body: <><p className={`mb-3 text-sm ${MUTED}`}>{r.marker} দিয়েছেন {num(r.marks)} নম্বর। ফেরত দিলে এই খাতার সম্মানী বাদ যাবে, আর খাতাটা আবার কাটার তালিকার সবার আগে যাবে। যিনি কেটেছিলেন তিনি কারণ দেখবেন।</p>
      <label className={`mb-1.5 block text-xs font-bold ${MUTED}`} htmlFor="ev-ret-why">কারণ</label><textarea ref={whyRef} id="ev-ret-why" rows={3} className="ex-field" placeholder="যেমন: গ অংশে ভুল সমীকরণে পূর্ণ নম্বর দেওয়া হয়েছে" /></>,
    actions: [{ label: "বাতিল", kind: "ghost" }, {
      label: "ফেরত দিন", kind: "danger", id: "ev-ret-go", onClick: () => {
        const why = whyRef.current?.value.trim() ?? "";
        if (!why) { whyRef.current?.classList.add("is-invalid"); return false; }
        run(returnScript(r.attemptId, qid, why), `খাতা #${r.code} ফেরত দেওয়া হয়েছে`, "info");
        return false;
      },
    }],
  });
  const askResolve = (r: ScriptRow) => setModal({
    icon: "description", title: `খাতা #${r.code} · চূড়ান্ত নম্বর`, wide: true,
    body: (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className={`rounded-xl border p-3 ${TONE.gray}`}><div className={`text-xs ${MUTED}`}>প্রথম: {r.marker}</div><b className="text-lg">{num(r.first ?? r.marks)}/{bn(full)}</b>{r.note && <div className="mt-1 text-xs">{r.note}</div>}</div>
          <div className={`rounded-xl border p-3 ${TONE.purple}`}><div className="text-xs">দ্বিতীয়: {r.secondBy ?? "—"}</div><b className="text-lg">{num(r.second ?? 0)}/{bn(full)}</b></div>
        </div>
        <ScriptPages paths={r.pages} code={r.code} ann={r.ann} />
        <div className="mt-4 grid gap-3">
          <label className={`block text-xs font-bold ${MUTED}`} htmlFor="ev-final">চূড়ান্ত নম্বর</label>
          <div className="flex items-center gap-2"><input ref={finalRef} id="ev-final" type="text" inputMode="decimal" className="ex-field w-28! text-center text-lg! font-bold!" /><span className={`font-bold ${MUTED}`}>/ {bn(full)}</span></div>
          <label className={`block text-xs font-bold ${MUTED}`} htmlFor="ev-final-note">শিক্ষার্থীর জন্য মন্তব্য (ঐচ্ছিক)</label>
          <textarea ref={finalNoteRef} id="ev-final-note" rows={2} className="ex-field" defaultValue={r.note} />
          <details className="ev-det"><summary className="text-sm font-bold text-primary dark:text-primary-fixed">নম্বর বিভাজন</summary><Tex as="div" src={scheme} className={`mt-2 text-sm ${MUTED}`} /></details>
        </div>
      </>
    ),
    actions: [{ label: "বাতিল", kind: "ghost" }, {
      label: "চূড়ান্ত করুন", id: "ev-final-go", onClick: () => {
        const v = readMarks(finalRef.current);
        if (v === null) return false;
        run(resolveFinal(r.attemptId, qid, v, finalNoteRef.current?.value.trim() ?? ""), `খাতা #${r.code} এ চূড়ান্ত নম্বর ${num(v)}`);
        return false;
      },
    }],
  });
  const askRef = (r: ScriptRow) => setModal({
    icon: "school", title: `খাতা #${r.code} নমুনা করবেন?`,
    body: <><p className={`mb-3 text-sm ${MUTED}`}>নতুন মূল্যায়নকারী এই প্রশ্নের আসল খাতা পাওয়ার আগে এটা কাটবেন, এই নম্বর না দেখে। নম্বর ঠিক আছে কিনা দেখে নিন।</p>
      <label className={`mb-1.5 block text-xs font-bold ${MUTED}`} htmlFor="ev-ref-marks">সঠিক নম্বর</label>
      <div className="flex items-center gap-2"><input ref={refMarksRef} id="ev-ref-marks" type="text" inputMode="decimal" defaultValue={String(r.marks)} className="ex-field w-28! text-center text-lg! font-bold!" /><span className={`font-bold ${MUTED}`}>/ {bn(full)}</span></div></>,
    actions: [{ label: "বাতিল", kind: "ghost" }, {
      label: "নমুনা করুন", id: "ev-ref-go", onClick: () => {
        const v = readMarks(refMarksRef.current);
        if (v === null) return false;
        run(setRef(r.attemptId, qid, v), `খাতা #${r.code} নমুনা হলো`);
        return false;
      },
    }],
  });

  return (
    <>
      <h2 className="text-2xl font-bold text-on-background dark:text-background">{qLabel}: কাটা খাতা</h2>
      <p className={`mt-1 mb-3 text-sm md:mb-6 ${MUTED}`}>{manager ? "যাচাই করুন; ভুল মনে হলে কারণসহ ফেরত দিন, খাতাটা আবার কাটার তালিকার সবার আগে যাবে। ভালো করে কাটা খাতা \"নমুনা\" করলে নতুন মূল্যায়নকারী আগে সেগুলো কেটে আপনার নম্বরের সাথে মিলিয়ে নেবেন (প্রশ্নে সর্বোচ্চ ৩টি)।" : "আপনার কাটা খাতা"}</p>
      {rows.length ? (
        <div className={`${CARD} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[640px]">
          <thead><tr className={`border-b border-outline-variant/20 text-left text-xs font-bold ${MUTED}`}><th className="px-4 py-3">খাতা</th><th className="px-4 py-3">নম্বর</th><th className="px-4 py-3">কেটেছেন</th><th className="px-4 py-3">মন্তব্য</th><th className="px-4 py-3 text-right">অ্যাকশন</th></tr></thead>
          <tbody className="divide-y divide-outline-variant/10">{rows.map((r, i) => (
            <tr key={r.attemptId} data-script={r.code} className="ev-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <td className="px-4 py-3 font-mono text-sm font-bold">#{r.code}</td>
              <td className="px-4 py-3 font-bold">{num(r.marks)}<span className={`text-xs ${MUTED}`}>/{bn(full)}</span>
                {r.moderation && MOD[r.moderation] && <div className="mt-1"><Badge tone={MOD[r.moderation][1]}>{MOD[r.moderation][0]}</Badge></div>}
                {manager && r.second != null && <div className={`mt-1 text-[11px] font-normal ${MUTED}`}>দ্বিতীয়: {num(r.second)} · {r.secondBy}{r.first != null && r.first !== r.marks ? ` · প্রথম ছিল ${num(r.first)}` : ""}</div>}
                {r.isRef && <div className="mt-1"><Badge tone="blue" icon="school">নমুনা খাতা</Badge></div>}</td>
              <td className="px-4 py-3 text-sm">{r.marker}<div className={`text-xs ${MUTED}`}>{ago(r.at, nowMs)}</div></td>
              <td className={`max-w-[220px] px-4 py-3 text-xs ${MUTED}`}>{r.note || "—"}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2">
                <button type="button" data-act="view" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={() => view(r)}><span className="icon text-[18px]">visibility</span>দেখুন</button>
                {canReturn && r.moderation === "flagged" && <button type="button" data-act="resolve" className={`${BTN_PRI} px-3! py-1.5!`} onClick={() => askResolve(r)}><span className="icon text-[18px]">gavel</span>চূড়ান্ত নম্বর</button>}
                {canReturn && r.moderation !== "flagged" && <button type="button" data-act="return" className={`${BTN_GHOST} px-3! py-1.5! hover:text-error! hover:border-error!`} onClick={() => askReturn(r)}><span className="icon text-[18px]">undo</span>ফেরত</button>}
                {manager && !r.isRef && refs < 3 && <button type="button" data-act="ref" title="নতুন মূল্যায়নকারীর ক্যালিব্রেশনের জন্য" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={() => askRef(r)}><span className="icon text-[18px]">school</span>নমুনা</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      ) : <div className={`${CARD} ${MUTED} p-8 text-center`}>এখনো কোনো কাটা খাতা নেই</div>}
      <ExModal spec={modal} close={closeModal} />
      {toastNode}
    </>
  );
}
