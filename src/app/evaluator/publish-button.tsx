"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ExModal, useExToast, type ModalSpec } from "@/app/practice/ui";
import { publishResults } from "./actions";
import { BTN_PRI, MUTED } from "./ui";

// "ফল প্রকাশ": সব খাতা কাটা আর দ্বিতীয় যাচাই শেষ হলে (database ও আবার দেখে)। শিক্ষক বা অ্যাডমিন
export function PublishButton({ examId, title, blocked }: { examId: number; title: string; blocked: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const [toast, toastNode] = useExToast();
  const close = useCallback(() => setModal(null), []);
  const ask = () => setModal({
    icon: "publish", title: "ফল প্রকাশ করবেন?",
    body: <p className={`text-sm ${MUTED}`}>{title} এর সব খাতা কাটা আর দ্বিতীয় যাচাই শেষ। প্রকাশ করলে শিক্ষার্থীরা নোটিফিকেশন পাবে, মোট নম্বর আর মেধাতালিকা দেখবে, আর লাল দাগসহ নিজের কাটা খাতা দেখতে পারবে। এরপর খাতা আর ফেরত দেওয়া যাবে না।</p>,
    actions: [{ label: "বাতিল", kind: "ghost" }, {
      label: "প্রকাশ করুন", id: "ev-publish-go", onClick: () => {
        void (async () => {
          const r = await publishResults(examId);
          if (r.ok) { toast("ফল প্রকাশ হয়েছে, শিক্ষার্থীরা নোটিফিকেশন পাবে"); router.refresh(); } else toast(r.error, "error");
        })();
      },
    }],
  });
  return (
    <>
      <button type="button" id="ev-publish" className={BTN_PRI} disabled={!!blocked} title={blocked || undefined} onClick={ask}><span className="icon text-[18px]">publish</span>ফল প্রকাশ</button>
      <ExModal spec={modal} close={close} />
      {toastNode}
    </>
  );
}
