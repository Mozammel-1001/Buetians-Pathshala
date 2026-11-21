"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Scan, type Pt } from "@/lib/scan";
import type { Ann, Page, Written } from "./data";
import { Badge, BTN_GHOST, CARD, MUTED, Tex, bn } from "./ui";

// লিখিত অংশ (practice.html এর writtenCard, cropImage, pdfToBlobs, bindDrag, pageHtml/drawAnn)

// ---------- খাতার ছবি → পাতা (ছোট ছবি তালিকার জন্য, বড়টা দেখার জন্য) ----------
export async function blobToPage(blob: Blob, online: boolean): Promise<Page> {
  const bmp = await createImageBitmap(blob);
  const sc = Math.min(1, 360 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  // [PRODUCTION] পুরো JPEG Storage এর private 'scripts' bucket এ সরাসরি upload (script_pages)
  return { id: "local-" + Math.random().toString(36).slice(2), thumb: c.toDataURL("image/jpeg", 0.6), full: URL.createObjectURL(blob), status: online ? "up" : "wait" };
}

// PDF → প্রতিটি পাতা ছবি (সর্বোচ্চ ১০), pdf.js লাগলে তখনই নামে
type PdfLib = { GlobalWorkerOptions: { workerSrc: string }; getDocument: (o: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } }> }> } };
function loadPdfJs(): Promise<PdfLib> {
  const w = window as unknown as { pdfjsLib?: PdfLib };
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { w.pdfjsLib!.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(w.pdfjsLib!); };
    s.onerror = () => rej(new Error("pdf"));
    document.head.appendChild(s);
  });
}
export async function pdfToBlobs(file: File): Promise<Blob[]> {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: Blob[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 10); p++) {
    const page = await doc.getPage(p), vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 1500 / Math.max(vp0.width, vp0.height) });
    const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    out.push(await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.82)));
  }
  return out;
}

