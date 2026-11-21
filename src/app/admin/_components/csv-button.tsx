"use client";

// তালিকা CSV করে নামানো (Excel এ বাংলা ঠিক দেখাতে শুরুতে BOM)
export function CsvButton({ name, rows }: { name: string; rows: (string | number)[][] }) {
  const download = () => {
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };
  return <button type="button" onClick={download} className="btn-outline"><span className="icon text-[18px]">download</span> CSV</button>;
}
