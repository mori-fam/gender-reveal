(() => {
  const initial = {
    v: 2,
    gender: "girl",
    theme: "little-bear",
    beforeMessage: "赤ちゃんからお知らせがあります",
    revealMessage: "性別がわかりました",
    finalMessage: "これからもよろしくね♡"
  };

  const TEMPLATE = {
    id: "little-bear",
    name: "Little Bear",
    images: {
      before: "./templates/little-bear/open-before.svg",
      revealBoy: "./templates/little-bear/open-after-boy.svg",
      revealGirl: "./templates/little-bear/open-after-girl.svg",
      finalBoy: "./templates/little-bear/final-boy.svg",
      finalGirl: "./templates/little-bear/final-girl.svg"
    }
  };

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const fromB64url = (input) => {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
    const text = atob(base64);
    return Uint8Array.from(text, (c) => c.charCodeAt(0));
  };

  const deriveKey = async (secret, salt) => {
    const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  };

  const encryptPayload = async (payload, secret) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(secret, salt);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)));
    const out = new Uint8Array(salt.length + iv.length + cipher.byteLength);
    out.set(salt, 0);
    out.set(iv, salt.length);
    out.set(new Uint8Array(cipher), salt.length + iv.length);
    return b64url(out);
  };

  const decryptPayload = async (token, secret) => {
    const bytes = fromB64url(token);
    const key = await deriveKey(secret, bytes.slice(0, 16));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(16, 28) }, key, bytes.slice(28));
    return JSON.parse(dec.decode(plain));
  };

  const stageImage = (stage, gender) => {
    if (stage === "before") return TEMPLATE.images.before;
    if (stage === "reveal") return gender === "boy" ? TEMPLATE.images.revealBoy : TEMPLATE.images.revealGirl;
    return gender === "boy" ? TEMPLATE.images.finalBoy : TEMPLATE.images.finalGirl;
  };

  const stageMessage = (payload, stage) => stage === "before" ? payload.beforeMessage : stage === "reveal" ? payload.revealMessage : payload.finalMessage;

  const app = document.getElementById("app");
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("d");
  const key = params.get("k");

  if (token) {
    const renderReveal = (viewData) => {
      let stage = "before";
      const render = () => {
        const image = stageImage(stage, viewData.gender);
        const message = stageMessage(viewData, stage);
        app.innerHTML = `<main class="revealView"><section class="imageStage" role="button" tabindex="0" aria-label="次へ進む"><img src="${image}" alt="${TEMPLATE.name} ${stage}" /><p class="overlayMessage">${message}</p>${stage !== "final" ? '<span class="tapHint">タップで次へ</span>' : ""}</section></main>`;
        const box = app.querySelector(".imageStage");
        const proceed = () => {
          stage = stage === "before" ? "reveal" : "final";
          render();
        };
        box.addEventListener("click", proceed);
        box.addEventListener("keydown", (e) => e.key === "Enter" && proceed());
      };
      render();
    };

    app.innerHTML = `<main class="builder"><section class="formPanel"><h2>合言葉を入力してください</h2><label>合言葉<input id="viewSecret" autocomplete="off" /></label><button id="openLinkBtn">開く</button><p id="viewErr" class="err"></p></section></main>`;

    const secretInput = document.getElementById("viewSecret");
    if (key) secretInput.value = key;

    const open = async () => {
      const secret = secretInput.value.trim();
      const errEl = document.getElementById("viewErr");
      if (!secret) { errEl.textContent = "合言葉を入力してください。"; return; }
      errEl.textContent = "";
      try {
        const viewData = await decryptPayload(token, secret);
        renderReveal(viewData);
      } catch {
        errEl.textContent = "合言葉が違うか、リンクが壊れています。";
      }
    };

    document.getElementById("openLinkBtn").addEventListener("click", open);
    secretInput.addEventListener("keydown", (e) => e.key === "Enter" && open());
    return;
  }

  app.innerHTML = `
  <section class="builder"><div class="leftCol">
  <header><p class="brand">Surprise Link</p><h1>ジェンダーリビール メッセージ作成</h1><p class="lead">テンプレートを選んで、想いを込めたサプライズリンクを作りましょう。</p></header>
  <section><h2>1 テンプレートを選ぶ</h2><button class="templateCard active" aria-pressed><img id="templatePreview" src="${stageImage("reveal", initial.gender)}" alt="テンプレート見本" class="templatePreview" /><div><strong>${TEMPLATE.name}</strong><p>オープン前 / オープン後</p></div></button></section>
  <section class="formPanel"><h2>2 メッセージを入力する</h2>
  <label>合言葉（受け取る人に伝えるパスワード）<input id="secret" value="baby2026" /></label>
  <label>オープン前メッセージ<input id="beforeMessage" maxlength="50" value="${initial.beforeMessage}" /></label>
  <label>オープン時メッセージ<input id="revealMessage" maxlength="50" value="${initial.revealMessage}" /></label>
  <label>最後のメッセージ<input id="finalMessage" maxlength="50" value="${initial.finalMessage}" /></label></section>
  <section><h2>3 性別を選ぶ</h2><div class="seg"><label id="girlLabel" class="picked girl"><input type="radio" name="gender" value="girl" checked /> 女の子</label><label id="boyLabel" class="boy"><input type="radio" name="gender" value="boy" /> 男の子</label></div></section>
  <section class="result"><h2>4 設定を確認して、リンクを生成する</h2><ul id="summary"></ul><button id="generateBtn">リンクを生成する</button><textarea id="resultUrl" readonly rows="3" style="display:none"></textarea><div id="actions" class="actions" style="display:none"><button id="copyBtn">リンクをコピー</button><span id="copied" style="display:none">コピーしました</span><a id="previewLink" href="#" target="_blank" rel="noreferrer">プレビューを開く</a></div></section>
  <p id="err" class="err"></p></div><aside class="rightCol"><h3>プレビュー</h3><div class="phoneMock"><img id="previewImage" src="${stageImage("reveal", initial.gender)}" alt="プレビュー画像" /></div><p>テンプレートごとに、オープン前・後の表示が変わります。</p></aside></section>`;

  let data = { ...initial };
  const update = () => {
    document.getElementById("girlLabel").className = data.gender === "girl" ? "picked girl" : "girl";
    document.getElementById("boyLabel").className = data.gender === "boy" ? "picked boy" : "boy";
    const preview = stageImage("reveal", data.gender);
    document.getElementById("templatePreview").src = preview;
    document.getElementById("previewImage").src = preview;
    document.getElementById("summary").innerHTML = `<li>テンプレート: ${TEMPLATE.name}</li><li>オープン前: ${data.beforeMessage}</li><li>オープン時: ${data.revealMessage}</li><li>最後: ${data.finalMessage}</li><li>性別: ${data.gender === "girl" ? "女の子" : "男の子"}</li>`;
  };
  update();

  ["beforeMessage","revealMessage","finalMessage"].forEach((id) => document.getElementById(id).addEventListener("input", (e) => { data[id] = e.target.value; update(); }));
  document.querySelectorAll('input[name="gender"]').forEach((el) => el.addEventListener("change", (e) => { data.gender = e.target.value; update(); }));

  document.getElementById("generateBtn").addEventListener("click", async () => {
    const secret = document.getElementById("secret").value.trim();
    const errEl = document.getElementById("err");
    if (!secret) { errEl.textContent = "合言葉を入力してください。"; return; }
    errEl.textContent = "";
    const tokenData = await encryptPayload(data, secret);
    const url = `${window.location.origin}${window.location.pathname}#d=${tokenData}`;
    const txt = document.getElementById("resultUrl");
    txt.style.display = "block";
    txt.value = url;
    document.getElementById("actions").style.display = "flex";
    document.getElementById("previewLink").href = url;
  });

  document.getElementById("copyBtn").addEventListener("click", () => {
    const url = document.getElementById("resultUrl").value;
    navigator.clipboard.writeText(url).then(() => {
      const copied = document.getElementById("copied");
      copied.style.display = "inline";
      setTimeout(() => { copied.style.display = "none"; }, 1400);
    });
  });
})();
