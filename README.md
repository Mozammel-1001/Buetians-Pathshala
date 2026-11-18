# বুয়েটিয়ান'স পাঠশালা: production app

Next.js 16 (App Router, TypeScript, Tailwind 4) + Supabase। Vercel এ deploy হয়। ভিডিও পরে Bunny Stream এ।

ডেমো সাইট (রিপোর এর মূল ফোল্ডারের HTML পাতাগুলো) শুধু নকশা আর আচরণ ঠিক করার জন্য। আসল সাইট এই ফোল্ডারে ধাপে ধাপে বানানো হচ্ছে।

## এখন যা আছে (ধাপ ১: ভিত্তি)

- **ডিজাইন:** ডেমো সাইটের রং, বাংলা ফন্ট (Hind Siliguri)। ডিফল্ট light থিম, পটভূমি off-white (`#faf9f6`); থিম বোতামে dark, পছন্দ মনে থাকে।
- **Supabase:** browser, server আর প্রতি request এ session নবায়নের client (`src/lib/supabase/`)।
- **সাইন আপ (`/sign-up`):** নাম, মোবাইল, ইমেইল, অভিভাবকের মোবাইল, শিক্ষাপ্রতিষ্ঠান, শ্রেণি। মোবাইলে SMS এর কোড মিললে অ্যাকাউন্ট চালু হয়, তখনই আইডি তৈরি হয়, আর স্বাগত বার্তায় আইডি দেখায় (কপির বোতামসহ)। কোড না দিলে অ্যাকাউন্টও নেই, আইডিও খরচ হয় না।
- **লগইন (`/sign-in`):** আইডি (BP-1001) বা মোবাইল নম্বর, যেকোনোটা; অ্যাকাউন্টের নম্বরে SMS এ কোড। আইডি দিলে নম্বরটা browser এ আসে না, লুকানো দেখায় (017•••••678)।
  - **Google:** লগইন বা সাইন আপ। প্রথমবার `/onboarding` এ বাকি তথ্য আর মোবাইল নম্বর (কোড দিয়ে যাচাই), তারপর অ্যাকাউন্ট চালু।
  - Android এর Chrome এ SMS এলে কোড নিজে বসে যায় (WebOTP), iPhone এ কিবোর্ডের উপরে আসে।
- **ভর্তি:** কোর্সের পাতায় "ভর্তি হোন" → modal: bKash নম্বর, টাকা আর আইডি (তিনটাতেই কপির বোতাম), তারপর পাঠানোর নম্বর আর TrxID।
  - জমা দিলেই database TrxID মিলিয়ে দেখে। আগে ব্যবহার হয়ে থাকলে সাথে সাথে কারণসহ বাতিল; নইলে "আবেদন জমা হয়েছে, যাচাই বাকি"।
  - admin বা manager `/admin/payments` এ bKash এর সাথে মিলিয়ে অনুমোদন দেন (সাথে সাথে ভর্তি চালু) বা কারণসহ বাতিল করেন। শিক্ষার্থী কোর্সের পাতা আর ড্যাশবোর্ডে অবস্থা দেখে।
  - bKash নম্বর, অ্যাকাউন্টের ধরন আর নির্দেশনা: অ্যাডমিন প্যানেল → সাইটের লেখা → ভর্তির পেমেন্ট।
  - ফ্রি কোর্সে (দাম ০) সরাসরি ভর্তি।
- **আইডি:** সবার (শিক্ষার্থী, শিক্ষক, স্টাফ) পড়ার মতো আইডি **BP-1001** থেকে ক্রমিক: BP-1001, BP-1002, ... ব্যর্থ signup এ নম্বর নষ্ট হয় না, ফাঁক পড়ে না।
- **SMS:** Supabase এর Send SMS hook → `src/app/api/hooks/send-sms` → বাংলাদেশের gateway (`src/lib/sms.ts`: sms.net.bd, BulkSMSBD; নতুনটা সহজে যোগ হয়)।
- **একসাথে একটাই ডিভাইস:**
  - লগইনের সাথে সাথে `claim_session` ডাকা হয়, আগের ডিভাইস লগআউট হয়।
  - লগইন করা পাতায় মিনিটে মিনিটে যাচাই হয়, অন্য ডিভাইসে লগইন হলে পুরো পাতা ঢেকে লগআউট দেখায়।
