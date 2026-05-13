"use client";

import { useEffect, useState } from "react";

type Gender = "boy" | "girl";
type ThemeId = "little-bear";

type Payload = {
  v: 2;
  gender: Gender;
  theme: ThemeId;
  beforeMessage: string;
  revealMessage: string;
  finalMessage: string;
};

type Stage = "before" | "reveal" | "final";

const initial: Payload = {
  v: 2,
  gender: "girl",
  theme: "little-bear",
  beforeMessage: "タップしてね",
  revealMessage: "It's a Girl!",
  finalMessage: "これからもよろしくね♡",
};

const TEMPLATE = {
  id: "little-bear" as const,
  name: "Little Bear",
  images: {
    before: "/templates/little-bear/open-before.svg",
    revealBoy: "/templates/little-bear/open-after-boy.svg",
    revealGirl: "/templates/little-bear/open-after-girl.svg",
    finalBoy: "/templates/little-bear/final-boy.svg",
    finalGirl: "/templates/little-bear/final-girl.svg",
  },
};

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
  out.set(salt, 0);
  out.set(iv, salt.length);
  out.set(new Uint8Array(cipher), salt.length + iv.length);
  return b64url(out);
}

async function decryptPayload(token: string, secret: string): Promise<Payload> {
  const bytes = fromB64url(token);
  const key = await deriveKey(secret, bytes.slice(0, 16));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(16, 28) }, key, bytes.slice(28));
  return JSON.parse(dec.decode(plain)) as Payload;
}

function stageImage(stage: Stage, gender: Gender): string {
  if (stage === "before") return TEMPLATE.images.before;
  if (stage === "reveal") return gender === "boy" ? TEMPLATE.images.revealBoy : TEMPLATE.images.revealGirl;
  return gender === "boy" ? TEMPLATE.images.finalBoy : TEMPLATE.images.finalGirl;
}

function stageMessage(payload: Payload, stage: Stage): string {
  if (stage === "before") return payload.beforeMessage;
  if (stage === "reveal") return payload.revealMessage;
  return payload.finalMessage;
}

export default function Page() {
  const [secret, setSecret] = useState("baby2026");
  const [data, setData] = useState<Payload>(initial);
  const [resultUrl, setResultUrl] = useState("");
  const [viewData, setViewData] = useState<Payload | null>(null);
  const [stage, setStage] = useState<Stage>("before");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("d");
    const key = params.get("k");
    if (!token || !key) return;

    decryptPayload(token, key)
      .then((p) => {
        setViewData(p);
        setStage("before");
      })
      .catch(() => setErr("リンクの読み込みに失敗しました。URLを再確認してください。"));
  }, []);

  const makeUrl = async () => {
    setErr("");
    const token = await encryptPayload(data, secret);
    setResultUrl(`${window.location.origin}${window.location.pathname}#d=${token}&k=${encodeURIComponent(secret)}`);
  };

  const proceed = () => {
    setStage((prev) => (prev === "before" ? "reveal" : "final"));
  };

  if (viewData) {
    const image = stageImage(stage, viewData.gender);
    const message = stageMessage(viewData, stage);

    return (
      <main className="revealView">
        <section className="imageStage" onClick={proceed} role="button" aria-label="次へ進む">
          <img src={image} alt={`${TEMPLATE.name} ${stage}`} />
          <p className="overlayMessage">{message}</p>
          {stage !== "final" && <span className="tapHint">タップで次へ</span>}
        </section>
      </main>
    );
  }

  const previewImage = data.gender === "boy" ? TEMPLATE.images.revealBoy : TEMPLATE.images.revealGirl;

  return (
    <main className="builder">
      <header>
        <h1>ジェンダーリビール メッセージ作成</h1>
        <p>テンプレートは現状 Little Bear のみです。性別選択で見本画像が切り替わります。</p>
      </header>

      <section className="templateGrid">
        <button className="templateCard active" aria-pressed>
          <strong>{TEMPLATE.name}</strong>
          <img src={previewImage} alt="テンプレート見本" className="templatePreview" />
        </button>
      </section>

      <section className="formPanel">
        <div className="seg">
          <label>
            <input type="radio" name="gender" checked={data.gender === "girl"} onChange={() => setData({ ...data, gender: "girl", revealMessage: "It's a Girl!" })} /> 女の子
          </label>
          <label>
            <input type="radio" name="gender" checked={data.gender === "boy"} onChange={() => setData({ ...data, gender: "boy", revealMessage: "It's a Boy!" })} /> 男の子
          </label>
        </div>

        <label>合言葉（受け取る人に伝えるパスワード）<input value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
        <label>オープン前メッセージ<input value={data.beforeMessage} onChange={(e) => setData({ ...data, beforeMessage: e.target.value })} /></label>
        <label>オープン時メッセージ<input value={data.revealMessage} onChange={(e) => setData({ ...data, revealMessage: e.target.value })} /></label>
        <label>最後のメッセージ<input value={data.finalMessage} onChange={(e) => setData({ ...data, finalMessage: e.target.value })} /></label>

        <button onClick={makeUrl}>リンクを生成する</button>
      </section>

      {resultUrl && (
        <section className="result">
          <h2>完成しました！</h2>
          <textarea readOnly value={resultUrl} rows={3} />
          <div className="actions">
            <button
              onClick={() =>
                navigator.clipboard.writeText(resultUrl).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                })
              }
            >
              リンクをコピー
            </button>
            {copied && <span>コピーしました</span>}
          </div>
          <a href={resultUrl} target="_blank" rel="noreferrer">
            このリンクをプレビューする
          </a>
        </section>
      )}
      {err && <p className="err">{err}</p>}
    </main>
  );
}
