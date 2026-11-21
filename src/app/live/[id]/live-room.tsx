"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { liveHeartbeat, livePeople, moderateLive, pollLive, postLiveComment, setLive } from "./actions";
import type { LiveComment, LiveStatus, People } from "./data";

// লাইভ ক্লাসের পাতা (live_class.html এর হুবহু UI)।
// কমেন্ট আর লাইভের খবর: Supabase Realtime (postgres_changes, RLS মেনে); Realtime না চললে ৫ সেকেন্ড পরপর নতুন করে পড়া।
// ভিডিও [অন্তর্বর্তী]: শিক্ষকের ব্রাউজার থেকে প্রতিটা শিক্ষার্থীর কাছে সরাসরি WebRTC, সংযোগের বার্তা Supabase Realtime
//   broadcast দিয়ে (ডেমোতে BroadcastChannel ছিল)। ছোট ক্লাসে (১০-১৫ জন) চলে; বেশি দর্শকের জন্য নিচের [PRODUCTION]।
// [PRODUCTION] শিক্ষক → মিডিয়া সার্ভার (WHIP, get_stream_key), শিক্ষার্থী → Bunny CDN এর HLS (hls.js), রেকর্ডিং সার্ভারে।
//   তখন connectViewer/onOffer এর জায়গায় সেই কোড বসবে, বাকি পাতা একই থাকবে (ডেমোর শেষের [PRODUCTION] অংশ দেখুন)

type Props = {
  session: { id: string; title: string; course: string; teacherId: string; status: LiveStatus; startedAt: number | null };
  me: { id: string; name: string; broadcaster: boolean; moderator: boolean; admin: boolean };
  initialComments: LiveComment[];
  initialPeople: People;
  back: string;
};
type Msg = { type: string; from?: string; to?: string; [k: string]: unknown };
type Mod = "pin" | "unpin" | "resolve" | "unresolve" | "delete";
type Stage = "idle" | "camera-wait" | "ready" | "error" | "playing";

const SLOW_MODE_MS = 10000; // শিক্ষার্থী ১০ সেকেন্ডে একটা কমেন্ট (database এও একই নিয়ম)
const MAX_CHARS = 300;
// STUN দিয়ে বেশিরভাগ নেটওয়ার্কে সংযোগ হয়; কিছু মোবাইল নেটওয়ার্কে TURN লাগে (env দিলে যোগ হয়)
const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  ...(process.env.NEXT_PUBLIC_TURN_URL ? [{ urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USER, credential: process.env.NEXT_PUBLIC_TURN_PASS }] : []),
];