- **অ্যাডমিন প্যানেল (`/admin`, শুধু admin):** সাইটের সব লেখা আর ছবি এখান থেকে, কোডে হাত না দিয়ে।
  - **কোর্স:** নাম, ঠিকানা, ছবি, বিবরণ, কোর্সে যা থাকছে, দাম আর ছাড়ের আগের দাম, ব্যাচ, ক্লাস শুরু, ক্লাসের সময়, মেয়াদ, ভর্তির শেষ দিন, রুটিন (সারি আর/বা PDF), সিলেবাস PDF, সাধারণ প্রশ্ন, প্রকাশ বা খসড়া, ক্রম।
  - **সাইটের লেখা:** হোমপেজের hero (ছবিসহ), "কেন আমরা", ব্রাঞ্চ, শেষের আহ্বান, যোগাযোগ ও ফুটার, আমাদের সম্পর্কে।
  - ছবি আপলোডের সময় browser এই ছোট করে WebP হয়, Supabase Storage এর `site-media` এ যায়। ছবি বদলালে পুরনোটা মুছে যায়।
  - সেভের সাথে সাথে সাইটে দেখা যায়। কে কখন কী বদলালেন (দাম বদলালে আগের আর নতুন দাম) সারসংক্ষেপ পাতায়।
- **পাবলিক পাতা:** হোম (hero, কোর্স, কেন আমরা, ব্রাঞ্চ, শেষের আহ্বান), কোর্সের বিস্তারিত (`/courses/<ঠিকানা>`), আমাদের সম্পর্কে (`/about`), ফুটারে যোগাযোগ। সব লেখা database থেকে, cache এ থাকে।
- **ড্যাশবোর্ড:** নাম, আইডি, ভর্তি হওয়া কোর্স, কোন ডিভাইসে লগইন।
- **ডেটাবেস:** `supabase/migrations/`
  - পুরো schema: পরীক্ষা, খাতা কাটা, এক ডিভাইস, AI খসড়া, প্রশ্নপত্র ইত্যাদি।
  - মোবাইল আর Google লগইন, BP-1001 আইডি।
  - সাইটের লেখা (`site_content`), কোর্সের বাড়তি ঘর, ছবির bucket, বদলের audit log।
  - প্রতি মিনিটের cron: সময় পেরোনো পরীক্ষা জমা, মেধাক্রম।
  - schema এর আসল কপি এখন এখানে। `docs/0001_init.sql` ডেমো পর্বের নকশা, আর হালনাগাদ হয় না।

## প্রথমবার চালানো

### ১. Supabase প্রজেক্ট (free plan)

