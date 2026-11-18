// ব্রাউজারের পরিচয় থেকে ডিভাইসের নাম, যেমন "Android · Chrome" (শুধু দেখানোর জন্য: "অন্য ডিভাইসে লগইন হয়েছে")
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? "";
  const os = /android/i.test(s) ? "Android"
    : /iphone|ipad|ipod/i.test(s) ? "iPhone/iPad"
    : /windows/i.test(s) ? "Windows"
    : /mac os/i.test(s) ? "Mac"
    : /linux/i.test(s) ? "Linux"
    : "অজানা ডিভাইস";
  const browser = /edg\//i.test(s) ? "Edge"
    : /opr\/|opera/i.test(s) ? "Opera"
    : /samsungbrowser/i.test(s) ? "Samsung Internet"
    : /firefox|fxios/i.test(s) ? "Firefox"
    : /chrome|crios/i.test(s) ? "Chrome"
    : /safari/i.test(s) ? "Safari"
    : "ব্রাউজার";
  return `${os} · ${browser}`;
}