// ---------- ছোট helper ----------
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN[+d]);
const pad = (n: number) => String(n).padStart(2, "0");
const fmtDuration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return bn(h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`);
};
const fmtClock = (ts: number) => { const d = new Date(ts); let h = d.getHours(); const ap = h < 12 ? "এএম" : "পিএম"; h = h % 12 || 12; return bn(`${h}:${pad(d.getMinutes())}`) + " " + ap; };
const firstLetter = (name: string) => {
  if (!name) return "?";
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) return [...new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(name)][0]?.segment ?? name[0];
  return name[0];
};
const pickMime = () => {
  const list = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return typeof MediaRecorder !== "undefined" ? list.find((t) => MediaRecorder.isTypeSupported(t)) ?? "" : "";
};

// ---------- টোস্ট (ডানে ওপরে, নিচে সময়ের দাগ) ----------
type Toast = { id: number; msg: string; type: "success" | "error" | "info"; on: boolean };
function useToast() {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);
  const show = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = ++seq.current;
    setList((l) => [...l, { id, msg, type, on: false }]);
    setTimeout(() => setList((l) => l.map((t) => (t.id === id ? { ...t, on: true } : t))), 20);
    setTimeout(() => setList((l) => l.map((t) => (t.id === id ? { ...t, on: false } : t))), 3000);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3300);
  }, []);
  const node = (
    <div className="pointer-events-none fixed top-20 right-4 z-[200] flex flex-col gap-3 md:top-24 md:right-8" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} role={t.type === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-[360px] min-w-[260px] transform flex-col overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest text-on-background shadow-2xl transition-all duration-300 dark:bg-inverse-surface dark:text-background ${t.on ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}>
          <div className="flex items-center gap-3 px-5 py-4">
            <span className={`icon ${{ success: "text-primary dark:text-primary-fixed", error: "text-error", info: "text-blue-500" }[t.type]}`}>{{ success: "check_circle", error: "error", info: "info" }[t.type]}</span>
            <span className="text-sm font-bold">{t.msg}</span>
          </div>
          <div className="h-1 w-full bg-surface-container-high dark:bg-on-background"><div className={`oc-progress h-full ${{ success: "bg-primary dark:bg-primary-fixed", error: "bg-error", info: "bg-blue-500" }[t.type]}`} /></div>
        </div>
      ))}
    </div>
  );
  return [show, node] as const;
}

// ---------- মোডাল (ডেমোর openModal/closeModal: opacity আর scale) ----------
function Modal({ open, children, label }: { open: boolean; children: ReactNode; label: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => setShown(true));
    return () => { cancelAnimationFrame(r); setShown(false); };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-on-background/50 backdrop-blur-sm transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}>
      <div role="dialog" aria-modal="true" aria-label={label}
        className={`mx-4 w-full max-w-md transform rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl transition-transform duration-300 md:p-8 dark:border-outline-variant/10 dark:bg-inverse-surface ${shown ? "scale-100" : "scale-95"}`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function LiveRoom({ session, me, initialComments, initialPeople, back }: Props) {
  const router = useRouter();
  const IS_BROADCASTER = me.broadcaster, IS_MODERATOR = me.moderator;
  const [toast, toastNode] = useToast();

  // ---------- অবস্থা: 'scheduled' (শুরু হয়নি) → 'live' → 'ended' ----------
  const [status, setStatusState] = useState<LiveStatus>(session.status);
  const [startedAt, setStartedAt] = useState<number | null>(session.startedAt);
  const [comments, setComments] = useState<LiveComment[]>(initialComments);
  const [people, setPeople] = useState<People>(initialPeople);
  const [initialIds] = useState(() => new Set(initialComments.map((c) => c.id)));
  const [viewers, setViewers] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [stageErr, setStageErr] = useState("");
  const [mirror, setMirror] = useState(false);
  const [overlayOn, setOverlayOn] = useState(IS_BROADCASTER);
  const [micOn, setMicOn] = useState(true);
  const [unmute, setUnmute] = useState(false);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [newBelow, setNewBelow] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [rec, setRec] = useState<{ duration: number; peak: number; count: number; url: string | null; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const statusRef = useRef<LiveStatus>(session.status);
  const startedRef = useRef<number | null>(session.startedAt);
  const peakRef = useRef(0);
  const commentsRef = useRef(initialComments);
  const peopleRef = useRef(initialPeople);
  const lastSentAt = useRef(0);
  const slowTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stick = useRef(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const rtOk = useRef(false);
  // শিক্ষকের দিক: ক্যামেরা, ক্যানভাস, রেকর্ডিং, প্রতি দর্শকের সংযোগ
  const media = useRef({
    cam: null as MediaStream | null, mic: null as MediaStreamTrack | null, facing: "environment" as "user" | "environment",
    out: null as MediaStream | null, drawTimer: null as ReturnType<typeof setInterval> | null,
    recorder: null as MediaRecorder | null, chunks: [] as Blob[], wakeLock: null as WakeLockSentinel | null,
  });
  const peers = useRef(new Map<string, { pc: RTCPeerConnection; ice: RTCIceCandidateInit[] }>());
  const viewerMap = useRef(new Map<string, number>()); // viewerId -> শেষ সাড়া
  const viewerPc = useRef<{ pc: RTCPeerConnection; ice: RTCIceCandidateInit[] } | null>(null);

  const send = useCallback((m: Msg) => {
    if (rtOk.current) void chRef.current?.send({ type: "broadcast", event: "m", payload: { ...m, from: me.id } });
  }, [me.id]);

  const setStatus = useCallback((s: LiveStatus, at?: number | null) => {
    statusRef.current = s;
    setStatusState(s);
    if (at) { startedRef.current = at; setStartedAt(at); }
  }, []);

  // ---------- কমেন্ট ----------
  const near = () => { const l = listRef.current; return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 80; };
  const commit = useCallback((next: LiveComment[]) => { commentsRef.current = next; setComments(next); }, []);
  const addComment = useCallback((c: LiveComment) => {
    if (commentsRef.current.some((x) => x.id === c.id)) return;
    const mine = c.user === me.id, n = near();
    stick.current = n || mine;
    if (!n && !mine) setNewBelow(true);
    commit([...commentsRef.current, c].sort((a, b) => a.at - b.at || a.id - b.id));
    if (!peopleRef.current[c.user]) void livePeople(session.id).then((p) => { peopleRef.current = { ...peopleRef.current, ...p }; setPeople(peopleRef.current); });
  }, [commit, me.id, session.id]);
  const applyMod = useCallback((id: number, action: Mod) => {
    const list = commentsRef.current;
    if (!list.some((x) => x.id === id)) return;
    stick.current = false;
    commit(list.map((c) => {
      if (action === "pin") return { ...c, pinned: c.id === id };
      if (c.id !== id) return c;
      if (action === "unpin") return { ...c, pinned: false };
      if (action === "resolve") return { ...c, resolved: true };
      if (action === "unresolve") return { ...c, resolved: false };
      return { ...c, deleted: true, pinned: false };
    }));
  }, [commit]);

  // নতুন কমেন্ট এলে নিচে নামা (নিচের দিকে থাকলে বা নিজের কমেন্ট হলে)
  useLayoutEffect(() => {
    const l = listRef.current;
    if (l && stick.current) l.scrollTop = l.scrollHeight;
  }, [comments]);

  async function moderate(id: number, action: Mod) {
    const before = commentsRef.current;
    applyMod(id, action);
    const r = await moderateLive(id, action);
    if (r.error) { commit(before); toast(r.error, "error"); return; }
    send({ type: "mod", id, action }); // মুছে ফেলা কমেন্ট শিক্ষার্থীর Realtime এ আসে না, তাই আলাদা খবর
  }

  async function postComment() {
    const t = text.trim();
    if (!t || busy) return;
    if (statusRef.current !== "live") { toast("লাইভ চলার সময়ই শুধু কমেন্ট করা যায়", "error"); return; }
    const wait = SLOW_MODE_MS - (new Date().getTime() - lastSentAt.current);
    if (!IS_MODERATOR && wait > 0) { toast(`একটু অপেক্ষা করুন, আর ${bn(Math.ceil(wait / 1000))} সেকেন্ড`, "info"); return; }
    setBusy(true);
    const r = await postLiveComment(session.id, t.slice(0, MAX_CHARS));
    setBusy(false);
    if (r.error || !r.comment) { toast(r.error ?? "কমেন্ট পাঠানো যায়নি", "error"); return; }
    addComment(r.comment);
    lastSentAt.current = new Date().getTime();
    setText("");
    if (inputRef.current) inputRef.current.style.height = "";
    if (!IS_MODERATOR) { // slow mode এর কাউন্টডাউন
      if (slowTimer.current) clearInterval(slowTimer.current);
      const tick = () => {
        const left = Math.ceil((SLOW_MODE_MS - (new Date().getTime() - lastSentAt.current)) / 1000);
        setHint(left > 0 ? `পরের কমেন্ট ${bn(left)} সেকেন্ড পর` : "");
        if (left <= 0 && slowTimer.current) clearInterval(slowTimer.current);
      };
      tick(); slowTimer.current = setInterval(tick, 500);
    }
  }

  // ---------- শিক্ষকের দিক ----------
  const showStageError = (m: string) => { setStageErr(m); setStage("error"); };

  // ক্যামেরার ছবি একটা ক্যানভাসে আঁকা হয়, দর্শকরা আর রেকর্ডিং সেই ক্যানভাস পায়।
  // তাই লাইভের মাঝে ক্যামেরা বদলালেও সংযোগ বা রেকর্ডিং থামে না
  const buildOutStream = useCallback(() => {
    const m = media.current, video = videoRef.current;
    if (m.out || !video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    m.drawTimer = setInterval(() => {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return;
      const scale = Math.min(canvas.width / vw, canvas.height / vh), w = vw * scale, h = vh * scale;
      ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    }, 1000 / 30);
    m.out = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...(m.mic ? [m.mic] : [])]);
  }, []);

  const openCamera = useCallback(async () => {
    const m = media.current, video = videoRef.current;
    if (!video) return;
    if (!navigator.mediaDevices || !window.isSecureContext) { showStageError("পেজটা https:// থেকে খুলুন। নিরাপদ সংযোগ ছাড়া ব্রাউজার ক্যামেরা চালু করতে দেয় না।"); return; }
    setStage("camera-wait");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: m.facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: m.mic ? false : { echoCancellation: true, noiseSuppression: true },
      });
      m.cam?.getVideoTracks().forEach((t) => t.stop());
      m.cam = s;
      if (!m.mic) m.mic = s.getAudioTracks()[0] ?? null;
      video.srcObject = new MediaStream(s.getVideoTracks());
      setMirror(m.facing === "user"); // শুধু নিজের preview উল্টো, দর্শকরা ঠিকটাই দেখে
      await video.play().catch(() => {});
      buildOutStream();
      setStage("ready");
    } catch (err) {
      const e = err as DOMException;
      showStageError(e.name === "NotAllowedError" ? "ক্যামেরা বা মাইকের অনুমতি দেওয়া হয়নি। এড্রেস বারের ক্যামেরা আইকনে চাপ দিয়ে অনুমতি দিন।"
        : e.name === "NotFoundError" ? "এই ডিভাইসে ক্যামেরা বা মাইক পাওয়া যায়নি।"
          : e.name === "NotReadableError" ? "ক্যামেরাটা অন্য কোনো অ্যাপ বা ট্যাব ব্যবহার করছে। সেটা বন্ধ করে আবার চেষ্টা করুন।"
            : "ক্যামেরা চালু করা যায়নি: " + e.message);
    }
  }, [buildOutStream]);

  const closePeer = useCallback((id: string) => { const p = peers.current.get(id); if (p) { p.pc.close(); peers.current.delete(id); } }, []);

  const connectViewer = useCallback(async (viewerId: string) => {
    const out = media.current.out;
    if (!out) return;
    closePeer(viewerId);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    peers.current.set(viewerId, { pc, ice: [] });
    out.getTracks().forEach((t) => {
      const sender = pc.addTrack(t, out);
      // প্রতি দর্শকে আলাদা আপলোড, তাই ভিডিও ~১ Mbps এ বাঁধা
      if (t.kind === "video") { const p = sender.getParameters(); p.encodings = [{ ...(p.encodings?.[0] ?? {}), maxBitrate: 1_000_000 }]; void sender.setParameters(p).catch(() => {}); }
    });
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: "ice", to: viewerId, candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState)) closePeer(viewerId); };
    await pc.setLocalDescription(await pc.createOffer());
    send({ type: "offer", to: viewerId, sdp: pc.localDescription!.toJSON() });
  }, [closePeer, send]);

  const startRecorder = () => {
    const m = media.current;
    // [অন্তর্বর্তী] রেকর্ডিং ব্রাউজারে। [PRODUCTION] মিডিয়া সার্ভার নিজেই রেকর্ড করে, এটা লাগে না
    if (typeof MediaRecorder === "undefined" || !m.out) return;
    m.chunks = [];
    const mime = pickMime();
    m.recorder = new MediaRecorder(m.out, mime ? { mimeType: mime } : undefined);
    m.recorder.ondataavailable = (e) => { if (e.data?.size) m.chunks.push(e.data); };
    m.recorder.start(1000);
  };
  const lockScreen = async () => { try { media.current.wakeLock = (await navigator.wakeLock?.request("screen")) ?? null; } catch { /* না হলেও চলে */ } };

  async function goLive() {
    if (busy) return;
    if (!media.current.out) { await openCamera(); if (!media.current.out) return; }
    setBusy(true);
    const r = await setLive(session.id, true);
    setBusy(false);
    if (r.error) { toast(r.error, "error"); return; }
    const at = new Date().getTime();
    setStatus("live", at);
    startRecorder();
    void lockScreen();
    send({ type: "status", status: "live", startedAt: at });
    viewerMap.current.forEach((_, id) => void connectViewer(id));
    toast("আপনি এখন লাইভে আছেন");
  }

  async function endLive() {
    if (statusRef.current !== "live" || busy) return;
    setBusy(true);
    const r = await setLive(session.id, false);
    setBusy(false);
    if (r.error) { toast(r.error, "error"); return; }
    const duration = new Date().getTime() - (startedRef.current ?? new Date().getTime());
    send({ type: "status", status: "ended" });
    peers.current.forEach((_, id) => closePeer(id));
    setStatus("ended");
    const m = media.current;
    try { void m.wakeLock?.release(); } catch { /* ছেড়ে দেওয়া */ }
    const finish = () => {
      if (m.drawTimer) clearInterval(m.drawTimer);
      m.cam?.getTracks().forEach((t) => t.stop());
      m.mic?.stop();
      let url: string | null = null, name = "";
      if (m.chunks.length) {
        const blob = new Blob(m.chunks, { type: m.chunks[0].type || "video/webm" });
        url = URL.createObjectURL(blob);
        name = `live-${session.id.slice(0, 8)}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
      }
      setRec({ duration, peak: peakRef.current, count: commentsRef.current.filter((c) => !c.deleted).length, url, name });
    };
    if (m.recorder && m.recorder.state !== "inactive") { m.recorder.onstop = finish; m.recorder.stop(); } else finish();
  }

  async function flipCamera() {
    media.current.facing = media.current.facing === "user" ? "environment" : "user";
    await openCamera();
  }
  function toggleMic() {
    const mic = media.current.mic;
    if (!mic) { toast("মাইক পাওয়া যায়নি", "error"); return; }
    mic.enabled = !mic.enabled;
    setMicOn(mic.enabled);
    toast(mic.enabled ? "মাইক চালু" : "মাইক বন্ধ, শিক্ষার্থীরা শুনতে পাচ্ছে না", mic.enabled ? "success" : "info");
  }

  // ---------- দর্শকের দিক ----------
  const onOffer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    viewerPc.current?.pc.close();
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const holder = { pc, ice: [] as RTCIceCandidateInit[] };
    viewerPc.current = holder;
    pc.ontrack = (e) => {
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = e.streams[0];
      void video.play().catch(() => {});
      setStage("playing");
      setUnmute(video.muted);
    };
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: "ice", to: session.teacherId, candidate: e.candidate.toJSON() }); };
    await pc.setRemoteDescription(sdp);
    holder.ice.splice(0).forEach((c) => void pc.addIceCandidate(c).catch(() => {}));
    await pc.setLocalDescription(await pc.createAnswer());
    send({ type: "answer", to: session.teacherId, sdp: pc.localDescription!.toJSON() });
  }, [send, session.teacherId]);
  const addIce = (h: { pc: RTCPeerConnection; ice: RTCIceCandidateInit[] } | null | undefined, cand: RTCIceCandidateInit) => {
    if (!h) return;
    if (h.pc.remoteDescription) void h.pc.addIceCandidate(cand).catch(() => {});
    else h.ice.push(cand);
  };
  const stopViewing = useCallback(() => {
    viewerPc.current?.pc.close(); viewerPc.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setUnmute(false);
    setStage("idle");
  }, []);

  // পুরো অবস্থা নতুন করে (Realtime না চললে, বা পাতায় ফিরলে)
  const refresh = useCallback(async () => {
    const r = await pollLive(session.id, IS_MODERATOR);
    if (!r) return;
    peopleRef.current = { ...peopleRef.current, ...r.people }; setPeople(peopleRef.current);
    const known = new Set(commentsRef.current.map((c) => c.id));
    const fresh = r.comments.filter((c) => !known.has(c.id));
    if (fresh.length) { const n = near(), mine = fresh.some((c) => c.user === me.id); stick.current = n || mine; if (!n && !mine) setNewBelow(true); }
    else stick.current = false;
    commit(r.comments);
    if (r.status !== statusRef.current) {
      if (!IS_BROADCASTER && r.status === "ended") stopViewing();
      if (!(IS_BROADCASTER && statusRef.current === "live" && r.status !== "ended")) setStatus(r.status, r.startedAt);
    }
  }, [IS_BROADCASTER, IS_MODERATOR, commit, me.id, session.id, setStatus, stopViewing]);

  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSoon = () => { if (soon.current) clearTimeout(soon.current); soon.current = setTimeout(() => void refresh(), 400 + Math.random() * 800); };

  // ---------- বার্তা (সংযোগ, লাইভের খবর, কমেন্ট সামলানো) ----------
  const handleRef = useRef<(m: Msg) => void>(() => {});
  useEffect(() => {
    handleRef.current = (msg: Msg) => {
      if (msg.to && msg.to !== me.id) return;
      const from = String(msg.from ?? "");
      switch (msg.type) {
        case "roll-call": if (!IS_BROADCASTER) send({ type: "hello" }); break;
        case "hello": case "ping": {
          if (!IS_BROADCASTER) break;
          const known = viewerMap.current.has(from);
          viewerMap.current.set(from, new Date().getTime());
          if (statusRef.current === "live" && (msg.type === "hello" || !known)) void connectViewer(from);
          break;
        }
        case "bye": if (IS_BROADCASTER) { viewerMap.current.delete(from); closePeer(from); } break;
        // broadcast এর "from" যে কেউ বসাতে পারে, তাই খবর পেলে database থেকে আসল অবস্থা পড়া হয়
        // (মুছে ফেলা কমেন্টের খবর শিক্ষার্থীর Realtime এ আসে না, তাই এটা লাগে)
        case "status": case "mod": if (!IS_BROADCASTER) refreshSoon(); break;
        case "offer": if (!IS_BROADCASTER && from === session.teacherId) void onOffer(msg.sdp as RTCSessionDescriptionInit); break;
        case "answer": { const p = peers.current.get(from); if (p) void p.pc.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit).then(() => p.ice.splice(0).forEach((c) => void p.pc.addIceCandidate(c).catch(() => {}))).catch(() => {}); break; }
        case "ice": if (IS_BROADCASTER) addIce(peers.current.get(from), msg.candidate as RTCIceCandidateInit); else addIce(viewerPc.current, msg.candidate as RTCIceCandidateInit); break;
      }
    };
  });

  // ---------- পাতা চালু: Realtime, ক্যামেরা, সময় ----------
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`live:${session.id}`, { config: { broadcast: { self: false } } });
    chRef.current = ch;
    ch.on("broadcast", { event: "m" }, ({ payload }) => handleRef.current(payload as Msg))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_comments", filter: `session_id=eq.${session.id}` }, ({ new: r }) => {
        const x = r as { id: number; user_id: string; body: string; is_pinned: boolean; is_resolved: boolean; deleted_at: string | null; created_at: string };
        addComment({ id: x.id, user: x.user_id, text: x.body, at: Date.parse(x.created_at), pinned: x.is_pinned, resolved: x.is_resolved, deleted: !!x.deleted_at });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_comments", filter: `session_id=eq.${session.id}` }, ({ new: r }) => {
        const x = r as { id: number; is_pinned: boolean; is_resolved: boolean; deleted_at: string | null };
        stick.current = false;
        commit(commentsRef.current.map((c) => (c.id === x.id ? { ...c, pinned: x.is_pinned && !x.deleted_at, resolved: x.is_resolved, deleted: !!x.deleted_at } : c)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${session.id}` }, ({ new: r }) => {
        const x = r as { status: LiveStatus; started_at: string | null };
        if (x.status === statusRef.current) return;
        if (!IS_BROADCASTER && x.status === "ended") stopViewing();
        setStatus(x.status, x.started_at ? Date.parse(x.started_at) : null);
      })
      .subscribe((st) => {
        const ok = st === "SUBSCRIBED";
        if (ok && !rtOk.current) {
          rtOk.current = true;
          void refresh(); // সংযোগের আগের ফাঁকে যা এসেছে
          if (IS_BROADCASTER) send({ type: "roll-call" }); // আগে থেকে খোলা শিক্ষার্থীদের খুঁজে নেয়
          else send({ type: "hello" });
        } else if (!ok) rtOk.current = false;
      });

    // Realtime না চললে ৫ সেকেন্ড পরপর
    const poll = setInterval(() => { if (!rtOk.current && !document.hidden) void refresh(); }, 5000);
    const onVis = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVis);

    let ping: ReturnType<typeof setInterval> | null = null, prune: ReturnType<typeof setInterval> | null = null;
    const onHide = () => send({ type: "bye" });
    if (!IS_BROADCASTER) {
      ping = setInterval(() => send({ type: "ping" }), 4000);
      window.addEventListener("pagehide", onHide);
    } else {
      // সাড়া না দেওয়া দর্শকের সংযোগ বন্ধ
      prune = setInterval(() => {
        const now = new Date().getTime();
        viewerMap.current.forEach((seen, id) => { if (now - seen > 12000) { viewerMap.current.delete(id); closePeer(id); } });
      }, 3000);
    }
    return () => {
      clearInterval(poll); if (ping) clearInterval(ping); if (prune) clearInterval(prune);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      void supabase.removeChannel(ch); chRef.current = null; rtOk.current = false;
    };
  }, [IS_BROADCASTER, addComment, closePeer, commit, refresh, send, session.id, setStatus, stopViewing]);

  // শিক্ষক: পাতা খুললেই ক্যামেরা; লাইভ চলার মাঝে পাতা আবার খুললে লাইভ চালিয়ে যাওয়া
  useEffect(() => {
    if (!IS_BROADCASTER || session.status === "ended") return;
    const m = media.current, conns = peers.current;
    const t = setTimeout(() => void openCamera().then(() => {
      if (statusRef.current !== "live" || !m.out) return;
      startRecorder();
      void lockScreen();
      send({ type: "roll-call" });
    }), 0);
    return () => {
      clearTimeout(t);
      if (m.drawTimer) clearInterval(m.drawTimer);
      if (m.recorder && m.recorder.state !== "inactive") m.recorder.stop();
      m.cam?.getTracks().forEach((t) => t.stop());
      m.mic?.stop();
      conns.forEach((p) => p.pc.close());
    };
    // শুধু একবার (পাতা খোলার সময়)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // লাইভ চলার সময় ট্যাব বন্ধ বা অন্য অ্যাপে গেলে শিক্ষককে সতর্ক করা
  useEffect(() => {
    if (!IS_BROADCASTER || status !== "live") return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; return ""; };
    const vis = () => { if (document.hidden) toast("লাইভ চলার সময় এই পেজ থেকে সরবেন না", "error"); else void lockScreen(); };
    window.addEventListener("beforeunload", before);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("visibilitychange", vis); };
  }, [IS_BROADCASTER, status, toast]);

  // উপস্থিতি আর দর্শক সংখ্যা (live_heartbeat; শিক্ষক বা admin গোনা হন না, তাঁদের ডাক শুধু সংখ্যা পড়ে, তাই ঘন ঘন)
  useEffect(() => {
    if (status !== "live") return;
    const beat = async () => { const n = await liveHeartbeat(session.id); peakRef.current = Math.max(peakRef.current, n); setViewers(n); };
    void beat();
    const t = setInterval(beat, IS_MODERATOR ? 10000 : 30000);
    return () => clearInterval(t);
  }, [status, session.id, IS_MODERATOR]);

  // LIVE এর পাশের ঘড়ি
  useEffect(() => {
    if (status !== "live" || !startedAt) return;
    const tick = () => setElapsed(new Date().getTime() - startedAt);
    const r = requestAnimationFrame(tick);
    const t = setInterval(tick, 1000);
    return () => { cancelAnimationFrame(r); clearInterval(t); };
  }, [status, startedAt]);

  // ---------- বের হওয়া ----------
  const liveHost = IS_BROADCASTER && status === "live";
  function executeLeave() {
    setLeaveOpen(false);
    if (liveHost) { void endLive(); return; }
    send({ type: "bye" });
    router.replace(back);
  }

  // ---------- দেখানো ----------
  const visible = comments.filter((c) => !c.deleted || IS_MODERATOR);
  const count = comments.filter((c) => !c.deleted).length;
  const pinned = comments.find((c) => c.pinned && !c.deleted);
  const nameOf = (id: string) => people[id]?.name ?? (id === me.id ? me.name : "শিক্ষার্থী");
  const roleOf = (id: string) => people[id]?.role ?? "student";
  const live = status === "live";
  const overlayList = IS_BROADCASTER && overlayOn && live
    ? [...(pinned ? [pinned] : []), ...comments.filter((c) => !c.deleted && c.user !== me.id && !c.pinned).slice(-3)] : [];
  const placeholder = live ? (IS_MODERATOR ? "শিক্ষার্থীদের উত্তর দিন..." : "প্রশ্ন বা সমস্যা লিখুন...")
    : status === "ended" ? "লাইভ শেষ, আর কমেন্ট করা যাবে না" : "লাইভ শুরু হলে কমেন্ট করা যাবে";
  const sub = IS_BROADCASTER ? "আপনি এই ক্লাসের শিক্ষক · ক্যামেরা চালু করে লাইভ শুরু করুন"
    : IS_MODERATOR ? `${me.admin ? "অ্যাডমিন" : "শিক্ষক"} হিসেবে দেখছেন · কমেন্ট সামলাতে পারবেন` : `${me.name} হিসেবে দেখছেন`;

  const big = (icon: string, title: string, body: string, extra?: ReactNode) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-6 text-center text-white">
      <span className="icon mb-3 text-5xl opacity-90">{icon}</span>
      <div className="text-lg font-bold md:text-2xl">{title}</div>
      <div className="mt-2 max-w-md text-sm opacity-80">{body}</div>{extra}
    </div>
  );
  let overlay: ReactNode = null;
  if (stage === "error") {
    overlay = (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center text-white">
        <span className="icon mb-3 text-5xl text-red-400">videocam_off</span><div className="text-lg font-bold">ক্যামেরা চালু হয়নি</div>
        <div className="mt-2 max-w-md text-sm opacity-80">{stageErr}</div>
        <button type="button" onClick={() => { setStage("idle"); void openCamera(); }} className="mt-5 rounded-full bg-white px-6 py-2.5 font-bold text-black">আবার চেষ্টা করুন</button>
      </div>
    );
  } else if (IS_BROADCASTER) {
    if (status === "ended") overlay = big("check_circle", "লাইভ শেষ হয়েছে", "রেকর্ডিং সেভ হয়েছে।");
    else if (stage === "camera-wait") overlay = big("photo_camera", "ক্যামেরা চালু হচ্ছে...", "ব্রাউজার জিজ্ঞেস করলে ক্যামেরা আর মাইকের অনুমতি দিন।");
    else if (status === "scheduled") overlay = (
      // ক্যামেরার preview দেখা যাক, ওপরে ছোট করে নির্দেশনা
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center p-4 text-center text-white">
        <div className="rounded-2xl bg-black/55 px-5 py-3 backdrop-blur"><div className="font-bold">প্রস্তুত?</div><div className="mt-1 text-sm opacity-80">বোর্ড ফ্রেমে আছে কিনা দেখে নিন, তারপর &quot;লাইভ শুরু&quot; চাপুন</div></div>
      </div>
    );
  } else if (status === "ended") {
    overlay = big("event_available", "ক্লাস শেষ হয়েছে", "রেকর্ডিং কিছুক্ষণের মধ্যে কোর্সে লেসন হিসেবে পাবেন।",
      <button type="button" onClick={() => router.replace(back)} className="mt-5 rounded-full bg-primary px-6 py-2.5 font-bold text-white hover:bg-on-primary-fixed-variant">ড্যাশবোর্ডে ফিরুন</button>);
  } else if (live && stage !== "playing") {
    overlay = <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-6 text-center text-white"><div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" /><div className="font-bold">লাইভে যুক্ত হচ্ছে...</div></div>;
  } else if (status === "scheduled") {
    overlay = big("schedule", "শিক্ষক এখনো লাইভ শুরু করেননি", "শুরু হলে নিজে থেকেই ভিডিও চালু হবে, পেজটা খোলা রাখুন।");
  }

  const actBtn = "flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant dark:text-surface-variant";
  return (
    <main className="relative mx-auto w-full max-w-[1440px] grow px-5 pt-2.5 pb-5 md:px-10 md:pt-5 md:pb-10">
      {/* পাতার মাথা */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2 md:mb-5 md:gap-4">
        <button type="button" onClick={() => setLeaveOpen(true)} aria-label="ফিরে যান"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low shadow-sm transition-colors hover:bg-surface-variant dark:bg-white/5">
          <span className="icon text-on-surface dark:text-background">arrow_back</span>
        </button>
        <div className="min-w-0 grow">
          <h2 className="truncate text-xl font-bold text-on-background md:text-3xl dark:text-background">{session.course}</h2>
          <p className="mt-1 text-sm text-on-surface-variant dark:text-surface-variant">{session.title} · {sub}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {live && <span className="flex items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-sm font-bold text-white shadow"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> LIVE <span className="font-normal">{fmtDuration(elapsed)}</span></span>}
          {live && <span className="flex items-center gap-1.5 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-sm font-bold text-on-background dark:bg-white/10 dark:text-background" aria-label="দর্শক"><span className="icon text-[18px]">visibility</span>{bn(viewers)}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:gap-5 lg:grid-cols-[1fr_380px]">
        {/* ভিডিও */}
        <div className="min-w-0">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-black shadow-lg">
            <video ref={videoRef} className={`h-full w-full bg-black object-contain ${mirror ? "-scale-x-100" : ""}`} autoPlay playsInline muted />
            {overlay}

            {/* শিক্ষকের স্ক্রিনে শেষ ৩টা কমেন্ট বড় অক্ষরে, দূর থেকে পড়ার জন্য */}
            {overlayList.length > 0 && (
              <div className="pointer-events-none absolute right-3 bottom-24 left-3 flex flex-col items-start gap-2">
                {overlayList.map((c) => (
                  <div key={c.id} className={`comment-in max-w-[90%] rounded-xl px-4 py-2 text-base font-bold text-white backdrop-blur md:text-2xl ${c.pinned ? "bg-amber-500/90" : "bg-black/65"}`}>
                    <span className="opacity-80">{nameOf(c.user)}:</span> {c.text}
                  </div>
                ))}
              </div>
            )}

            {/* শিক্ষার্থী: শব্দ চালু (ব্রাউজার ভিডিও শুরুতে বন্ধ শব্দে চালায়) */}
            {unmute && (
              <button type="button" onClick={() => { const v = videoRef.current; if (v) { v.muted = false; void v.play().catch(() => {}); } setUnmute(false); }}
                className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white backdrop-blur hover:bg-black/85">
                <span className="icon text-[20px]">volume_off</span> শব্দ চালু করতে ট্যাপ করুন
              </button>
            )}

            {/* শিক্ষকের বোতাম */}
            {IS_BROADCASTER && status !== "ended" && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-linear-to-t from-black/80 to-transparent p-3 md:gap-3 md:p-4">
                <button type="button" className={`ctrl-btn ${micOn ? "" : "is-off"}`} title="মাইক বন্ধ/চালু" aria-label="মাইক বন্ধ/চালু" onClick={toggleMic}><span className="icon">{micOn ? "mic" : "mic_off"}</span></button>
                <button type="button" className="ctrl-btn" title="সামনের/পেছনের ক্যামেরা" aria-label="সামনের/পেছনের ক্যামেরা" onClick={() => void flipCamera()}><span className="icon">cameraswitch</span></button>
                <button type="button" className={`ctrl-btn ${overlayOn ? "" : "is-off"}`} title="বড় অক্ষরে কমেন্ট" aria-label="বড় অক্ষরে কমেন্ট" onClick={() => setOverlayOn((v) => !v)}><span className="icon">subtitles</span></button>
                <button type="button" disabled={busy} onClick={() => (live ? setLeaveOpen(true) : void goLive())}
                  className="ml-1 inline-flex items-center gap-2 rounded-full bg-error px-5 py-3 font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-red-700 disabled:opacity-60 md:ml-3 md:px-7">
                  <span className="icon">sensors</span> <span>{live ? "লাইভ শেষ" : "লাইভ শুরু"}</span>
                </button>
              </div>
            )}
          </div>

          <details className="mt-2 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-sm text-on-surface-variant md:mt-4 dark:border-outline-variant/10 dark:bg-inverse-surface dark:text-surface-variant">
            <summary className="cursor-pointer font-bold text-on-background dark:text-background">লাইভ ক্লাস কীভাবে চলে</summary>
            {IS_BROADCASTER ? (
              <ol className="mt-3 list-decimal space-y-1.5 pl-5">
                <li>ব্রাউজার জিজ্ঞেস করলে ক্যামেরা আর মাইকের অনুমতি দিন। বোর্ড ফ্রেমে আছে কিনা দেখে &quot;লাইভ শুরু&quot; চাপুন।</li>
                <li>ক্লাসের পুরো সময় এই পাতা খোলা রাখুন; অন্য ট্যাব বা অ্যাপে গেলে ভিডিও থেমে যেতে পারে।</li>
                <li>কমেন্টের পাশের বোতাম দিয়ে pin, সমাধান বা মুছে ফেলুন। subtitles বোতামে বড় অক্ষরের কমেন্ট চালু/বন্ধ হয়।</li>
                <li>শেষে &quot;লাইভ শেষ&quot; চাপুন। রেকর্ডিং নামিয়ে কোর্সে লেসন হিসেবে আপলোড করতে পারবেন।</li>
              </ol>
            ) : (
              <ol className="mt-3 list-decimal space-y-1.5 pl-5">
                <li>শিক্ষক লাইভ শুরু করলে ভিডিও নিজে থেকেই চালু হবে, পাতাটা খোলা রাখুন।</li>
                <li>শব্দ না এলে ভিডিওর ওপরের &quot;শব্দ চালু করতে ট্যাপ করুন&quot; চাপুন।</li>
                <li>প্রশ্ন বা সমস্যা কমেন্টে লিখুন{IS_MODERATOR ? "; কমেন্টের পাশের বোতাম দিয়ে pin, সমাধান বা মুছে ফেলতে পারবেন" : "; ১০ সেকেন্ডে একটা কমেন্ট করা যায়"}।</li>
                <li>ক্লাস শেষ হলে রেকর্ডিং কোর্সে লেসন হিসেবে পাবেন।</li>
              </ol>
            )}
          </details>
        </div>

        {/* কমেন্ট */}
        <aside className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm lg:h-auto lg:min-h-[480px] dark:border-outline-variant/10 dark:bg-inverse-surface">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant/20 px-4 py-3">
            <div className="flex items-center gap-2 font-bold text-on-background dark:text-background">
              <span className="icon text-primary dark:text-primary-fixed">forum</span>
              কমেন্ট <span className="text-xs font-normal text-on-surface-variant dark:text-surface-variant">({bn(count)})</span>
            </div>
            {!IS_MODERATOR && <span className="flex items-center gap-1 text-[11px] text-on-surface-variant dark:text-surface-variant"><span className="icon text-[14px]">schedule</span> ১০ সেকেন্ডে একটা কমেন্ট</span>}
          </div>

          {pinned && (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300"><span className="icon text-[14px]">push_pin</span>Pin করা কমেন্ট</div>
              <div className="text-sm text-on-background dark:text-background"><b>{nameOf(pinned.user)}:</b> {pinned.text}</div>
            </div>
          )}

          <div className="relative min-h-0 grow">
            <div ref={listRef} className="custom-scrollbar absolute inset-0 space-y-1 overflow-y-auto px-3 py-3"
              onScroll={() => { if (near()) setNewBelow(false); }}>
              {visible.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center text-on-surface-variant dark:text-surface-variant">
                  <span className="icon text-4xl opacity-60">chat_bubble</span>
                  <p className="mt-2 text-sm">{live ? "এখনো কোনো কমেন্ট নেই। প্রথম প্রশ্নটা করুন!" : "লাইভ শুরু হলে এখানে সবার কমেন্ট দেখা যাবে"}</p>
                </div>
              ) : visible.map((c) => {
                const role = roleOf(c.user), name = nameOf(c.user);
                return (
                  <div key={c.id} className={`group flex gap-2.5 rounded-xl p-2 hover:bg-surface-container-low dark:hover:bg-white/5 ${initialIds.has(c.id) ? "" : "comment-in"} ${c.resolved ? "opacity-60" : ""}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${role === "student" ? "bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed" : "bg-primary text-white"}`}>{firstLetter(name)}</div>
                    <div className="min-w-0 grow">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant dark:text-surface-variant">
                        <span className="font-bold text-on-background dark:text-background">{name}{c.user === me.id ? " (আপনি)" : ""}</span>
                        {role === "teacher" && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">শিক্ষক</span>}
                        {role === "admin" && <span className="rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">অ্যাডমিন</span>}
                        <span>{fmtClock(c.at)}</span>
                        {c.resolved && <span className="flex items-center font-bold text-emerald-600 dark:text-emerald-400"><span className="icon text-[14px]">check_circle</span>সমাধান হয়েছে</span>}
                      </div>
                      <p className={`mt-0.5 text-sm break-words whitespace-pre-line ${c.deleted ? "text-on-surface-variant italic" : "text-on-background dark:text-background"}`}>{c.deleted ? "কমেন্টটি মুছে ফেলা হয়েছে" : c.text}</p>
                    </div>
                    {IS_MODERATOR && !c.deleted && (
                      <div className="flex shrink-0 items-start gap-0.5 opacity-100 transition-opacity group-hover:opacity-100 md:opacity-0">
                        <button type="button" title={c.pinned ? "pin সরান" : "pin করুন"} aria-label={c.pinned ? "pin সরান" : "pin করুন"} onClick={() => void moderate(c.id, c.pinned ? "unpin" : "pin")} className={`${actBtn} hover:bg-amber-500/10 hover:text-amber-600`}><span className="icon text-[18px]">push_pin</span></button>
                        <button type="button" title={c.resolved ? "সমাধান তুলে নিন" : "সমাধান হয়েছে"} aria-label={c.resolved ? "সমাধান তুলে নিন" : "সমাধান হয়েছে"} onClick={() => void moderate(c.id, c.resolved ? "unresolve" : "resolve")} className={`${actBtn} hover:bg-emerald-500/10 hover:text-emerald-600`}><span className="icon text-[18px]">task_alt</span></button>
                        <button type="button" title="মুছুন" aria-label="মুছুন" onClick={() => void moderate(c.id, "delete")} className={`${actBtn} hover:bg-error/10 hover:text-error`}><span className="icon text-[18px]">delete</span></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {newBelow && (
              <button type="button" onClick={() => { const l = listRef.current; if (l) l.scrollTop = l.scrollHeight; setNewBelow(false); }}
                className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                নতুন কমেন্ট <span className="icon text-[16px]">arrow_downward</span>
              </button>
            )}
          </div>

          <form className="flex shrink-0 items-end gap-2 border-t border-outline-variant/20 p-3" onSubmit={(e) => { e.preventDefault(); void postComment(); }}>
            <div className="min-w-0 grow">
              <textarea ref={inputRef} rows={1} maxLength={MAX_CHARS} value={text} disabled={!live} placeholder={placeholder} aria-label="কমেন্ট"
                onChange={(e) => { setText(e.target.value); const t = e.target; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 110) + "px"; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postComment(); } }}
                className="w-full resize-none rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 text-sm text-on-background focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-60 dark:border-outline-variant/20 dark:bg-on-background/40 dark:text-background dark:focus:border-primary-fixed" />
              <div className="mt-1 flex justify-between px-1 text-[11px] text-on-surface-variant dark:text-surface-variant">
                <span>{hint}</span><span>{bn(text.length)}/{bn(MAX_CHARS)}</span>
              </div>
            </div>
            <button type="submit" aria-label="পাঠান" disabled={!live || busy}
              className="mb-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-40">
              <span className="icon">send</span>
            </button>
          </form>
        </aside>
      </div>

      {/* [JaaS] ভিডিও-কল ভিত্তিক লাইভ ক্লাসে Jitsi এই container এ বসত (ডেমোর #live-video-room)। JaaS এ ফিরলে এটা খুলুন।
      <div id="live-video-room" className="mt-2 h-[650px] w-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-black shadow-lg" />
      */}

      {/* বের হওয়া / লাইভ শেষ */}
      <Modal open={leaveOpen} label={liveHost ? "লাইভ শেষ করবেন?" : "ক্লাস থেকে বের হবেন?"}>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-error/10 text-error"><span className="icon text-2xl">logout</span></div>
          <h3 className="text-xl font-bold text-on-background dark:text-background">{liveHost ? "লাইভ শেষ করবেন?" : "ক্লাস থেকে বের হবেন?"}</h3>
        </div>
        <p className="mb-8 ml-16 text-sm text-on-surface-variant dark:text-surface-variant">
          {liveHost ? "বের হলে লাইভ শেষ হয়ে যাবে আর শিক্ষার্থীরা আর দেখতে পাবে না। রেকর্ডিং সেভ হয়ে যাবে।" : "আপনি কি লাইভ ক্লাস থেকে বের হয়ে ড্যাশবোর্ডে ফিরে যেতে চান?"}
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={() => setLeaveOpen(false)} className="rounded-full border border-transparent px-6 py-2.5 font-bold text-on-surface-variant transition-colors hover:border-outline-variant/30 hover:bg-surface-container-low dark:text-surface-variant dark:hover:bg-white/5">বাতিল</button>
          <button type="button" onClick={executeLeave} className="rounded-full bg-error px-6 py-2.5 font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-red-700">{liveHost ? "লাইভ শেষ করুন" : "ফিরে যান"}</button>
        </div>
      </Modal>

      {/* শিক্ষক: লাইভ শেষের পর রেকর্ডিং */}
      <Modal open={!!rec} label="লাইভ শেষ হয়েছে">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed"><span className="icon text-2xl">video_library</span></div>
          <div>
            <h3 className="text-xl font-bold text-on-background dark:text-background">লাইভ শেষ হয়েছে</h3>
            <p className="mt-1 text-xs text-on-surface-variant dark:text-surface-variant">রেকর্ডিং নিজে থেকেই সেভ হয়েছে</p>
          </div>
        </div>
        {rec && (
          <div className="mb-5 grid grid-cols-3 gap-3 text-center">
            {[[fmtDuration(rec.duration), "সময়"], [bn(rec.peak), "সর্বোচ্চ দর্শক"], [bn(rec.count), "কমেন্ট"]].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-surface-container-low p-3 dark:bg-white/5"><div className="font-bold text-on-background dark:text-background">{v}</div><div className="text-[11px] text-on-surface-variant dark:text-surface-variant">{l}</div></div>
            ))}
          </div>
        )}
        {/* [PRODUCTION] মিডিয়া সার্ভার যুক্ত হলে রেকর্ডিং নিজে থেকেই কোর্সে লেসন হয়ে যাবে (recording_lesson_id); তখন এই লেখা বদলাবে */}
        <p className="mb-6 text-sm text-on-surface-variant dark:text-surface-variant">রেকর্ডিং এই ব্রাউজারে হয়েছে। নিচ থেকে নামিয়ে কোর্সে লেসন হিসেবে আপলোড করুন; পাতা বন্ধ করলে রেকর্ডিং হারিয়ে যাবে।</p>
        <div className="flex flex-wrap justify-end gap-3">
          {rec?.url && <a href={rec.url} download={rec.name} className="rounded-full border border-primary/40 px-6 py-2.5 font-bold text-primary transition-colors hover:bg-primary/10 dark:text-primary-fixed">রেকর্ডিং নামান</a>}
          <button type="button" onClick={() => router.replace(back)} className="rounded-full bg-primary px-6 py-2.5 font-bold text-on-primary shadow-md transition-all hover:-translate-y-0.5 hover:bg-on-primary-fixed-variant">ড্যাশবোর্ডে ফিরুন</button>
        </div>
      </Modal>

      {toastNode}
    </main>
  );
}
