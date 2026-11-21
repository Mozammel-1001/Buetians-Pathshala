"use client";

import { useActionState, useState } from "react";
import { ROLE } from "../_components/ui";
import { useConfirmSubmit } from "../_components/kit";
import { changeRole } from "./actions";

// "রোল বদলান" আইকনে চাপলে বাছাইয়ের ঘর খোলে; নিশ্চিত করলে বদলায়
export function RoleChanger({ id, name, role }: { id: string; name: string; role: string }) {
  const [state, action, pending] = useActionState(changeRole, undefined);
  const [open, setOpen] = useState(false);
  const [onSubmit, node] = useConfirmSubmit(() => ({ title: "রোল বদলাবেন?", sub: name, icon: "manage_accounts", ok: "হ্যাঁ, বদলান", body: "শিক্ষক থেকে অন্য রোলে নিলে তাঁর কোর্স আর সামনের ক্লাস থেকে সরানো হবে। অ্যাডমিন রোল ড্যাশবোর্ড থেকে দেওয়া যায় না।" }));
  return (
    <div className="relative">
      {node}
      <button type="button" className="icon-btn" title="রোল বদলান" aria-label="রোল বদলান" onClick={() => setOpen((o) => !o)}><span className="icon text-[20px]">manage_accounts</span></button>
      {open && (
        <form action={action} onSubmit={onSubmit}
          className="absolute right-0 z-30 mt-1 w-56 space-y-2 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-left shadow-lg dark:bg-inverse-surface">
          <input type="hidden" name="id" value={id} />
          <label className="label" htmlFor={`role-${id}`}>নতুন রোল</label>
          <select id={`role-${id}`} name="role" defaultValue={role === "admin" ? "student" : role} className="field">
            {Object.entries(ROLE).filter(([k]) => k !== "admin").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button disabled={pending} className="btn-primary w-full py-2!">{pending ? "হচ্ছে…" : "বদলান"}</button>
          {state?.error && <p className="text-xs font-bold text-error" role="alert">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
