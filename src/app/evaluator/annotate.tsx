"use client";

import { useRef, useState } from "react";
import { bn } from "./lib";

// খাতার একটা পাতা: শিক্ষার্থীর তোলা ছবি, উপরে লাল দাগের SVG (evaluator_dashboard.html এর pageHtml/drawAnn/bindPage)।
// দাগের মাপ পাতার প্রস্থের ভগ্নাংশে (x: ০-১, y: উচ্চতা/প্রস্থ পর্যন্ত), তাই যে মাপেই দেখা হোক একই জায়গায় পড়ে।
// onAdd না থাকলে শুধু দেখা (কাটা খাতা, শিক্ষার্থীর ফল); থাকলে tool অনুযায়ী আঁকা যায়
export type Pt = [number, number];
export type Ann = { t: "p"; pts: Pt[] } | { t: "k"; x: number; y: number } | { t: "x"; x: number; y: number } | { t: "t"; x: number; y: number; v: string };
export type AnnMap = Record<string, Ann[]>;
export type Tool = "scroll" | "pen" | "tick" | "cross" | "text";
const RED = "#e11d1d";

const path = (pts: Pt[]) => "M" + pts.map((q) => q[0].toFixed(4) + " " + q[1].toFixed(4)).join("L");

function Mark({ a }: { a: Ann }) {
  if (a.t === "p") return <path d={path(a.pts)} fill="none" stroke={RED} strokeWidth={0.004} strokeLinecap="round" strokeLinejoin="round" />;
  if (a.t === "k") return <path d={`M${a.x - 0.025} ${a.y} L${a.x - 0.008} ${a.y + 0.022} L${a.x + 0.03} ${a.y - 0.03}`} fill="none" stroke={RED} strokeWidth={0.006} strokeLinecap="round" strokeLinejoin="round" />;
  if (a.t === "x") return <path d={`M${a.x - 0.02} ${a.y - 0.02} L${a.x + 0.02} ${a.y + 0.02} M${a.x + 0.02} ${a.y - 0.02} L${a.x - 0.02} ${a.y + 0.02}`} fill="none" stroke={RED} strokeWidth={0.006} strokeLinecap="round" />;
  return <text x={a.x} y={a.y} fontSize={0.032} fill={RED} fontFamily="Hind Siliguri, sans-serif" fontWeight={700} style={{ paintOrder: "stroke", stroke: "#fffdf6", strokeWidth: 0.004 }}>{a.v}</text>;
}

export function AnnotatedPage({ src, tag, items, tool = "scroll", onAdd, onText }: {
  src: string; tag: string; items?: Ann[]; tool?: Tool; onAdd?: (a: Ann) => void; onText?: (p: Pt) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.4);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const live = useRef<Pt[] | null>(null);
  const editing = !!onAdd && tool !== "scroll";
  const pt = (e: React.PointerEvent): Pt => { const r = box.current!.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width]; };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editing) return;
    const p = pt(e);
    if (tool === "pen") { e.currentTarget.setPointerCapture(e.pointerId); live.current = [p]; setDraft([p]); }
    else if (tool === "tick") onAdd!({ t: "k", x: p[0], y: p[1] });
    else if (tool === "cross") onAdd!({ t: "x", x: p[0], y: p[1] });
    else if (tool === "text") onText?.(p);
  };
  const move = (e: React.PointerEvent) => { if (live.current) { live.current.push(pt(e)); setDraft([...live.current]); } };
  const up = () => {
    const d = live.current;
    live.current = null; setDraft(null);
    if (d && d.length > 1) onAdd?.({ t: "p", pts: d.filter((_, i) => i % 2 === 0 || i === d.length - 1) });
  };

  return (
    <div ref={box} className={`khata-img ${editing ? "tool-on" : ""}`} data-khata onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, আকার জানা নেই */}
      <img src={src} alt={tag} draggable={false} onLoad={(e) => setRatio(e.currentTarget.naturalHeight / Math.max(1, e.currentTarget.naturalWidth))} />
      <span className="k-tag">{tag}</span>
      <svg viewBox={`0 0 1 ${ratio.toFixed(4)}`} preserveAspectRatio="none" data-ann>
        {(items ?? []).map((a, i) => <Mark key={i} a={a} />)}
        {draft && <path d={path(draft)} fill="none" stroke={RED} strokeWidth={0.004} strokeLinecap="round" />}
      </svg>
    </div>
  );
}

// একটা খাতার সব পাতা, প্রতিটার নিজের দাগ ({"p1": [...], "p2": [...]})
export function Pages({ urls, code, ann, tool, onAdd, onText }: {
  urls: string[]; code: string; ann?: AnnMap | null; tool?: Tool; onAdd?: (pk: string, a: Ann) => void; onText?: (pk: string, p: Pt) => void;
}) {
  if (!urls.length) return <div className="p-8 text-center text-on-surface-variant dark:text-surface-variant">এই প্রশ্নে কোনো পাতা নেই</div>;
  return (
    <>
      {urls.map((u, i) => {
        const pk = "p" + (i + 1);
        return (
          <div key={pk} className={i ? "mt-2 md:mt-4" : ""}>
            <AnnotatedPage src={u} tag={`খাতা #${code} · পাতা ${bn(i + 1)}/${bn(urls.length)}`} items={ann?.[pk]} tool={tool}
              onAdd={onAdd ? (a) => onAdd(pk, a) : undefined} onText={onText ? (p) => onText(pk, p) : undefined} />
          </div>
        );
      })}
    </>
  );
}