// ---------- বাঁকা ছবি সোজা করা: চার কোণা নিজে খোঁজে, টেনে ঠিক করা যায়, ৯০° ঘোরানো, "স্ক্যানের মতো পরিষ্কার" ----------
export function CropBody({ file, onReady }: { file: File; onReady: (api: { done: () => Promise<Blob | null> }) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const st = useRef<{ bmp: ImageBitmap; pts: Pt[]; k: number; drag: number } | null>(null);
  const [auto, setAuto] = useState<boolean | null>(null);
  const [scan, setScan] = useState(true);
  const scanRef = useRef(true);
  useEffect(() => { scanRef.current = scan; }, [scan]);

  const place = () => {
    const b = box.current, s = st.current; if (!b || !s) return;
    b.querySelector("polygon")!.setAttribute("points", s.pts.map((q) => (q[0] * s.k).toFixed(1) + "," + (q[1] * s.k).toFixed(1)).join(" "));
    b.querySelectorAll<HTMLElement>(".ex-handle").forEach((h, i) => { h.style.left = s.pts[i][0] * s.k + "px"; h.style.top = s.pts[i][1] * s.k + "px"; });
  };
  const draw = () => {
    const b = box.current, s = st.current; if (!b || !s) return;
    const maxW = Math.min(b.parentElement!.clientWidth || 640, 680), maxH = Math.max(260, window.innerHeight * 0.55);
    s.k = Math.min(maxW / s.bmp.width, maxH / s.bmp.height, 1);
    const w = Math.round(s.bmp.width * s.k), h = Math.round(s.bmp.height * s.k);
    b.style.width = w + "px"; b.style.height = h + "px";
    const c = b.querySelector("canvas")!; c.width = w; c.height = h; c.getContext("2d")!.drawImage(s.bmp, 0, 0, w, h);
    b.querySelector("svg")!.setAttribute("viewBox", `0 0 ${w} ${h}`);
    place();
  };
  useEffect(() => {
    let dead = false;
    (async () => {
      const bmp = await Scan.loadBitmap(file);
      if (dead) return;
      const det = Scan.detectCorners(bmp);
      st.current = { bmp, pts: det.pts.map((q) => [q[0], q[1]] as Pt), k: 1, drag: -1 };
      setAuto(det.auto);
      requestAnimationFrame(draw);
    })();
    onReady({ done: async () => { const s = st.current; if (!s) return null; try { return await Scan.warpToBlob(s.bmp, s.pts, scanRef.current); } catch { return null; } } });
    return () => { dead = true; };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = async (dir: number) => {
    const s = st.current; if (!s) return;
    const c = document.createElement("canvas"); c.width = s.bmp.height; c.height = s.bmp.width;
    const g = c.getContext("2d")!; g.translate(c.width / 2, c.height / 2); g.rotate((dir * Math.PI) / 2); g.drawImage(s.bmp, -s.bmp.width / 2, -s.bmp.height / 2);
    s.bmp = await createImageBitmap(c);
    const det = Scan.detectCorners(s.bmp); s.pts = det.pts.map((q) => [q[0], q[1]] as Pt); setAuto(det.auto); draw();
  };
  return (
    <>
      <p className={`mb-3 text-sm ${MUTED}`}>{auto === null ? "ছবি পড়া হচ্ছে…" : auto ? "খাতার কোণা নিজে থেকে ধরা হয়েছে। ঠিক না হলে সবুজ বিন্দুগুলো টেনে খাতার চার কোণায় বসাও।" : "কোণা খুঁজে পাওয়া যায়নি। সবুজ বিন্দুগুলো টেনে খাতার চার কোণায় বসাও।"}</p>
      <div className="flex w-full justify-center">
        <div ref={box} className="ex-crop"
          onPointerDown={(ev) => { const h = (ev.target as HTMLElement).closest<HTMLElement>(".ex-handle"); if (!h || !st.current) return; st.current.drag = +h.dataset.h!; box.current!.setPointerCapture(ev.pointerId); ev.preventDefault(); }}
          onPointerMove={(ev) => {
            const s = st.current; if (!s || s.drag < 0) return;
            const r = box.current!.getBoundingClientRect();
            s.pts[s.drag] = [Math.min(Math.max((ev.clientX - r.left) / s.k, 0), s.bmp.width), Math.min(Math.max((ev.clientY - r.top) / s.k, 0), s.bmp.height)];
            place();
          }}
          onPointerUp={() => { if (st.current) st.current.drag = -1; }} onPointerCancel={() => { if (st.current) st.current.drag = -1; }}>
          <canvas />
          <svg><polygon fill="rgba(16,185,129,.12)" stroke="#10b981" strokeWidth="2" /></svg>
          {[0, 1, 2, 3].map((i) => <span key={i} className="ex-handle" data-h={i} title="টেনে কোণায় বসাও" />)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={() => rotate(-1)}><span className="icon text-[18px]">rotate_left</span>বাঁয়ে ঘোরাও</button>
        <button type="button" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={() => rotate(1)}><span className="icon text-[18px]">rotate_right</span>ডানে ঘোরাও</button>
        <button type="button" className={`${BTN_GHOST} px-3! py-1.5!`} onClick={() => { const s = st.current; if (!s) return; s.pts = [[0, 0], [s.bmp.width, 0], [s.bmp.width, s.bmp.height], [0, s.bmp.height]]; place(); }}>পুরো ছবি</button>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={scan} onChange={(e) => setScan(e.target.checked)} className="h-4 w-4 accent-[#006c49]" /> স্ক্যানের মতো পরিষ্কার</label>
      </div>
    </>
  );
}

// ---------- একটা লিখিত প্রশ্ন: বাছাই, ছবি তোলা/গ্যালারি/PDF, পাতার তালিকা (টেনে ক্রম বদল, মোছা, বড় করে দেখা) ----------
export function WrittenCard({ q, index, on, full, locked, finished, pages, onToggle, onFiles, onDelete, onMove, onZoom }: {
  q: Written; index: number; on: boolean; full: boolean; locked: boolean; finished: boolean; pages: Page[];
  onToggle: (on: boolean) => void; onFiles: (files: FileList) => void; onDelete: (pid: string) => void; onMove: (from: string, to: string) => void; onZoom: (src: string) => void;
}) {
  const drag = useRef<{ x: number; y: number; moved: boolean; id: string } | null>(null);
  return (
    <div className={`${CARD} p-4 md:p-6 ${on ? "border-primary/60! dark:border-primary-fixed/50!" : ""}`}>
      <div className={`mb-2 flex flex-wrap justify-between gap-2 text-xs ${MUTED}`}><span>{q.section} {bn(index + 1)} · {bn(q.marks)} নম্বর</span></div>
      <Tex src={q.body} className="mb-4 leading-relaxed text-on-background dark:text-background" />
      {finished ? <Badge tone="green" icon="check">বাছাই করেছ</Badge> : (
        <label className={`inline-flex cursor-pointer items-center gap-3 font-bold select-none ${full ? "cursor-not-allowed opacity-50" : ""}`}>
          <input type="checkbox" className="h-5 w-5 accent-[#006c49]" checked={on} disabled={full || locked} onChange={(e) => onToggle(e.target.checked)} /> এই প্রশ্নের উত্তর দেব
        </label>
      )}
      {full && <p className={`mt-1 text-xs ${MUTED}`}>{q.section} থেকে সর্বোচ্চ সংখ্যক বাছাই হয়ে গেছে, অন্যটা নিতে আগে একটা বাদ দাও।</p>}
      {on && (
        <div className="mt-4 rounded-2xl border border-dashed border-primary/50 p-4">
          <div className="flex flex-wrap gap-2">
            <label className={`${BTN_GHOST} cursor-pointer`}><span className="icon text-[18px]">photo_camera</span>ছবি তুলুন<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} /></label>
            <label className={`${BTN_GHOST} cursor-pointer`}><span className="icon text-[18px]">upload_file</span>গ্যালারি বা PDF<input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} /></label>
          </div>
          {pages.length ? (
            <>
              <div className="mt-4 flex flex-wrap gap-3">
                {pages.map((p, k) => (
                  <div key={p.id} className="ex-thumb" data-page={p.id} data-q={q.id}
                    onPointerDown={(ev) => { drag.current = { x: ev.clientX, y: ev.clientY, moved: false, id: p.id }; try { (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* ignore */ } }}
                    onPointerMove={(ev) => { const d = drag.current; if (d && !d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 8) { d.moved = true; (ev.currentTarget as HTMLElement).classList.add("is-drag"); } }}
                    onPointerUp={(ev) => {
                      const d = drag.current; drag.current = null; (ev.currentTarget as HTMLElement).classList.remove("is-drag");
                      if (!d) return;
                      if (!d.moved) { onZoom(p.full || p.thumb); return; }
                      const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>(".ex-thumb");
                      if (t && t.dataset.q === q.id && t.dataset.page !== d.id) onMove(d.id, t.dataset.page!);
                    }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt={`পাতা ${bn(k + 1)}`} draggable={false} />
                    <span className="ex-pno">পাতা {bn(k + 1)}</span>
                    <span className="ex-pst" title={p.status === "up" ? "সার্ভারে আছে" : "নেট এলে যাবে"}><span className="icon text-[14px]">{p.status === "up" ? "cloud_done" : "cloud_upload"}</span></span>
                    <button type="button" className="ex-del" title="মুছুন" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>×</button>
                  </div>
                ))}
              </div>
              <p className={`mt-2 text-[11px] ${MUTED}`}>ছবিতে চাপলে বড় দেখাবে। ধরে টেনে অন্য ছবির উপর ছাড়লে পাতার ক্রম বদলাবে।</p>
            </>
          ) : <p className={`mt-3 text-xs ${MUTED}`}>এখনো কোনো পাতা দাওনি</p>}
        </div>
      )}
    </div>
  );
}

// ---------- কাটা খাতা: লাইন টানা কাগজে লেখা, উপরে লাল দাগ (SVG, পাতার মাপে) ----------
const RED = "#e11d1d";
export function Khata({ code, label, lines, ann }: { code: string; label: string; lines: string[]; ann: Ann[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.3);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => setRatio(+(el.offsetHeight / el.offsetWidth).toFixed(4));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const path = (pts: [number, number][]) => "M" + pts.map((q) => q[0].toFixed(4) + " " + q[1].toFixed(4)).join("L");
  return (
    <div ref={ref} className="khata">
      <div className="k-head"><span>খাতা #{code}</span><span>{label} · পাতা ১</span></div>
      <div className="ln">উত্তর: {label}</div>
      {lines.map((l, i) => <div key={i} className="ln">{l}</div>)}
      <svg viewBox={`0 0 1 ${ratio}`} preserveAspectRatio="none">
        {ann.map((a, i) => a.t === "p" ? <path key={i} d={path(a.pts)} fill="none" stroke={RED} strokeWidth="0.004" strokeLinecap="round" strokeLinejoin="round" />
          : a.t === "k" ? <path key={i} d={`M${a.x - 0.025} ${a.y} L${a.x - 0.008} ${a.y + 0.022} L${a.x + 0.03} ${a.y - 0.03}`} fill="none" stroke={RED} strokeWidth="0.006" strokeLinecap="round" strokeLinejoin="round" />
          : a.t === "x" ? <path key={i} d={`M${a.x - 0.02} ${a.y - 0.02} L${a.x + 0.02} ${a.y + 0.02} M${a.x + 0.02} ${a.y - 0.02} L${a.x - 0.02} ${a.y + 0.02}`} fill="none" stroke={RED} strokeWidth="0.006" strokeLinecap="round" />
          : "v" in a ? <text key={i} x={a.x} y={a.y} fontSize="0.032" fill={RED} fontFamily="Hind Siliguri, sans-serif" fontWeight="700" style={{ paintOrder: "stroke", stroke: "#fffdf6", strokeWidth: 0.004 }}>{a.v}</text> : null)}
      </svg>
    </div>
  );
}
