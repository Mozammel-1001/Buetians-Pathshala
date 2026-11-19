"use client";

// dark/light: <html> এর class বদল, পছন্দ এই ব্রাউজারে মনে রাখা (ডেমোর বোতামের মতো দেখতে)
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
    <button type="button" onClick={toggle} aria-label="থিম বদলান"
      className="flex items-center justify-center rounded-full p-2 text-on-surface-variant transition-all duration-300 hover:bg-surface-container-low md:hover:scale-110 dark:text-surface-variant dark:hover:bg-inverse-surface">
      <span className="icon dark:hidden">light_mode</span>
      <span className="icon hidden dark:block">dark_mode</span>
    </button>
  );
}
