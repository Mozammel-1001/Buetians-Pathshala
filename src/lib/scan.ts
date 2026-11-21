// খাতার ছবি: চার কোণা নিজে খুঁজে সোজা করা আর স্ক্যানের মতো পরিষ্কার করা (practice.html এর Scan, বাইরের লাইব্রেরি ছাড়া)
export type Pt = [number, number];
// খাতার ছবি থেকে চার কোণা অটো-ডিটেক্ট, পারস্পেক্টিভ সোজা করা ও স্ক্যান-ফিল্টার (বাইরের লাইব্রেরি ছাড়া)
export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return await createImageBitmap(file); }
}

function otsu(hist: number[], total: number) {
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sb = 0, wb = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wb += hist[t]; if (!wb) continue;
    const wf = total - wb; if (!wf) break;
    sb += t * hist[t];
    const mb = sb / wb, mf = (sum - sb) / wf;
    const v = wb * wf * (mb - mf) * (mb - mf);
    if (v > best) { best = v; thr = t; }
  }
  return thr;
}

function validQuad(poly: Pt[], area: number, w: number, h: number) {
  const [tl, tr, br, bl] = poly;
  const pa = (P: Pt[]) => Math.abs(P.reduce((t, a, i) => { const b = P[(i + 1) % 4]; return t + (a[0] * b[1] - b[0] * a[1]); }, 0)) / 2;
  const qa = pa(poly);
  let okq = qa > 0 && area / qa >= 0.86 && qa >= w * h * 0.25;
  if (okq) {
    let sign = 0;
    for (let i = 0; i < 4 && okq; i++) {
      const a = poly[i], b = poly[(i + 1) % 4], c = poly[(i + 2) % 4];
      const v1: Pt = [a[0] - b[0], a[1] - b[1]], v2: Pt = [c[0] - b[0], c[1] - b[1]];
      const cr = v1[0] * v2[1] - v1[1] * v2[0];
      const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) * Math.hypot(...v2)) || 1)))) * 180 / Math.PI;
      if (ang < 65 || ang > 115) okq = false;
      const sg = cr > 0 ? 1 : -1; if (sign && sg !== sign) okq = false; sign = sg;
    }
    const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const r1 = d(tl, tr) / (d(bl, br) || 1), r2 = d(tl, bl) / (d(tr, br) || 1);
    if (r1 < 0.65 || r1 > 1.55 || r2 < 0.65 || r2 > 1.55) okq = false;
  }
  if (okq && qa > w * h * 0.94) okq = false;
  return okq;
}
function extremeQuad(inComp: (p: number) => boolean, w: number, h: number) {
  let tl: Pt = [0, 0], tr: Pt = [0, 0], br: Pt = [0, 0], bl: Pt = [0, 0], a = 1e9, b = -1e9, cc = -1e9, dd = 1e9, area = 0;
  for (let p = 0; p < w * h; p++) {
    if (!inComp(p)) continue; area++;
    const x = p % w, y = (p / w) | 0;
    if (x + y < a) { a = x + y; tl = [x, y]; }
    if (x - y > cc) { cc = x - y; tr = [x, y]; }
    if (x + y > b) { b = x + y; br = [x, y]; }
    if (x - y < dd) { dd = x - y; bl = [x, y]; }
  }
  return { poly: [tl, tr, br, bl] as Pt[], area };
}
// মাঝখানের রঙ ধরে বেড়ে ওঠা অংশ (সাদা নয় এমন বোর্ড/কাগজের জন্য)
function centerRegion(d: Uint8ClampedArray, w: number, h: number, T: number) {
  const cx = (w / 2) | 0, cy = (h / 2) | 0, rr = Math.max(2, Math.round(Math.min(w, h) * 0.07));
  const med: number[][] = [[], [], []];
  for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) med[c].push(d[i + c]); }
  const m = med.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const dr = d[i * 4] - m[0], dg = d[i * 4 + 1] - m[1], db = d[i * 4 + 2] - m[2]; mask[i] = (dr * dr + dg * dg + db * db) < T * T ? 1 : 0; }
  const reg = new Uint8Array(w * h); const st = new Int32Array(w * h); let sp = 0;
  const s0 = cy * w + cx; if (!mask[s0]) return null;
  st[sp++] = s0; reg[s0] = 1;
  while (sp) { const p = st[--sp]; const x = p % w, y = (p / w) | 0;
    if (x > 0 && mask[p - 1] && !reg[p - 1]) { reg[p - 1] = 1; st[sp++] = p - 1; }
    if (x < w - 1 && mask[p + 1] && !reg[p + 1]) { reg[p + 1] = 1; st[sp++] = p + 1; }
    if (y > 0 && mask[p - w] && !reg[p - w]) { reg[p - w] = 1; st[sp++] = p - w; }
    if (y < h - 1 && mask[p + w] && !reg[p + w]) { reg[p + w] = 1; st[sp++] = p + w; } }
  // ভেতরের ফাঁক ভরাট: সীমানা থেকে ছোঁয়া যায় না এমন সব
  const out = new Uint8Array(w * h); sp = 0;
  const push = (p: number) => { if (!reg[p] && !out[p]) { out[p] = 2; st[sp++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) { const p = st[--sp]; const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w); }
  const filled = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) filled[i] = out[i] === 2 ? 0 : 1;
  return filled;
}

