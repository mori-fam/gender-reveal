"use client";

import { useEffect, useMemo, useState } from "react";

type Gender = "boy" | "girl";
type ThemeId = "bear" | "star" | "pop";

type Payload = {
  v: 1;
  gender: Gender;
  theme: ThemeId;
  beforeTitle: string;
  beforeSub?: string;
  revealTitle: string;
  revealSub?: string;
  afterTitle: string;
  afterSub?: string;
};

type Theme = {
  id: ThemeId;
  name: string;
  beforeEmoji: string;
  boxEmoji: string;
  boyEmoji: string;
  girlEmoji: string;
  bg: string;
  card: string;
};

const THEMES: Theme[] = [
  { id: "bear", name: "Little Bear", beforeEmoji: "🧸", boxEmoji: "🎁", boyEmoji: "💙", girlEmoji: "🩷", bg: "#f8f3ed", card: "#e8f0ff" },
  { id: "star", name: "Star Reveal", beforeEmoji: "🌙", boxEmoji: "✨", boyEmoji: "⭐", girlEmoji: "🌸", bg: "#111a44", card: "#1f2b6b" },
  { id: "pop", name: "Pop Party", beforeEmoji: "🎉", boxEmoji: "🎊", boyEmoji: "🩵", girlEmoji: "💗", bg: "#fff4ea", card: "#fff" }
];

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const text = atob(base64);
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptPayload(payload: Payload, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(secret, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)));
  const out = new Uint8Array(salt.length + iv.length + cipher.byteLength);
  out.set(salt, 0); out.set(iv, salt.length); out.set(new Uint8Array(cipher), salt.length + iv.length);
  return b64url(out);
}
async function decryptPayload(token: string, secret: string): Promise<Payload> {
  const bytes = fromB64url(token);
  const key = await deriveKey(secret, bytes.slice(0, 16));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(16, 28) }, key, bytes.slice(28));
  return JSON.parse(dec.decode(plain)) as Payload;
}

const initial: Payload = { v: 1, gender: "girl", theme: "bear", beforeTitle: "赤ちゃんからメッセージが届いてるよ", beforeSub: "タップして開いてね", revealTitle: "It's a Girl!", revealSub: "女の子です", afterTitle: "これからもよろしくね♡", afterSub: "from T & K" };

export default function Page() {
  const [secret, setSecret] = useState("baby2026");
  const [data, setData] = useState<Payload>(initial);
  const [resultUrl, setResultUrl] = useState("");
  const [viewData, setViewData] = useState<Payload | null>(null);
  const [phase, setPhase] = useState<"before" | "reveal" | "after">("before");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const active = useMemo(() => THEMES.find((t) => t.id === (viewData?.theme ?? data.theme)) ?? THEMES[0], [viewData?.theme, data.theme]);
  useEffect(() => { setData((d) => ({ ...d, revealTitle: d.gender === "boy" ? "It's a Boy!" : "It's a Girl!", revealSub: d.gender === "boy" ? "男の子です" : "女の子です" })); }, [data.gender]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("d"); const key = params.get("k");
    if (!token || !key) return;
    decryptPayload(token, key).then((p) => { setViewData(p); setPhase("before"); }).catch(() => setErr("リンクの読み込みに失敗しました。URLを再確認してください。"));
  }, []);

  const makeUrl = async () => {
    setErr("");
    const token = await encryptPayload(data, secret);
    setResultUrl(`${window.location.origin}${window.location.pathname}#d=${token}&k=${encodeURIComponent(secret)}`);
  };

  if (viewData) {
    return <main className="view" style={{ background: active.bg, color: active.id === "star" ? "#fff" : "#432" }}>
      <section className="card" style={{ background: active.card }}>
        {phase === "before" && <><p className="hero">{active.beforeEmoji}</p><h1>{viewData.beforeTitle}</h1><p>{viewData.beforeSub}</p><button onClick={() => setPhase("reveal")}>オープンする</button></>}
        {phase === "reveal" && <><div className="burst">{active.boxEmoji}</div><h1>{viewData.revealTitle}</h1><p>{viewData.revealSub}</p><p className="hero">{viewData.gender === "boy" ? active.boyEmoji : active.girlEmoji}</p><button onClick={() => setPhase("after")}>つぎへ</button></>}
        {phase === "after" && <><h1>{viewData.afterTitle}</h1><p>{viewData.afterSub}</p></>}
      </section></main>;
  }

  return <main className="builder">
    <header><h1>ジェンダーリビール メッセージ作成</h1><p>テンプレートを選んで、想いを込めたサプライズリンクを作りましょう。</p></header>

    <section className="templateGrid">{THEMES.map((t) => <button key={t.id} className={`templateCard ${data.theme === t.id ? "active" : ""}`} onClick={() => setData({ ...data, theme: t.id })}>
      <strong>{t.name}</strong>
      <div className="mini before">{t.beforeEmoji} オープン前</div>
      <div className="mini reveal">{data.gender === "boy" ? t.boyEmoji : t.girlEmoji} オープン後</div>
    </button>)}</section>

    <section className="formPanel">
      <div className="seg"><label><input type="radio" name="gender" checked={data.gender === "girl"} onChange={() => setData({ ...data, gender: "girl" })} /> 女の子</label><label><input type="radio" name="gender" checked={data.gender === "boy"} onChange={() => setData({ ...data, gender: "boy" })} /> 男の子</label></div>
      <label>合言葉（受け取る人に伝えるパスワード）<input value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
      <label>オープン前メッセージ<input value={data.beforeTitle} onChange={(e) => setData({ ...data, beforeTitle: e.target.value })} /></label>
      <label>オープン時メッセージ<input value={data.revealTitle} onChange={(e) => setData({ ...data, revealTitle: e.target.value })} /></label>
      <label>最後のメッセージ<input value={data.afterTitle} onChange={(e) => setData({ ...data, afterTitle: e.target.value })} /></label>
      <button onClick={makeUrl}>リンクを生成する</button>
    </section>

    {resultUrl && <section className="result"><h2>完成しました！</h2><textarea readOnly value={resultUrl} rows={3} />
      <div className="actions"><button onClick={() => navigator.clipboard.writeText(resultUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); })}>リンクをコピー</button>{copied && <span>コピーしました</span>}</div>
      <a href={resultUrl} target="_blank" rel="noreferrer">このリンクをプレビューする</a></section>}
    {err && <p className="err">{err}</p>}
  </main>;
}
