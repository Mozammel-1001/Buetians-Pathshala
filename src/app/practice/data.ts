// পরীক্ষার পাতার নমুনা তথ্য আর হিসাব (practice.html এর ExamServer / MarkStore এর ছোট রূপ)।
// [PRODUCTION] আসল তথ্য: rpc('start_exam'), rpc('save_answers'), rpc('submit_exam'), rpc('exam_solution'),
//   rpc('exam_leaderboard'), rpc('my_chapter_report'), rpc('my_written_result'), rpc('request_recheck')

export type Mcq = { id: string; kind: "mcq"; body: string; options: string[]; key: number; exp: string; chapter: string; marks: number; image?: string; lock?: boolean };
export type Written = { id: string; kind: "written"; section: string; marks: number; chapter: string; body: string; exp: string; scheme: string };
export type Question = Mcq | Written;
export type Exam = { id: string; title: string; course: string; courseName: string; kind: "mcq" | "mixed" | "written"; minutes: number; neg: number; pick: Record<string, number>; questions: Question[] };
export type Correction = { qid: string; action: "key" | "award" | "drop"; from?: number; to?: number; reason: string; by: string };
export type EndReason = "submit" | "time_up" | "left" | "back" | "tab_hidden" | "reopened" | "other_device" | "expired";
export type Page = { id: string; thumb: string; full?: string; status: "up" | "wait" };
export type Attempt = {
  examId: string; started: number; deadline: number; submitted: number | null; status: "in_progress" | "submitted" | "expired";
  answers: Record<string, number>; picked: string[]; pages: Record<string, Page[]>; endReason: EndReason | null; uploadUntil: number | null;
};
export type Windows = Record<string, { opens: number; closes: number }>;

const svgData = (x: string) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(x);
// প্রশ্নের চিত্র: y অক্ষের সমান্তরাল রেখা
const FIG_VLINE = svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 180" width="260" height="180"><rect width="260" height="180" fill="#fff"/><g stroke="#94a3b8" stroke-width="1.2"><line x1="16" y1="146" x2="248" y2="146"/><line x1="60" y1="10" x2="60" y2="172"/></g><line x1="150" y1="14" x2="150" y2="170" stroke="#006c49" stroke-width="3"/><g font-family="serif" font-size="15" font-style="italic"><text x="240" y="164">x</text><text x="66" y="22">y</text><text x="156" y="40" fill="#006c49">x = 2</text></g><g font-family="serif" font-size="13"><text x="146" y="164">2</text><text x="46" y="162">O</text></g></svg>');
const M = (id: string, body: string, options: string[], key: number, exp: string, chapter: string, extra: Partial<Mcq> = {}): Mcq => ({ id, kind: "mcq", body, options, key, exp, chapter, marks: 1, ...extra });