// ফেরত: [[x,y]×4] TL, TR, BR, BL (মূল ছবির পিক্সেলে); না পেলে ভেতরে ঢোকানো আয়তক্ষেত্র
export function detectCorners(bmp: ImageBitmap): { pts: Pt[]; auto: boolean } {
  const W0 = bmp.width, H0 = bmp.height;
  const sc = Math.min(1, 360 / Math.max(W0, H0));
  const w = Math.max(8, Math.round(W0 * sc)), h = Math.max(8, Math.round(H0 * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.filter = 'blur(2px)';
  g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h); const hist: number[] = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) { const v = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0; gray[i] = v; hist[v]++; }
  const thr = otsu(hist, w * h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = gray[i] > thr ? 1 : 0;
  // সবচেয়ে বড় উজ্জ্বল অংশ (কাগজ)
  const lab = new Int32Array(w * h); let best = 0, bestId = 0, id = 0;
  const stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || lab[s]) continue;
    id++; let sp = 0, cnt = 0; stack[sp++] = s; lab[s] = id;
    while (sp) {
      const p = stack[--sp]; cnt++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !lab[p - w]) { lab[p - w] = id; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !lab[p + w]) { lab[p + w] = id; stack[sp++] = p + w; }
    }
    if (cnt > best) { best = cnt; bestId = id; }
  }
  const fallback = (): Pt[] => [[0, 0], [W0, 0], [W0, H0], [0, H0]];
  const done = (poly: Pt[]) => ({ pts: poly.map(([x, y]) => [x / sc, y / sc] as Pt), auto: true });
  if (bestId && best >= w * h * 0.18) {
    const { poly, area } = extremeQuad((p) => lab[p] === bestId, w, h);
    if (validQuad(poly, area, w, h)) return done(poly);
  }
  // দ্বিতীয় চেষ্টা: মাঝের রঙের সঙ্গে মেলে এমন অংশ
  for (const T of [40, 60, 85]) {
    const f = centerRegion(d, w, h, T);
    if (!f) continue;
    const { poly, area } = extremeQuad((p) => f[p] === 1, w, h);
    if (area > w * h * 0.12 && poly.every(Boolean) && validQuad(poly, area, w, h)) return done(poly);
  }
  return { pts: fallback(), auto: false };
}

function solve8(A: number[][], bv: number[]) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [bv[i], bv[m]] = [bv[m], bv[i]];
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; bv[r] -= f * bv[i]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = bv[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
}

// আউটপুট আয়তক্ষেত্র (0..W,0..H) → উৎস চতুর্ভুজ
function homography(W: number, H: number, q: Pt[]) {
  const dst: Pt[] = [[0, 0], [W, 0], [W, H], [0, H]];
  const A: number[][] = [], bv: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i], [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); bv.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); bv.push(v);
  }
  const h = solve8(A, bv);
  return h;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// চতুর্ভুজ সোজা করে JPEG blob; scan=true হলে ছায়া সমান করে লেখা স্পষ্ট করে