1. [supabase.com](https://supabase.com) এ নতুন প্রজেক্ট খুলুন।
   - Region: **Southeast Asia (Singapore)**, বাংলাদেশ থেকে সবচেয়ে কাছে।
   - Database password কোথাও নিরাপদে রাখুন।
2. **Project Settings → API Keys** থেকে তিনটা জিনিস নিন: Project URL, **publishable key** আর **secret key**। secret key শুধু `.env.local` আর Vercel এ, কাউকে দেবেন না।
3. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:3000`, পরে Vercel এর ঠিকানা।
   - Redirect URLs: `http://localhost:3000/auth/callback` আর পরে `https://<vercel-ঠিকানা>/auth/callback`।
4. **Authentication → Sign In / Providers:**
   - **Email: বন্ধ করুন।** সাইটে ইমেইল-পাসওয়ার্ড নেই; খোলা থাকলে কেউ সরাসরি API দিয়ে অ্যাকাউন্ট খুলতে পারত। (Google এর অ্যাকাউন্টে ইমেইল থাকে, তাতে সমস্যা নেই।)
   - **Phone: চালু করুন।** SMS provider হিসেবে Twilio ইত্যাদির ঘর চাইলে যেকোনো লেখা দিন: নিচের hook চালু থাকলে Supabase সেগুলো ব্যবহার করে না।
   - **Google: চালু করুন** (নিচে ধাপ ২)।

### ২. Google লগইন

1. [Google Cloud Console](https://console.cloud.google.com) এ একটা প্রজেক্ট খুলুন।
2. **APIs & Services → OAuth consent screen:** অ্যাপের নাম, লোগো, সাপোর্ট ইমেইল। User type: External।
3. **Credentials → Create Credentials → OAuth client ID → Web application:**
   - Authorized JavaScript origins: `http://localhost:3000` আর Vercel এর ঠিকানা।
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase এর Google provider পাতায় এই ঠিকানাটা লেখা থাকে, সেখান থেকে কপি করুন)।
4. পাওয়া Client ID আর Client Secret Supabase এর **Sign In / Providers → Google** এ বসান।

### ৩. মোবাইল OTP এর SMS

Supabase নিজে কোড বানায়, পাঠায় আমাদের সাইট, বাংলাদেশের SMS gateway দিয়ে।

**development এ, SMS ছাড়া:** **Authentication → Sign In / Providers → Phone → Test Phone Numbers and OTPs** এ কয়েকটা নম্বর আর নির্দিষ্ট কোড দিন, যেমন `8801700000001=123456`। এসব নম্বরে কোনো SMS যায় না, ওই কোড দিলেই লগইন হয়। localhost এ এভাবেই চালান: Supabase এর hook আপনার কম্পিউটারে পৌঁছাতে পারে না।

**সত্যিকারের SMS:**
1. SMS gateway এ অ্যাকাউন্ট খুলুন, যেমন [sms.net.bd](https://sms.net.bd) বা [BulkSMSBD](https://bulksmsbd.net)। API key আর অনুমোদিত Sender ID নিন। BulkSMSBD তে IP whitelist বন্ধ রাখুন (Vercel এর IP বদলায়)।
2. সাইটটা Vercel এ deploy করুন (নিচে ধাপ ৬), কারণ hook এর জন্য https ঠিকানা লাগে।
3. Supabase → **Authentication → Hooks → Add hook → Send SMS hook → HTTPS:**
   - URL: `https://<vercel-ঠিকানা>/api/hooks/send-sms`
   - **Generate secret** চাপুন। `v1,whsec_...` পুরোটা Vercel এ `SEND_SMS_HOOK_SECRET` নামে দিন।
4. Vercel এ `SMS_PROVIDER` (`smsnetbd` বা `bulksmsbd`), `SMS_API_KEY`, `SMS_SENDER_ID` দিন, তারপর আবার deploy করুন।
   - `SMS_PROVIDER=log` রাখলে SMS যায় না, কোড Vercel এর **Logs** এ দেখা যায়। gateway কেনার আগে পরীক্ষার জন্য।
5. **Authentication → Rate Limits:** ঘণ্টায় কতগুলো SMS যাবে। launch এর আগে বাড়ান, আর gateway এ ব্যালান্স রাখুন।

SMS ইংরেজিতে যায় (`Buetian's Pathshala code: 123456`)। বাংলা SMS Unicode, এক ভাগে মাত্র ৭০ অক্ষর ধরে, তাই খরচ বেশি পড়ে।

### ৪. ডেটাবেসে schema বসানো

Supabase CLI দিয়ে (Node থাকলেই হয়, আলাদা install লাগে না):

```bash
cd production
npx supabase login
npx supabase link --project-ref <আপনার-project-ref>   # URL এর https://<এটা>.supabase.co
npx supabase db push                                  # supabase/migrations এর সব ফাইল
```

CLI না চাইলে: Supabase এর **SQL Editor** এ `supabase/migrations/` এর ফাইলগুলো নাম অনুযায়ী ক্রমে বসিয়ে Run করুন।

development এর নমুনা কোর্স চাইলে `supabase/seed.sql` SQL Editor এ চালান। production এ চালাবেন না।

নিজেকে অ্যাডমিন বানাতে আগে সাইটে লগইন করুন, তারপর SQL Editor এ:
```sql
update public.profiles set role = 'admin' where user_code = 'BP-1001';   -- আপনার আইডি
```

### ৫. নিজের কম্পিউটারে চালানো

```bash
cd production
cp .env.example .env.local     # তারপর .env.local এ URL আর publishable key বসান
npm install
npm run dev                     # http://localhost:3000
```

যাচাই: `npm run lint`, `npm run build`। ডেটাবেসের test রিপোর `tests/` ফোল্ডারে (`npm run test:sql`), সেগুলো এই migration গুলো চালিয়েই দেখে।

### ৬. Vercel এ deploy

1. GitHub এ রিপো push করুন। Vercel এ **Add New → Project** দিয়ে রিপো বেছে নিন।
2. **Root Directory: `production`**।
3. Environment Variables এ `.env.example` এর সবগুলো দিন। `NEXT_PUBLIC_SITE_URL` হবে Vercel এর ঠিকানা।
4. Supabase এর Site URL আর Redirect URLs এ, আর Google এর JavaScript origins এ Vercel এর ঠিকানা যোগ করুন।

## free plan এর সীমা, আর launch এর আগে যা কিনতে হবে

| সেবা | development এ (free) | launch এ |
|---|---|---|
| **Vercel** | Hobby plan শুধু ব্যক্তিগত ও অ-বাণিজ্যিক কাজের জন্য | টাকা নেওয়া সাইটের জন্য **Pro** লাগবে |
| **Supabase** | ৫০০MB ডেটাবেস, ১GB ফাইল; এক সপ্তাহ কেউ ব্যবহার না করলে প্রজেক্ট ঘুমিয়ে পড়ে; backup নেই | **Pro**, সাথে PITR backup; পরীক্ষার দিনে বড় compute |
| **Bunny Stream** | free plan নেই, শুধু শুরুর দিকে trial; তারপর ব্যবহার অনুযায়ী বিল | ভিডিওর ধাপে চালু করব |
| **SMS** | Test Phone Numbers (SMS যায় না), নয়তো `SMS_PROVIDER=log` | বাংলাদেশের gateway এ ব্যালান্স কেনা; প্রতি OTP একটা SMS |
| **Google লগইন** | free | free; অ্যাপের নাম আর লোগো দেখাতে Google এর যাচাই (verification) লাগতে পারে |

Bunny আর SMS gateway এর তথ্য launch এর আগে তাদের সাইটে আবার মিলিয়ে নেবেন, plan আর দাম বদলায়।

## গঠন

```
src/
  proxy.ts                  প্রতি request এ session নবায়ন, লগইন ছাড়া /dashboard, /onboarding এ গেলে সাইন ইনে
  lib/supabase/             client.ts (browser), server.ts (cookie সহ), public.ts (লগইন ছাড়া, cache যোগ্য), proxy.ts
  lib/auth.ts               লগইন করা ব্যবহারকারী আর profile (Data Access Layer), প্রোফাইল সম্পূর্ণ কিনা, ডিভাইস দাবি
  lib/sms.ts                SMS gateway (log, smsnetbd, bulksmsbd) আর OTP এর লেখা
  lib/webhook.ts            Supabase এর hook সত্যিই Supabase পাঠিয়েছে কিনা যাচাই (Standard Webhooks)
  lib/validation.ts         মোবাইল নম্বর, OTP
  components/               header, থিম বোতাম, এক-ডিভাইস পাহারা
  app/(auth)/               সাইন ইন, সাইন আপ, OTP এর ধাপ, server action
  app/courses/[slug]/       কোর্সের বিস্তারিত, ভর্তির modal (enroll-modal.tsx)
  app/admin/payments        পেমেন্ট যাচাই (admin আর manager)
  components/welcome-modal  সাইন আপের পর আইডিসহ স্বাগত বার্তা
  app/onboarding/           Google এর পর সাইন আপ শেষ করা
  app/auth/callback         Google থেকে ফেরা
  app/auth/replaced         অন্য ডিভাইসে লগইন হলে এখানে লগআউট
  app/api/hooks/send-sms    Supabase এর Send SMS hook
  app/dashboard/            শিক্ষার্থীর ড্যাশবোর্ড
  app/admin/                অ্যাডমিন প্যানেল: সারসংক্ষেপ, কোর্স, সাইটের লেখা (actions.ts এ সেভ)
  app/courses/[slug]        কোর্সের বিস্তারিত
  app/about                 আমাদের সম্পর্কে
  lib/content-schema.ts     সাইটের লেখার ধরন, শুরুর মান, যাচাই (browser আর server দুই জায়গায়)
  lib/content.ts            সাইটের লেখা আর প্রকাশিত কোর্স database থেকে (cache সহ)
supabase/migrations/        ডেটাবেস (ক্রম অনুযায়ী)
supabase/seed.sql           শুধু development এর নমুনা
```

Next.js 16 এ **Cache Components** চালু। cookie বা লগইন পড়া সব অংশ `<Suspense>` এর ভেতরে থাকে, নইলে build error। বাকিটা আগেই তৈরি হয়ে থাকে, তাই পাতা দ্রুত খোলে।

## পরের ধাপগুলো

1. কোর্সের ভেতরের অংশ: বিষয় → অধ্যায় → লেকচার (অ্যাডমিন প্যানেল থেকে)
2. ভিডিও লেকচার: Bunny Stream, token দেওয়া লিংক
3. পরীক্ষা: শিক্ষার্থীর পাতা, প্রশ্নপত্র, খাতা কাটা, ফল (ডেমো থেকে)
4. প্রশ্নোত্তর, লাইভ ক্লাস, নোটিশ (নোটিশের SMS একই `lib/sms.ts` দিয়ে); ভর্তি অনুমোদনের SMS
5. অ্যাডমিন প্যানেলের বাকি অংশ (শিক্ষার্থী, শিক্ষক, হিসাব), শিক্ষকের প্যানেল
