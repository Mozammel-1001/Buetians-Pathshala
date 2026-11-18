"use client";

// dark/light: <html> এর class বদল, পছন্দ এই ব্রাউজারে মনে রাখা
export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // ব্রাউজারে storage বন্ধ থাকলে শুধু এবারের জন্য
    }
  };
  return (
    <button type="button" onClick={toggle} aria-label="থিম বদলান" className="grid h-10 w-10 place-items-center rounded-full muted hover:bg-surface-container-low dark:hover:bg-white/10">
      <span className="icon dark:hidden">light_mode</span>
      <span className="icon hidden dark:inline-block">dark_mode</span>
    </button>
  );
}