export const EXAMS: Exam[] = [
  {
    id: "mcq06", title: "সাপ্তাহিক MCQ ০৬: সরলরেখা ও বৃত্ত", course: "math1st", courseName: "উচ্চতর গণিত ১ম পত্র", kind: "mcq", minutes: 15, neg: 0.25, pick: {},
    questions: [
      M("m6-1", "$y = 2x + 3$ রেখার ঢাল কত?", ["$2$", "$3$", "$-2$", "$\\frac{1}{2}$"], 0, "$y = mx + c$ আকারে $m = 2$।", "সরলরেখা"),
      M("m6-2", "$(1, 2)$ ও $(3, 6)$ বিন্দুগামী রেখার ঢাল কত?", ["$1$", "$2$", "$3$", "$4$"], 1, "$m = \\frac{6 - 2}{3 - 1} = 2$", "সরলরেখা"),
      M("m6-3", "$x^2 + y^2 = 25$ বৃত্তের ব্যাসার্ধ কত?", ["$5$", "$25$", "$\\sqrt{5}$", "$10$"], 0, "$r^2 = 25 \\Rightarrow r = 5$", "বৃত্ত"),
      M("m6-4", "$x^2 + y^2 - 4x + 6y - 3 = 0$ বৃত্তের কেন্দ্র কোনটি?", ["$(2, -3)$", "$(-2, 3)$", "$(4, -6)$", "$(-4, 6)$"], 0, "কেন্দ্র $(-g, -f) = (2, -3)$", "বৃত্ত"),
      M("m6-5", "$x + y = 4$ ও $x - y = 2$ রেখার ছেদবিন্দু কোনটি?", ["$(3, 1)$", "$(1, 3)$", "$(2, 2)$", "$(4, 0)$"], 0, "যোগ করে $2x = 6$, $x = 3$, $y = 1$", "সরলরেখা"),
      M("m6-6", "মূলবিন্দু থেকে $3x + 4y = 10$ রেখার লম্বদূরত্ব কত?", ["$2$", "$10$", "$\\frac{5}{2}$", "$1$"], 0, "$\\frac{|0 + 0 - 10|}{\\sqrt{3^2 + 4^2}} = 2$", "সরলরেখা"),
      M("m6-7", "চিত্রের রেখাটি $y$ অক্ষের সমান্তরাল। এর ঢাল কেমন?", ["$0$", "$1$", "অসংজ্ঞায়িত", "$-1$"], 2, "উল্লম্ব রেখায় $\\tan 90°$ সংজ্ঞায়িত নয়।", "সরলরেখা", { image: FIG_VLINE }),
      M("m6-8", "দুটি রেখা পরস্পর লম্ব হলে তাদের ঢালের গুণফল কত?", ["$1$", "$0$", "$-1$", "$2$"], 2, "$m_1 m_2 = -1$", "সরলরেখা"),
      M("m6-9", "$x^2 + y^2 = 9$ বৃত্তের পরিধি কত?", ["$6\\pi$", "$9\\pi$", "$3\\pi$", "$18\\pi$"], 0, "$2\\pi r = 2\\pi \\times 3 = 6\\pi$", "বৃত্ত"),
      M("m6-10", "নিচের কোনটি বৃত্তের সমীকরণ?", ["$x^2 + y^2 = 1$", "$x^2 + y^2 + 2x = 0$", "$(x - 1)^2 + y^2 = 4$", "সবগুলো"], 3, "তিনটিই বৃত্ত।", "বৃত্ত", { lock: true }),
    ],
  },
  {
    id: "mix12", title: "মাসিক পরীক্ষা: ডিসেম্বর (MCQ + লিখিত)", course: "eng_math", courseName: "ইঞ্জিনিয়ারিং গণিত প্রস্তুতি", kind: "mixed", minutes: 40, neg: 0.25,
    pick: { "সৃজনশীল": 2 },
    questions: [
      M("x12-1", "$\\lim_{x \\to 0} \\frac{\\sin x}{x}$ এর মান কত?", ["$0$", "$1$", "$\\infty$", "$-1$"], 1, "মৌলিক সীমা।", "অন্তরীকরণ"),
      M("x12-2", "$\\frac{d}{dx}(x^3)$ কত?", ["$x^2$", "$3x^2$", "$3x$", "$x^3$"], 1, "$\\frac{d}{dx} x^n = n x^{n-1}$", "অন্তরীকরণ"),
      M("x12-3", "$\\int 2x \\, dx$ কত?", ["$x^2 + c$", "$2x^2 + c$", "$x + c$", "$2 + c$"], 0, "", "যোগজীকরণ"),
      M("x12-4", "$A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ হলে $|A|$ কত?", ["$-2$", "$2$", "$10$", "$-10$"], 0, "$4 - 6 = -2$", "ম্যাট্রিক্স"),
      M("x12-5", "$\\log_2 8$ এর মান কত?", ["$2$", "$3$", "$4$", "$8$"], 1, "$2^3 = 8$", "লগারিদম"),
      { id: "x12-w1", kind: "written", section: "সৃজনশীল", marks: 10, chapter: "অন্তরীকরণ", exp: "", scheme: "", body: "$f(x) = x^3 - 3x$\nক. $f'(x)$ নির্ণয় করো। (২)\nখ. $f(x)$ এর গুরুমান ও লঘুমান নির্ণয় করো। (৪)\nগ. $[-2, 2]$ ব্যবধিতে $f(x)$ এর লেখচিত্র আঁকো। (৪)" },
      { id: "x12-w2", kind: "written", section: "সৃজনশীল", marks: 10, chapter: "যোগজীকরণ", exp: "", scheme: "", body: "$I = \\int_0^1 x e^x \\, dx$\nক. $\\int e^x dx$ লেখো। (২)\nখ. খণ্ডিত যোগজীকরণে $I$ নির্ণয় করো। (৪)\nগ. $y = x e^x$, $x$ অক্ষ আর $x = 1$ দিয়ে ঘেরা ক্ষেত্রের ক্ষেত্রফল নির্ণয় করো। (৪)" },
      { id: "x12-w3", kind: "written", section: "সৃজনশীল", marks: 10, chapter: "ম্যাট্রিক্স", exp: "", scheme: "", body: "$A = \\begin{pmatrix} 2 & 1 \\\\ 1 & 3 \\end{pmatrix}$\nক. $A^T$ নির্ণয় করো। (২)\nখ. $A^{-1}$ নির্ণয় করো। (৪)\nগ. $AX = \\begin{pmatrix} 4 \\\\ 7 \\end{pmatrix}$ সমাধান করো। (৪)" },
    ],
  },
  {
    id: "mcq05", title: "সাপ্তাহিক MCQ ০৫: দ্বিঘাত সমীকরণ", course: "math1st", courseName: "উচ্চতর গণিত ১ম পত্র", kind: "mcq", minutes: 15, neg: 0.25, pick: {},
    questions: [
      M("m5-1", "$x^2 - 5x + 6 = 0$ এর মূলদ্বয় কী?", ["$2, 3$", "$-2, -3$", "$1, 6$", "$-1, -6$"], 0, "$(x - 2)(x - 3) = 0$", "দ্বিঘাত সমীকরণ"),
      M("m5-2", "$ax^2 + bx + c = 0$ এর নিশ্চায়ক কোনটি?", ["$b^2 - 4ac$", "$b^2 + 4ac$", "$4ac - b^2$", "$\\sqrt{b^2 - 4ac}$"], 0, "", "দ্বিঘাত সমীকরণ"),
      M("m5-3", "মূলদ্বয় সমান হলে নিশ্চায়ক কেমন?", ["ধনাত্মক", "ঋণাত্মক", "শূন্য", "পূর্ণবর্গ"], 2, "$b^2 - 4ac = 0$", "দ্বিঘাত সমীকরণ"),
      M("m5-4", "$x^2 - 4x + k = 0$ এর মূলদ্বয় সমান হলে $k$ কত?", ["$2$", "$8$", "$4$", "$-4$"], 1, "$16 - 4k = 0 \\Rightarrow k = 4$", "দ্বিঘাত সমীকরণ"),
      M("m5-5", "$2x^2 + 6x + 1 = 0$ এর মূলদ্বয়ের যোগফল কত?", ["$3$", "$-3$", "$6$", "$\\frac{1}{2}$"], 1, "$-\\frac{b}{a} = -3$", "দ্বিঘাত সমীকরণ"),
      M("m5-6", "$2x^2 + 6x + 1 = 0$ এর মূলদ্বয়ের গুণফল কত?", ["$\\frac{1}{2}$", "$2$", "$-\\frac{1}{2}$", "$6$"], 0, "$\\frac{c}{a} = \\frac{1}{2}$", "দ্বিঘাত সমীকরণ"),
      M("m5-7", "$x^2 + px + 9 = 0$ এর মূলদ্বয় সমান হলে $p$ কত? (ছাপায় শর্ত বাদ পড়েছিল)", ["$\\pm 6$", "$\\pm 3$", "$9$", "$0$"], 0, "$p^2 = 36$", "দ্বিঘাত সমীকরণ"),
      M("m5-8", "$x^2 + 1 = 0$ এর মূলদ্বয় কেমন?", ["বাস্তব", "জটিল (কাল্পনিক)", "শূন্য", "মূলদ"], 1, "নিশ্চায়ক $-4 < 0$", "দ্বিঘাত সমীকরণ"),
      M("m5-9", "মূলদ্বয় $2$ ও $3$ হলে সমীকরণ কোনটি?", ["$x^2 - 5x + 6 = 0$", "$x^2 + 5x + 6 = 0$", "$x^2 - 6x + 5 = 0$", "$x^2 - x - 6 = 0$"], 0, "$x^2 - (2 + 3)x + 2 \\cdot 3 = 0$", "দ্বিঘাত সমীকরণ"),
      M("m5-10", "$x^2 - 2x - 8 = 0$ এর একটি মূল কোনটি?", ["$4$", "$2$", "$-4$", "$8$"], 0, "$(x - 4)(x + 2) = 0$", "দ্বিঘাত সমীকরণ"),
    ],
  },
];

