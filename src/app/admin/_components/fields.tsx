"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

// অ্যাডমিন ফর্মের ছোট অংশ: ঘর, লেখার ঘর, ছবি/PDF আপলোড, তালিকা (যোগ, মোছা, উপরে-নিচে), সেভের অবস্থা

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: ReactNode; id?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-bold text-error dark:text-red-300">{error}</p>}
    </div>
  );
}

type TextProps = {
  label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string;
  multiline?: boolean; rows?: number; type?: string; placeholder?: string; inputMode?: "numeric" | "decimal" | "tel" | "email" | "url";
};
export function Text({ label, value, onChange, hint, error, multiline, rows = 4, type = "text", placeholder, inputMode }: TextProps) {
  const id = useId();
  const common = {
    id, value, placeholder, inputMode, className: "field",
    "aria-invalid": error ? true : undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      {multiline ? <textarea {...common} rows={rows} className="field resize-y leading-relaxed" /> : <input {...common} type={type} />}
    </Field>
  );
}

// ---------- ছবি / PDF আপলোড ----------
// ছবি browser এই ছোট করে WebP বানানো হয় (বড় পাশ সর্বোচ্চ maxSide px): পাতা দ্রুত খোলে, Storage আর ব্যান্ডউইথ কম লাগে।
// সরাসরি Supabase Storage এর site-media তে যায়; সেখানে শুধু admin রাখতে পারেন (RLS)
const MAX_BYTES = 5 * 1024 * 1024;

async function shrinkImage(file: File, maxSide: number): Promise<{ blob: Blob; ext: string; type: string }> {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return { blob: file, ext: file.name.split(".").pop() || "bin", type: file.type };
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (!blob || (blob.size >= file.size && scale === 1)) return { blob: file, ext: file.name.split(".").pop() || "jpg", type: file.type };
  return { blob, ext: "webp", type: "image/webp" };
}

