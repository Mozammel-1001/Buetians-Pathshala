import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuth, isProfileComplete, safeNext } from "@/lib/auth";
import { SignupFlow } from "../(auth)/signup-flow";
import { sendLinkOtp, verifyLinkOtp } from "../(auth)/actions";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "সাইন আপ শেষ করুন" };

// সাইন আপ শেষ করা:
//   Google এ প্রথমবার: অ্যাকাউন্ট তখনো চালু হয়নি (profile নেই)। সাইন আপের বাকি তথ্য আর মোবাইল নম্বর, কোড মিললে চালু
//   পুরনো বা হাতে বানানো অ্যাকাউন্টে নাম বাকি: শুধু নাম ইত্যাদি
// সব ঠিক থাকলে next এ। এর আগে লগইন লাগে এমন কোনো পাতা খোলে না (requireProfile)
export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <Onboarding searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Onboarding({ searchParams }: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const { uid, email, meta, profile } = await getAuth();
  if (!uid) redirect(`/sign-in?next=${encodeURIComponent("/onboarding")}`);
  if (profile && isProfileComplete(profile)) redirect(next);

  if (!profile) {
    const name = String(meta.full_name ?? meta.name ?? "");
    return (
      <div className="card p-7 md:p-9">
        <p className="flex items-center gap-2 text-sm font-bold text-primary dark:text-primary-fixed"><span className="icon text-[18px]">verified</span>Google এ লগইন হয়েছে{email ? `: ${email}` : ""}</p>
        <h1 className="mt-2 text-2xl font-bold">সাইন আপ শেষ করুন</h1>
        <p className="mt-1 mb-6 text-sm muted">বাকি তথ্যগুলো দিন। মোবাইল নম্বরে কোড মিললে অ্যাকাউন্ট চালু হবে; এরপর আইডি বা এই নম্বর দিয়েও লগইন করতে পারবেন।</p>
        <SignupFlow send={sendLinkOtp} verify={verifyLinkOtp} next={next} initial={{ full_name: name }} lockedEmail={email} />
      </div>
    );
  }

  return (
    <div className="card p-7 md:p-9">
      <p className="text-xs font-bold text-primary dark:text-primary-fixed">আপনার আইডি {profile.user_code}</p>
      <h1 className="mt-1 mb-6 text-2xl font-bold">আপনার পরিচয়</h1>
      <ProfileForm
        next={next}
        values={{
          full_name: profile.full_name, institute: profile.institute ?? "", class_level: profile.class_level ?? "",
          guardian_phone: profile.guardian_phone ? "0" + profile.guardian_phone.slice(3) : "",
        }}
      />
    </div>
  );
}