// পরীক্ষার পরে সংশোধন (correct_exam_question)
export const CORRECTIONS: Record<string, Correction[]> = {
  mcq05: [
    { qid: "m5-7", action: "award", reason: "ছাপায় \"মূলদ্বয় সমান হলে\" শর্তটি বাদ পড়েছিল, তাই সবাই পূর্ণ নম্বর পাবে", by: "সাঈদ সামি" },
    { qid: "m5-4", action: "key", from: 1, to: 2, reason: "উত্তরমালায় ভুল ছিল, সঠিক উত্তর ৪ (গ)", by: "সাঈদ সামি" },
  ],
};

const MIN = 60e3, HOUR = 36e5, DAY = 864e5;
export const UPLOAD_GRACE = 15 * MIN;
// প্রথমবার পাতা খোলার সময় থেকে: ২টা চলছে, ১টা গত সপ্তাহে শেষ (Alex দিয়েছিল)
export function seedState(now: number): { windows: Windows; attempts: Record<string, Attempt> } {
  return {
    windows: { mcq06: { opens: now - 10 * MIN, closes: now + 3 * HOUR }, mix12: { opens: now - 30 * MIN, closes: now + 6 * HOUR }, mcq05: { opens: now - 3 * DAY, closes: now - 2 * DAY } },
    attempts: {
      mcq05: { examId: "mcq05", started: now - 3 * DAY + 2 * HOUR, deadline: now - 3 * DAY + 2 * HOUR + 15 * MIN, submitted: now - 3 * DAY + 2 * HOUR + 11 * MIN, status: "submitted",
        answers: { "m5-1": 0, "m5-2": 0, "m5-3": 2, "m5-4": 1, "m5-5": 0, "m5-6": 0, "m5-8": 1, "m5-9": 2, "m5-10": 0 }, picked: [], pages: {}, endReason: "submit", uploadUntil: null },
    },
  };
}

