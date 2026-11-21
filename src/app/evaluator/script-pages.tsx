"use client";

import { useEffect, useState } from "react";
import { signPages } from "./actions";
import { Pages, type AnnMap } from "./annotate";
import { MUTED } from "./ui";

// কাটা খাতার পাতা (দাগসহ), modal এ: ছবির signed URL খোলার সময় আনা হয় (সব খাতার ছবি আগে থেকে আনা হয় না)
export function ScriptPages({ paths, code, ann }: { paths: string[]; code: string; ann?: AnnMap | null }) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => {
    let live = true;
    void signPages(paths).then((r) => { if (!live) return; if (r.ok) setUrls(r.urls.filter(Boolean)); else setFail(true); });
    return () => { live = false; };
  }, [paths]);
  if (fail) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">খাতার ছবি আনা যায়নি</p>;
  if (!urls) return <div className="h-52 animate-pulse rounded-xl bg-surface-container dark:bg-white/5" aria-label="ছবি আসছে"><p className={`p-4 text-sm ${MUTED}`}>ছবি আসছে…</p></div>;
  return <div id="ev-view-page"><Pages urls={urls} code={code} ann={ann} /></div>;
}