export async function warpToBlob(bmp: ImageBitmap, q: Pt[], scan: boolean, maxSide = 1600): Promise<Blob> {
  let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const k = Math.min(1, maxSide / Math.max(W, H)); W = Math.max(16, Math.round(W * k)); H = Math.max(16, Math.round(H * k));
  const sc = document.createElement('canvas'); sc.width = bmp.width; sc.height = bmp.height;
  const sg = sc.getContext('2d', { willReadFrequently: true })!; sg.drawImage(bmp, 0, 0);
  const src = sg.getImageData(0, 0, bmp.width, bmp.height).data; const SW = bmp.width, SH = bmp.height;
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
  const og = oc.getContext('2d')!; const out = og.createImageData(W, H); const o = out.data;
  const h = homography(W, H, q);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const den = h[6] * x + h[7] * y + 1;
      let u = (h[0] * x + h[1] * y + h[2]) / den, v = (h[3] * x + h[4] * y + h[5]) / den;
      u = Math.min(SW - 1.001, Math.max(0, u)); v = Math.min(SH - 1.001, Math.max(0, v));
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
      const i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4;
      const oi = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) o[oi + ch] = src[i00 + ch] * (1 - fx) * (1 - fy) + src[i10 + ch] * fx * (1 - fy) + src[i01 + ch] * (1 - fx) * fy + src[i11 + ch] * fx * fy;
      o[oi + 3] = 255;
    }
  }
  if (scan) {
    // রঙিন ছবি (খাতা নয়) হলে ফিল্টার লাগানো হবে না, নইলে রং নষ্ট হয়
    let colorful = 0, tot = 0;
    for (let i = 0; i < W * H; i += 7) { const r = o[i * 4], g = o[i * 4 + 1], b2 = o[i * 4 + 2]; const mx = Math.max(r, g, b2), mn = Math.min(r, g, b2); tot++; if (mx > 40 && (mx - mn) / mx > 0.22) colorful++; }
    if (colorful / tot > 0.1) scan = false;
  }
  if (scan) {
    // পটভূমি আলো আন্দাজ (ছোট করে ঝাপসা করে বড় করা), ভাগ করে ছায়া মুছে ফেলা
    const sw = Math.max(8, Math.round(W / 24)), sh = Math.max(8, Math.round(H / 24));
    // বড় অক্ষর/কালি যেন পটভূমি না ধরে, তাই সর্বোচ্চ উজ্জ্বলতা নেওয়া হয়
    const gray = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = (o[i * 4] * 0.3 + o[i * 4 + 1] * 0.59 + o[i * 4 + 2] * 0.11) | 0;
    const bgS = new Float32Array(sw * sh); const bx = W / sw, by = H / sh;
    for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) {
      let mx = 0; const x1 = Math.min(W, Math.round((xx + 1) * bx)), y1 = Math.min(H, Math.round((yy + 1) * by));
      for (let y = Math.round(yy * by); y < y1; y += 2) for (let x = Math.round(xx * bx); x < x1; x += 2) { const v = gray[y * W + x]; if (v > mx) mx = v; }
      bgS[yy * sw + xx] = Math.max(60, mx);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = Math.min(sw - 1.001, Math.max(0, x / bx - 0.5)), fy = Math.min(sh - 1.001, Math.max(0, y / by - 0.5));
      const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
      const bg = bgS[y0 * sw + x0] * (1 - ax) * (1 - ay) + bgS[y0 * sw + x0 + 1] * ax * (1 - ay) + bgS[(y0 + 1) * sw + x0] * (1 - ax) * ay + bgS[(y0 + 1) * sw + x0 + 1] * ax * ay;
      const oi = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let v = (o[oi + ch] / bg) * 255;
        v = (v - 30) * 1.18; // হালকা কনট্রাস্ট
        o[oi + ch] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }
  og.putImageData(out, 0, 0);
  return new Promise<Blob>((res, rej) => oc.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.85));
}


export const Scan = { loadBitmap, detectCorners, warpToBlob };
