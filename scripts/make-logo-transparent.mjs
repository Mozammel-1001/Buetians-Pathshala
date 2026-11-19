// light থিমের লোগো (সাদা পটভূমির jpg) থেকে স্বচ্ছ-পটভূমির PNG: কালো লোগো, সাদা অংশ স্বচ্ছ। যেকোনো রঙের পটভূমিতে বসে।
// লোগো বদলালে আবার চালান: node scripts/make-logo-transparent.mjs
import sharp from "sharp";

const SRC = "public/images/logo-light.jpg";
const OUT = "public/images/logo-light-transparent.png";
const { data, info } = await sharp(SRC).resize({ height: 192 }).greyscale().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(info.width * info.height * 4);
for (let i = 0; i < data.length; i++) {
  // যত গাঢ়, তত অস্বচ্ছ; jpg এর হালকা ধূসর দাগ (২৪৫ এর উপরে) বাদ
  const a = data[i] >= 245 ? 0 : Math.min(255, Math.round((255 - data[i]) * 1.05));
  rgba[i * 4 + 3] = a; // R, G, B শূন্য = কালো
}
await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(OUT);
console.log(`${OUT}: ${info.width}x${info.height}`);