export function MediaInput({ label, value, onChange, folder, kind = "image", maxSide = 1600, hint, error, aspect = "aspect-[16/9]" }: {
  label: string; value: string; onChange: (url: string) => void; folder: string;
  kind?: "image" | "pdf" | "file"; maxSide?: number; hint?: string; error?: string; aspect?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = kind === "image" ? "image/jpeg,image/png,image/webp,image/avif" : kind === "pdf" ? "application/pdf" : "application/pdf,image/jpeg,image/png,image/webp";

  async function upload(file: File) {
    setMsg(null);
    setBusy(true);
    try {
      const { blob, ext, type } = file.type.startsWith("image/") ? await shrinkImage(file, maxSide) : { blob: file, ext: "pdf", type: file.type };
      if (blob.size > MAX_BYTES) throw new Error("ফাইল ৫MB এর বেশি। ছোট করে আবার দিন।");
      const path = `${folder}/${crypto.randomUUID()}.${ext.toLowerCase()}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("site-media").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
      if (upErr) throw new Error(/row-level|unauthori|403/i.test(upErr.message) ? "আপলোডের অনুমতি নেই (শুধু অ্যাডমিন)" : upErr.message);
      onChange(supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl);
      setMsg("আপলোড হয়েছে। সেভ চাপলে সাইটে যাবে।");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "আপলোড হয়নি");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const isPdf = /\.pdf($|\?)/i.test(value);
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="rounded-2xl border border-dashed border-outline-variant/60 p-3 dark:border-outline-variant/30">
        {value && kind === "image" && !isPdf ? (
          <div className={`relative ${aspect} overflow-hidden rounded-xl bg-surface-container dark:bg-white/5`}>
            <Image src={value} alt="" fill unoptimized sizes="400px" className="object-cover" />
          </div>
        ) : value ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-bold text-primary dark:text-primary-fixed">
            <span className="icon">description</span>ফাইলটা দেখুন
          </a>
        ) : null}
        <div className={`flex flex-wrap items-center gap-2 ${value ? "mt-3" : ""}`}>
          <button type="button" className="btn-ghost py-2!" disabled={busy} onClick={() => inputRef.current?.click()}>
            <span className="icon text-[18px]">{busy ? "progress_activity" : "upload"}</span>
            {busy ? "আপলোড হচ্ছে…" : value ? "বদলান" : kind === "pdf" ? "PDF দিন" : kind === "file" ? "PDF বা ছবি দিন" : "ছবি দিন"}
          </button>
          {value && (
            <button type="button" className="btn py-2! text-error hover:bg-error/10" onClick={() => onChange("")}>
              <span className="icon text-[18px]">delete</span>সরান
            </button>
          )}
          <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        {msg && <p className="mt-2 text-xs font-bold muted" role="status">{msg}</p>}
      </div>
    </Field>
  );
}

// ---------- তালিকা ----------
export type ItemField<T> = {
  key: keyof T & string; label: string; multiline?: boolean; placeholder?: string; icon?: boolean; wide?: boolean;
  options?: Record<string, string>;            // বাছাইয়ের তালিকা (select)
  image?: { folder: string; aspect?: string }; // ছবি আপলোড
  showIf?: (item: T) => boolean;               // অন্য ঘরের মান অনুযায়ী দেখানো (যেমন শুধু "ছবির উপর লেখা" কার্ডে ছবি)
};

export function ListEditor<T extends Record<string, string>>({ items, onChange, fields, blank, addLabel, max = 50, emptyText }: {
  items: T[]; onChange: (items: T[]) => void; fields: ItemField<T>[]; blank: T; addLabel: string; max?: number; emptyText?: string;
}) {
  const set = (i: number, patch: Partial<T>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.length === 0 && emptyText && <p className="text-sm muted">{emptyText}</p>}
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 rounded-2xl border border-outline-variant/40 p-3 dark:border-outline-variant/20">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            {fields.filter((f) => !f.showIf || f.showIf(it)).map((f) => (
              <div key={f.key} className={f.wide || f.multiline || f.image ? "sm:col-span-2" : ""}>
                {f.image ? (
                  <MediaInput label={f.label} value={it[f.key]} onChange={(v) => set(i, { [f.key]: v } as Partial<T>)} folder={f.image.folder} aspect={f.image.aspect} />
                ) : (
                <>
                <label className="sr-only">{f.label}</label>
                <div className="flex items-center gap-2">
                  {f.icon && <span className="icon text-primary dark:text-primary-fixed" aria-hidden="true">{it[f.key] || "help"}</span>}
                  {f.options ? (
                    <select value={it[f.key]} aria-label={f.label} className="field" onChange={(e) => set(i, { [f.key]: e.target.value } as Partial<T>)}>
                      {Object.entries(f.options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  ) : f.multiline ? (
                    <textarea value={it[f.key]} rows={2} placeholder={f.placeholder ?? f.label} aria-label={f.label} className="field resize-y" onChange={(e) => set(i, { [f.key]: e.target.value } as Partial<T>)} />
                  ) : (
                    <input value={it[f.key]} placeholder={f.placeholder ?? f.label} aria-label={f.label} className="field" onChange={(e) => set(i, { [f.key]: e.target.value } as Partial<T>)} />
                  )}
                </div>
                </>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <IconBtn icon="arrow_upward" label="উপরে" onClick={() => move(i, -1)} disabled={i === 0} />
            <IconBtn icon="arrow_downward" label="নিচে" onClick={() => move(i, 1)} disabled={i === items.length - 1} />
            <IconBtn icon="close" label="মুছুন" onClick={() => onChange(items.filter((_, j) => j !== i))} danger />
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="btn-ghost py-2!" onClick={() => onChange([...items, { ...blank }])}>
          <span className="icon text-[18px]">add</span>{addLabel}
        </button>
      )}
    </div>
  );
}

function IconBtn({ icon, label, onClick, disabled, danger }: { icon: string; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-lg disabled:opacity-30 ${danger ? "text-error hover:bg-error/10" : "muted hover:bg-surface-container dark:hover:bg-white/10"}`}>
      <span className="icon text-[18px]">{icon}</span>
    </button>
  );
}

// ---------- সেভ ----------
// সেভ না করা বদল আছে কিনা: জমা দেওয়ার সময়ের অবস্থা মনে রাখা, সফল সেভের খবর (savedAt) এলে সেটাই "সেভ করা"
export function useDirty(json: string, savedAt?: number) {
  const [snap, setSnap] = useState({ at: 0, saved: json, submitted: json });
  if (savedAt && savedAt !== snap.at) setSnap({ at: savedAt, saved: snap.submitted, submitted: snap.submitted });
  return { dirty: json !== snap.saved, markSubmitted: () => setSnap((s) => ({ ...s, submitted: json })) };
}

// সেভ না করা বদল থাকলে পাতা ছাড়ার আগে সতর্ক করে
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

export function SaveBar({ pending, dirty, savedAt, error, label = "সেভ করুন" }: { pending: boolean; dirty: boolean; savedAt?: number; error?: string; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary px-6!">
        <span className="icon text-[18px]">{pending ? "progress_activity" : "save"}</span>{pending ? "সেভ হচ্ছে…" : label}
      </button>
      {error ? (
        <span className="text-sm font-bold text-error dark:text-red-300" role="alert">{error}</span>
      ) : dirty ? (
        <span className="text-sm muted">সেভ না করা বদল আছে</span>
      ) : savedAt ? (
        <span className="flex items-center gap-1 text-sm font-bold text-primary dark:text-primary-fixed" role="status"><span className="icon text-[18px]">check_circle</span>সেভ হয়েছে, সাইটে দেখা যাচ্ছে</span>
      ) : null}
    </div>
  );
}
