import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentRate, evMe, loadExams, loadLedger, loadNotices, loadQuality, loadReturned } from "./data";
import { ROLE_LABEL, ago, bn, monthKey, monthStart, taka } from "./lib";
import { Badge, BTN_PRI, CARD, Empty, ExamCard, MUTED, TILE_COLORS, TONE, Tile } from "./ui";

// ড্যাশবোর্ড (evaluator_dashboard.html এর home): স্বাগতম, এই মাসের হিসাব, কাটার মতো পরীক্ষা, ফেরত আসা খাতা, নোটিশ
export default function Page() {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const me = await evMe("/evaluator");
  const sb = await createClient();
  const now = new Date().getTime();
  const admin = me.role === "admin", manager = me.role !== "evaluator";
  const [exams, rate, led, ret, notices, evCount] = await Promise.all([
    loadExams(sb), currentRate(sb),
    admin ? null : loadLedger(sb, me.id, monthStart(monthKey(now))),
    loadReturned(sb), loadNotices(sb, me.role, 2),
    admin ? sb.from("profiles").select("id", { count: "exact", head: true }).eq("role", "evaluator") : null,
  ]);
  const todo = manager ? await loadQuality(sb, exams) : null;
  const open = exams.filter((e) => !e.published);
  const remaining = open.reduce((t, e) => t + e.prog.remaining, 0);
  const q = todo ? { flagged: todo.flagged.length, rechecks: todo.rechecks.filter((r) => r.status === "pending").length, failed: todo.cals.filter((c) => c.status === "failed").length } : null;
  const qTotal = q ? q.flagged + q.rechecks + q.failed : 0;

  return (
    <>
      <div className={`reveal tilt-card ${CARD} relative mb-4 overflow-hidden p-6 md:mb-8 md:p-8`}>
        <div className="relative z-10">
          <h2 className="mb-2 text-2xl font-bold text-on-background md:text-3xl dark:text-background">স্বাগতম, {me.full_name}! 👋</h2>
          <p className={`${MUTED} mb-2.5 md:mb-5`}>{remaining ? `${bn(remaining)}টি খাতা কাটার অপেক্ষায় আছে।` : "এখন কাটার মতো কোনো খাতা বাকি নেই।"} খাতায় শিক্ষার্থীর নাম থাকে না, শুধু খাতার কোড।</p>
          <div className="flex flex-wrap gap-1.5 md:gap-3">
            <Badge tone="blue" icon="badge">{ROLE_LABEL[me.role]}</Badge>
            <Badge tone="purple" icon="payments">প্রতি নম্বরে {taka(rate)}</Badge>
            {remaining > 0 && <Link href="/evaluator/mark" className={`${BTN_PRI} py-1.5!`}><span className="icon text-[18px]">rate_review</span>খাতা কাটা শুরু করুন</Link>}
          </div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/5 blur-3xl dark:bg-primary-fixed/5" />
      </div>

      <div className="reveal mb-4 grid grid-cols-2 gap-2 md:mb-8 md:gap-6 xl:grid-cols-4">
        {admin || !led ? (
          <>
            <Tile tilt icon="assignment" cls={TILE_COLORS.blue} value={bn(exams.length)} label="লিখিত পরীক্ষা" />
            <Tile tilt icon="rate_review" cls={TILE_COLORS.amber} value={bn(remaining)} label="খাতা কাটা বাকি" />
            <Tile tilt icon="groups" cls={TILE_COLORS.green} value={bn(evCount?.count ?? 0)} label="সক্রিয় মূল্যায়নকারী" />
            <Tile tilt icon="payments" cls={TILE_COLORS.purple} value={taka(rate)} label="প্রতি নম্বরের সম্মানী" sub="অ্যাডমিনের কাটা খাতার সম্মানী হয় না" />
          </>
        ) : (
          <>
            <Tile tilt icon="task_alt" cls={TILE_COLORS.green} value={bn(led.scripts)} label="এই মাসে কাটা খাতা" />
            <Tile tilt icon="functions" cls={TILE_COLORS.blue} value={bn(led.marks)} label="কাটা নম্বর (পূর্ণমান)" />
            <Tile tilt icon="account_balance_wallet" cls={TILE_COLORS.purple} value={taka(led.marking)} label="এই মাসের সম্মানী" sub={`প্রতি নম্বরে ${taka(rate)}`} />
            <Tile tilt icon="pending_actions" cls={TILE_COLORS.amber} value={taka(me.role === "teacher" ? led.marking : led.due)} label={me.role === "teacher" ? "ক্লাসের সম্মানীর সাথে পাবেন" : "বাকি পাওনা"} sub={me.role === "teacher" ? undefined : `পেয়েছেন ${taka(led.paid)}`} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:gap-8 xl:grid-cols-3">
        <div className="reveal space-y-2 md:space-y-4 xl:col-span-2">
          <div><h3 className="text-xl font-bold text-on-background dark:text-background">যেসব পরীক্ষার খাতা কাটা যাবে</h3>
            <p className={`mt-1 text-xs ${MUTED}`}>পরীক্ষার সময় শেষ হলে খাতা কাটা শুরু হয়, যাতে সমাধান আগে ফাঁস না হয়</p></div>
          {exams.length ? <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">{exams.map((e, i) => <ExamCard key={e.id} e={e} i={i} now={now} />)}</div> : <Empty>এখনো কোনো পরীক্ষার খাতা আসেনি</Empty>}
        </div>
        <div className="reveal space-y-3 md:space-y-6">
          {qTotal > 0 && q && (
            <div className={`rounded-3xl border p-5 ${TONE.purple}`}>
              <div className="mb-2 flex items-center gap-2 font-bold"><span className="icon">verified</span>মান যাচাইয়ে আপনার সিদ্ধান্ত দরকার</div>
              <ul className="mb-3 space-y-1 text-xs">
                {q.flagged > 0 && <li>দ্বিতীয় যাচাইয়ে পার্থক্য: <b>{bn(q.flagged)}টি খাতা</b></li>}
                {q.rechecks > 0 && <li>পুনর্মূল্যায়নের আবেদন: <b>{bn(q.rechecks)}টি</b></li>}
                {q.failed > 0 && <li>নমুনা খাতায় মেলেননি: <b>{bn(q.failed)} জন</b></li>}
              </ul>
              <Link href="/evaluator/quality" className={`${BTN_PRI} w-full`}>দেখুন</Link>
            </div>
          )}
          {ret.length > 0 && (
            <div className={`rounded-3xl border p-5 ${TONE.red}`}>
              <div className="mb-2 flex items-center gap-2 font-bold"><span className="icon">undo</span>{bn(ret.length)}টি খাতা ফেরত এসেছে</div>
              {ret.slice(0, 3).map((x) => <p key={`${x.questionId}-${x.code}`} className="mb-2 text-xs"><b>{x.exam} · প্রশ্ন {bn(x.no)}</b><br />{x.reason} {x.by && <span className="opacity-75">({x.by})</span>}</p>)}
              <Link href={`/evaluator/mark/${ret[0].examId}/${ret[0].questionId}`} className={`${BTN_PRI} mt-1 w-full`}>আবার কাটুন</Link>
            </div>
          )}
          <div className={`${CARD} p-6`}>
            <div className="mb-2.5 flex items-center justify-between md:mb-4"><h3 className="text-lg font-bold text-on-background dark:text-background">নোটিশ</h3><Link href="/evaluator/notices" className="text-sm font-bold text-primary hover:underline dark:text-primary-fixed">সব দেখুন</Link></div>
            <div className="space-y-1.5 md:space-y-3">
              {notices.map((n) => (
                <div key={n.id} className="rounded-xl bg-surface-container-low p-3 dark:bg-white/5"><div className="text-sm font-bold">{n.title}</div>
                  <p className={`mt-1 line-clamp-2 text-xs ${MUTED}`}>{n.body}</p><div className={`mt-1 text-[11px] ${MUTED}`}>অ্যাডমিন · {ago(n.at, now)}</div></div>
              ))}
              {!notices.length && <p className={`text-sm ${MUTED}`}>কোনো নোটিশ নেই</p>}
            </div>
          </div>
          <div className={`${CARD} p-6`}>
            <h3 className="mb-1.5 flex items-center gap-2 font-bold text-on-background md:mb-3 dark:text-background"><span className="icon text-primary dark:text-primary-fixed">calculate</span>সম্মানী যেভাবে হিসাব হয়</h3>
            <ul className={`list-disc space-y-1 pl-5 text-sm md:space-y-2 ${MUTED}`}>
              <li>প্রতিটি কাটা প্রশ্নের <b>পূর্ণমান × প্রতি নম্বরের রেট</b>। যেমন ১০ নম্বরের প্রশ্ন × {taka(rate)} = {taka(10 * rate)}</li>
              <li>দেওয়া নম্বরের উপর নয়, তাই কম বা বেশি নম্বর দিলে সম্মানী বদলায় না</li>
              <li>অ্যাডমিন বা শিক্ষক খাতা ফেরত দিলে সেই খাতার সম্মানী বাদ যায়</li>
              <li>ক্লাসের সম্মানীর মতো মাস শেষে অ্যাডমিন বা ম্যানেজার পরিশোধ করেন</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
