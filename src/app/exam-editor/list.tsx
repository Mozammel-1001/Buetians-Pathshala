"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, BTN_GHOST, BTN_PRI, CARD, ExModal, MUTED, useExToast, type ModalSpec, type ToneKey } from "@/app/practice/ui";
import { deleteExam } from "./actions";
import { bn, num, stateOf, stats, when, type Course, type ExamRow, type Kind, type State } from "./lib";

export type ListItem = { exam: ExamRow; questions: { kind: "mcq" | "written"; section: string; marks: number }[] };
export const KIND: Record<Kind, [string, ToneKey]> = { mcq: ["MCQ", "gray"], mixed: ["MCQ + লিখিত", "purple"], written: ["লিখিত", "blue"] };
export const STATE: Record<State, [string, ToneKey, string]> = { draft: ["ড্রাফট", "gray", "edit_note"], scheduled: ["প্রকাশিত, শুরু হয়নি", "blue", "event"], running: ["চলছে", "amber", "timer"], closed: ["শেষ", "green", "task_alt"] };

// এখনকার সময়: ৩০ সেকেন্ড পরপর নতুন (চলছে/শেষ বদলায়)
export function useNow(initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => { const t = setInterval(() => setNow(new Date().getTime()), 30000); return () => clearInterval(t); }, []);
  return now;
}

export function ExamList({ items, courses, admin, nowMs }: { items: ListItem[]; courses: Course[]; admin: boolean; nowMs: number }) {
  const router = useRouter();
  const now = useNow(nowMs);
  const [course, setCourse] = useState<number | "all">("all");
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const [toast, toastNode] = useExToast();
  const closeModal = useCallback(() => setModal(null), []);
  const list = items.filter((x) => course === "all" || x.exam.courseId === course);

  const askDelete = (e: ExamRow, n: number) => setModal({
    icon: "delete", title: "পরীক্ষাটা মুছবেন?", body: <p className="text-sm">&quot;{e.title}&quot; আর এর {bn(n)}টি প্রশ্ন মুছে যাবে।</p>,
    actions: [{ label: "না", kind: "ghost" }, { label: "মুছুন", kind: "danger", onClick: () => { void (async () => { const r = await deleteExam(e.id); if (r.ok) { toast("মুছে ফেলা হলো"); router.refresh(); } else toast(r.error, "error"); })(); } }],
  });

  return (
    <main className="mx-auto w-full max-w-[1440px] grow px-4 pt-2.5 pb-10 md:px-8 md:pt-5">
      <div className="reveal mt-3 mb-3 flex flex-wrap items-end justify-between gap-2 md:mt-6 md:mb-6 md:gap-4">
        <div>
          <h1 className="text-[30px] font-bold text-on-background md:text-[40px] dark:text-background">প্রশ্নপত্র ও <span className="text-primary dark:text-primary-fixed">সময়সূচি</span></h1>
          <p className={`${MUTED} mt-1`}>{admin ? "সব কোর্সের পরীক্ষা" : courses.length ? `আপনার কোর্সের পরীক্ষা: ${courses.map((c) => c.name).join(", ")}` : "আপনাকে এখনো কোনো কোর্সে শিক্ষক করা হয়নি"}। পরীক্ষা তৈরি, প্রশ্ন বসানো, সময় ঠিক করা আর প্রকাশ।</p>
        </div>
        {courses.length > 0 && <Link id="ed-new" href="/exam-editor/new" className={`${BTN_PRI} px-6!`}><span className="icon text-[18px]">add</span>নতুন পরীক্ষা</Link>}
      </div>
      <div className="mb-2.5 flex flex-wrap gap-2 md:mb-5">
        {([["all", "সব কোর্স"], ...courses.map((c) => [c.id, c.name] as const)] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setCourse(k)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${course === k ? "border-primary bg-primary text-on-primary" : `border-outline-variant/40 ${MUTED} hover:border-primary`}`}>{t}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {list.map(({ exam: e, questions }) => {
          const st = stateOf(e, now), s = stats(questions, e.pick), editable = st === "draft" || st === "scheduled";
          return (
            <div key={e.id} data-exam={e.id} className={`reveal ${CARD} flex flex-col gap-3 rounded-2xl! p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="text-lg font-bold text-on-background dark:text-background">{e.title}</h3><p className={`text-xs ${MUTED} mt-1`}>{e.courseName}{e.by ? ` · ${e.by}` : ""}</p></div>
                <div className="flex shrink-0 flex-col items-end gap-1"><Badge tone={KIND[e.kind][1]}>{KIND[e.kind][0]}</Badge><Badge tone={STATE[st][1]} icon={STATE[st][2]}>{STATE[st][0]}</Badge></div>
              </div>
              <p className={`text-xs ${MUTED} flex items-center gap-1`}><span className="icon text-[14px]">schedule</span>{e.opens != null ? `${when(e.opens, now)} থেকে ${when(e.closes, now)}` : "সময় ঠিক হয়নি"} · {bn(e.minutes)} মিনিট</p>
              <p className="text-sm">
                {s.mcq ? <>MCQ <b>{bn(s.mcq)}</b>টি</> : null}{s.mcq && s.written ? " · " : ""}{s.written ? <>লিখিত <b>{bn(s.written)}</b>টি</> : null}
                {!s.mcq && !s.written ? <span className={MUTED}>এখনো প্রশ্ন নেই</span> : <> · মোট <b>{num(s.mcqMarks + s.wTotal)}</b> নম্বর</>}
              </p>
              <div className="mt-auto flex gap-2">
                <Link href={`/exam-editor/${e.id}`} className={`${BTN_PRI} flex-1`}><span className="icon text-[18px]">{editable ? "edit_note" : "visibility"}</span>{editable ? "প্রশ্নপত্র" : "দেখুন"}</Link>
                {st === "draft" && <button type="button" title="মুছুন" aria-label="মুছুন" className={BTN_GHOST} onClick={() => askDelete(e, questions.length)}><span className="icon text-[18px]">delete</span></button>}
              </div>
            </div>
          );
        })}
        {!list.length && <div className={`${CARD} ${MUTED} p-8 text-center md:col-span-2 xl:col-span-3`}>{courses.length ? "এই কোর্সে এখনো পরীক্ষা নেই। \"নতুন পরীক্ষা\" দিয়ে শুরু করুন।" : "দেখানোর মতো কোনো কোর্স নেই।"}</div>}
      </div>
      <ExModal spec={modal} close={closeModal} />
      {toastNode}
    </main>
  );
}