export const mcqs = (e: Exam) => e.questions.filter((q): q is Mcq => q.kind === "mcq");
export const writtenQs = (e: Exam) => e.questions.filter((q): q is Written => q.kind === "written");
export const examById = (id: string | null) => EXAMS.find((e) => e.id === id);

export function keyOf(e: Exam, q: Mcq) {
  const cs = (CORRECTIONS[e.id] ?? []).filter((c) => c.qid === q.id);
  const k = cs.filter((c) => c.action === "key").pop();
  const cancel = cs.filter((c) => c.action === "drop" || c.action === "award").pop();
  return { key: k?.to ?? q.key, cancelled: cancel ? (cancel.action as "drop" | "award") : null };
}
export function grade(e: Exam, answers: Record<string, number>) {
  let score = 0, correct = 0, wrong = 0, skipped = 0, total = 0;
  mcqs(e).forEach((q) => {
    const { key, cancelled } = keyOf(e, q);
    if (cancelled === "drop") return;
    total += q.marks;
    if (cancelled === "award") { score += q.marks; correct++; return; }
    const a = answers[q.id];
    if (a === undefined || a === null) skipped++;
    else if (a === key) { score += q.marks; correct++; }
    else { score -= e.neg; wrong++; }
  });
  return { score: Math.round(score * 100) / 100, correct, wrong, skipped, total };
}

// প্রতিবার একই এলোমেলো সংখ্যা (ক্লাসের বাকিদের নম্বর বানাতে)
export const rng = (seedStr: string) => {
  let s = [...seedStr].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
export const shuffle = <T,>(arr: T[], rnd = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

type Peer = { name: string; answers: Record<string, number>; secs: number };
export function peers(e: Exam): Peer[] {
  const r = rng("peers-" + e.id);
  const FIRST = ["তাহমিদ", "সাদিয়া", "নাফিসা", "ইমরান", "ফারহানা", "আবির", "লামিয়া", "রিয়াদ", "সুমাইয়া", "জুবায়ের", "মেহজাবিন", "তাসনিম", "সাকিব", "নুসাইবা", "আরিফ", "রাইসা"];
  const LAST = ["রহমান", "আক্তার", "ইসলাম", "হোসেন", "চৌধুরী", "হাসান", "আহমেদ", "কবির"];
  const diff = Object.fromEntries(mcqs(e).map((q) => [q.id, 0.35 + r() * 0.55]));
  return Array.from({ length: 41 }, (_, i) => {
    const ability = 0.55 + r() * 0.6, answers: Record<string, number> = {};
    mcqs(e).forEach((q) => {
      const x = r();
      if (x < 0.08) return;
      const right = q.id === "m5-4" ? (r() < 0.35 ? 1 : 2) : q.key;
      answers[q.id] = x < 0.08 + Math.min(0.97, diff[q.id] * ability) ? right : q.options.map((_, k) => k).filter((k) => k !== right)[Math.floor(r() * (q.options.length - 1))];
    });
    return { name: FIRST[i % FIRST.length] + " " + LAST[(i * 3) % LAST.length], answers, secs: Math.round((0.45 + r() * 0.55) * e.minutes * 60) };
  });
}

export type Solution = { no: number; q: Mcq; key: number; cancelled: "drop" | "award" | null; mine: number | null; pct: number[]; skip: number };
export type Ranked = { name: string; me?: boolean; secs: number; score: number; rank: number };
export function result(e: Exam, a: Attempt, closed: boolean, me: string) {
  const out = { ...grade(e, a.answers), rank: 0, attendees: 0, top: [] as Ranked[], solutions: [] as Solution[] };
  if (!closed) return out;
  const all = [...peers(e).map((p) => ({ ...p, ...grade(e, p.answers), me: false })),
    { name: `${me} (তুমি)`, me: true, answers: a.answers, secs: Math.round((Math.min(a.submitted ?? a.deadline, a.deadline) - a.started) / 1000), ...grade(e, a.answers) }];
  all.sort((x, y) => y.score - x.score || x.secs - y.secs);
  const ranked = all.map((x) => ({ ...x, rank: 0 }));
  ranked.forEach((x, i) => { x.rank = i && ranked[i - 1].score === x.score && ranked[i - 1].secs === x.secs ? ranked[i - 1].rank : i + 1; });
  out.rank = ranked.find((x) => x.me)!.rank; out.attendees = ranked.length; out.top = ranked.slice(0, 10);
  out.solutions = mcqs(e).map((q, i) => {
    const { key, cancelled } = keyOf(e, q);
    const pct = q.options.map((_, k) => Math.round(1000 * ranked.filter((x) => x.answers[q.id] === k).length / ranked.length) / 10);
    return { no: i + 1, q, key, cancelled, mine: a.answers[q.id] ?? null, pct, skip: Math.round(1000 * ranked.filter((x) => x.answers[q.id] == null).length / ranked.length) / 10 };
  });
  return out;
}

// অনুশীলন: পরীক্ষা শেষে প্রশ্ন নতুন এলোমেলো ক্রমে (অপশনও), নম্বর ফোনে হিসাব
export type PracQ = { id: string; body: string; chapter: string; exp: string; marks: number; image: string | null; award: boolean; options: string[]; key: number };
export function practicePaper(e: Exam): PracQ[] {
  return shuffle(mcqs(e).filter((q) => keyOf(e, q).cancelled !== "drop")).map((q) => {
    const { key, cancelled } = keyOf(e, q), o = q.options.map((_, i) => i), order = q.lock ? o : shuffle(o);
    return { id: q.id, body: q.body, chapter: q.chapter, exp: q.exp, marks: q.marks, image: q.image ?? null, award: cancelled === "award", options: order.map((i) => q.options[i]), key: order.indexOf(key) };
  });
}

// অধ্যায়ভিত্তিক অবস্থা (my_chapter_report): শেষ হওয়া পরীক্ষার MCQ আর প্রকাশিত লিখিত, আমি বনাম ক্লাস
export function chapterReport(course: string, windows: Windows, attempts: Record<string, Attempt>, now: number) {
  const rows: Record<string, { chapter: string; myGot: number; myPos: number; clsGot: number; clsPos: number }> = {};
  const add = (ch: string, mine: boolean, got: number, possible: number) => {
    const r = rows[ch] ??= { chapter: ch, myGot: 0, myPos: 0, clsGot: 0, clsPos: 0 };
    if (mine) { r.myGot += got; r.myPos += possible; }
    r.clsGot += got; r.clsPos += possible;
  };
  EXAMS.filter((e) => e.course === course && windows[e.id] && now >= windows[e.id].closes).forEach((e) => {
    const a = attempts[e.id];
    const people = [...peers(e).map((p) => ({ answers: p.answers, me: false })), ...(a && a.status !== "in_progress" ? [{ answers: a.answers, me: true }] : [])];
    mcqs(e).forEach((q) => {
      const { key, cancelled } = keyOf(e, q);
      if (cancelled === "drop") return;
      people.forEach((p) => add(q.chapter, p.me, cancelled === "award" || p.answers[q.id] === key ? q.marks : 0, q.marks));
    });
  });
  // প্রকাশিত লিখিত (wx2 এর ৬টা খাতা, তোমারটা ৬.৫)
  [9, 6.5, 3, 8, 7.5, 2].forEach((got, i) => add("ম্যাট্রিক্স", i === 1, got, 10));
  return Object.values(rows).map((r) => ({ chapter: r.chapter, my: r.myPos ? Math.round(1000 * r.myGot / r.myPos) / 10 : null, cls: Math.round(1000 * r.clsGot / r.clsPos) / 10 }));
}

// ---------- লিখিত খাতা (MarkStore): খাতা কাটা চলছে একটা, ফল প্রকাশিত একটা ----------
export const RECHECK_DAYS = 3, RECHECK_MAX = 3;
export type Ann = { t: "k" | "x"; x: number; y: number } | { t: "p"; pts: [number, number][] } | { t: "t"; x: number; y: number; v: string };
export type ScriptQ = { id: string; label: string; marks: number; body: string; solution: string; scheme: string; lines: string[]; got: number | null; note: string; ann: Ann[] };
export type Script = { id: string; title: string; courseName: string; kind: "written" | "mixed"; code: string; publishedAgo: number | null; questions: ScriptQ[] };
export const SCRIPTS: Script[] = [
  {
    id: "wx3-s1", title: "সাপ্তাহিক লিখিত পরীক্ষা ০৩: সরলরেখা", courseName: "উচ্চতর গণিত ১ম পত্র", kind: "written", code: "K7Q2M9TA", publishedAgo: null,
    questions: [
      { id: "wx3-1", label: "সৃজনশীল ১", marks: 10, body: "", solution: "", scheme: "", lines: [], got: 7, note: "", ann: [] },
      { id: "wx3-2", label: "সৃজনশীল ২", marks: 10, body: "", solution: "", scheme: "", lines: [], got: 9, note: "", ann: [] },
    ],
  },
  {
    id: "wx2-s2", title: "সাপ্তাহিক লিখিত পরীক্ষা ০২: ম্যাট্রিক্স", courseName: "উচ্চতর গণিত ১ম পত্র", kind: "written", code: "R6D5J2XN", publishedAgo: DAY,
    questions: [
      {
        id: "wx2-1", label: "সৃজনশীল ১", marks: 10, got: 6.5,
        body: "A = [[2, 1], [3, 4]]।\nক. |A| নির্ণয় করো। (২)\nখ. A⁻¹ নির্ণয় করো। (৪)\nগ. AX = [5, 6] হলে X নির্ণয় করো। (৪)",
        solution: "ক. 5\nখ. (1/5)[[4, −1], [−3, 2]]\nগ. X = A⁻¹[5, 6] = [14/5, −3/5]",
        scheme: "ক ২, খ: adj ২ + ভাগ ২, গ: গুণ ৪",
        lines: ["ক. |A| = 8 − 3 = 5", "খ. A⁻¹ = (1/5)[[4, 1], [3, 2]]"],
        note: "খ অংশে adj A এর চিহ্ন ভুল, তাই A⁻¹ ভুল। গ অংশ করোনি।",
        ann: [{ t: "k", x: 0.62, y: 0.17 }, { t: "p", pts: [[0.24, 0.27], [0.4, 0.275], [0.6, 0.27]] }, { t: "t", x: 0.64, y: 0.26, v: "চিহ্ন ভুল" }],
      },
    ],
  },
];
