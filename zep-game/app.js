/* EC Games v6 — 3 mode:
   [zones] jawab dengan BERDIRI di zona A/B/C/D,
   [chase] rebutan 🐇 kelinci: kejar, tangkap, jawab duel,
   [race] 🏁 balapan: jawab soal (MC/isian/O-X) untuk buka gembok, finis duluan menang.
   UI neo-brutalism mengikuti design MD Educrazy. */
(() => {
  "use strict";
  const SUPABASE_URL = "https://ljthooujdxcfxiamrufu.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqdGhvb3VqZHhjZnhpYW1ydWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MjUyOTgsImV4cCI6MjEwNzIwMTI5OH0.SuEFqWOznfA2ixf4_HkQXp4KgEg7ztfzmPfrnihreWs";
  let QUESTIONS = window.QUIZ_QUESTIONS || [];
  const TIME_PER_Q = window.QUIZ_TIME_PER_Q || 15;
  const REVEAL_MS = 4500;
  const DUEL_MS = 12000;      // waktu menjawab duel kelinci
  const CATCH_R = 38;         // radius tangkap kelinci
  const BUNNY_SPEED = 235;    // sedikit lebih lambat dari pemain (260)
  // ---- balapan: satu jalur berkelok (serpentine) dipakai bersama, ala Zep ----
  const RACE_MAX_GATES = 8;   // gembok maksimum
  const RACE_RUN = 300;       // kecepatan lari (jarak sepanjang jalur / detik)
  const RACE_OPEN_PTS = 100;  // poin per gembok
  const RACE_FIN_PTS = 150;   // bonus finis
  const RACE_TIME_MS = 150000;// batas waktu balapan
  const RACE_RETRY_MS = 1200; // jeda coba lagi saat salah
  // Geometri jalur: 3 baris, arah zig-zag kiri->kanan->kiri->kanan
  const RACE = { xL: 260, xR: 1540, rowY: [300, 580, 860], road: 62, pad: 230 };
  const EDU_KEY = "sekolahku_db_v1";
  const EDU_SESSION = "sekolahku_session";
  const urlQuizId = new URLSearchParams(location.search).get("quizId") || "";
  let EDU_QUIZ = null;
  let EDU_QIDS = [];
  let EDU_ANSWERS = {};
  let EDU_LOADING = !!urlQuizId;

  const ZONE_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e"];
  const ZONE_DARK = ["#c53030", "#2563eb", "#d97706", "#16a34a"];
  const ZONE_LETTERS = ["A", "B", "C", "D"];
  const ZONE_ICONS = ["🍎", "🔷", "⭐", "🍀"];

  const $ = (id) => document.getElementById(id);
  const screens = { lobby: $("screen-lobby"), room: $("screen-room"), game: $("screen-game") };
  const canvas = $("game");
  const ctx = canvas.getContext("2d");

  const S = {
    me: null, room: null, channel: null, sb: null,
    players: new Map(),
    isHost: false, solo: false,
    mode: "zones", wantMode: "zones",
    quiz: null, // zones: {phase,qIndex,...} | chase: {...} | race: {phase:"race"}
    race: null, // {lanes:{pid:lane}, prog:{pid:opened}, finished:[{id,name,at}], endsAt, timerInt, K, popup:-1, retryT, hintUsed}
    bunny: { x: 800, y: 700, tx: 800, ty: 700, wx: 800, wy: 700, wt: 0, active: false, dir: 1, hop: 0 },
    keys: {}, joy: { x: 0, y: 0 },
    cam: { x: 0, y: 0 },
    bubbles: new Map(), // playerId -> {txt, until}
    raceResults: null, // urutan finis balapan
    streak: 0,
    ghostT: 0, // timestamp berakhirnya timer hantu (survival)
    zoneN: 4, // jumlah zona aktif di mode Zona (2–4 sesuai opsi soal)
    rules: { survival: false, team: false, rounds: false }, // aturan ala ZEP Quiz
    wantRules: { survival: false, team: false, rounds: false },
  };
  const MODE_LABEL = { zones: "🅰️ Zona ABCD", chase: "🐇 Rebutan Kelinci", race: "🏁 Balapan" };
  const MODE_SHORT = { zones: "🅰️ Zona", chase: "🐇 Kelinci", race: "🏁 Balapan" };
  const MODE_OK = (m) => m === "zones" || m === "chase" || m === "race";
  const RULE_LABEL = { survival: "👻 Survival", team: "🔴🔵 Tim", rounds: "🔁 Ronde" };
  const ROUND_SIZE = 3; // jumlah soal per ronde (aturan Ronde)
  const GHOST_MS = 10000; // durasi timer hantu (aturan Survival)
  const TEAM_LABEL = ["🔴 Merah", "🔵 Biru"];
  const TEAM_COLOR = ["#ee5560", "#3d97f0"];
  const normAns = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ");

  /* ================= WORLD ================= */
  const WORLD = { w: 2200, h: 1500 };
  const WORLD_BASE = { w: 2200, h: 1500 };
  function ensureRaceWorld() { WORLD.w = raceWorldW(); WORLD.h = raceWorldH(); }
  function restoreWorld() { WORLD.w = WORLD_BASE.w; WORLD.h = WORLD_BASE.h; }
  const VIEW = { w: 960, h: 600 };
  let DPR = 1;
  const CX = 1100, CY = 650;
  const ZW = 340, ZH = 220, ZG = 30;
  const ZONES = [
    { x: CX - ZW - ZG / 2, y: CY - ZH - ZG / 2, w: ZW, h: ZH },
    { x: CX + ZG / 2, y: CY - ZH - ZG / 2, w: ZW, h: ZH },
    { x: CX - ZW - ZG / 2, y: CY + ZG / 2, w: ZW, h: ZH },
    { x: CX + ZG / 2, y: CY + ZG / 2, w: ZW, h: ZH },
  ];
  const STAGE = { x: CX - 180, y: 40, w: 360, h: 96 };
  const POND = { x: 1850, y: 1090, r: 110 };
  const TREES = [
    [130, 170], [330, 110], [1960, 180], [1780, 150], [140, 1300], [340, 1390], [1920, 1280], [1730, 1380],
    [560, 1380], [1560, 1390], [80, 720], [2090, 760], [760, 140], [1420, 120], [1050, 1430],
  ];
  const FLOWERS = [
    [520, 260], [900, 200], [1320, 220], [1650, 380], [470, 1000], [1180, 1340], [1560, 900], [250, 480],
    [1860, 560], [640, 780], [1480, 1180], [1020, 1180], [420, 620], [1720, 980],
  ];
  const ROCKS = [[300, 420], [1880, 420], [420, 1240], [1760, 1240], [1000, 220], [1300, 1400]];
  const PATCHES = [[430, 520, 100], [1520, 640, 120], [880, 940, 90], [1720, 320, 105], [320, 1010, 92], [1260, 1360, 110], [660, 260, 88]];
  const GRASS_TUFTS = (() => { const a = []; for (let i = 0; i < 170; i++) a.push([Math.random() * WORLD.w, Math.random() * WORLD.h]); return a; })();
  /* ---- map khusus mode 🐇 Kelinci: padang rumput hangat + sarang & wortel ---- */
  const CH_PATCHES = [[420, 380, 120], [1500, 360, 110], [900, 760, 100], [1300, 980, 120], [560, 1080, 96], [1680, 1040, 110], [1080, 300, 92], [240, 700, 100], [1960, 720, 100]];
  const CH_TREES = [[150, 180], [360, 120], [600, 150], [860, 110], [1180, 110], [1460, 130], [1720, 160], [1980, 200], [2100, 460], [2140, 780], [2100, 1120], [1960, 1380], [1700, 1420], [1400, 1430], [1080, 1420], [760, 1410], [440, 1380], [180, 1360], [70, 980], [60, 620], [300, 300], [1900, 300], [500, 700], [1700, 700], [420, 1160], [1820, 1160], [980, 220], [1300, 220]];
  const CH_BURROWS = [[700, 720], [1480, 760], [1090, 1120]];
  const CH_CARROTS = [[560, 640], [820, 660], [1300, 650], [1560, 700], [540, 860], [1650, 880], [700, 980], [1460, 980], [950, 560], [1230, 560], [900, 1200], [1300, 1200], [1080, 860], [360, 1000], [1860, 1000], [240, 520], [1980, 540]];
  const CH_MUSH = [[380, 560], [1760, 540], [520, 1020], [1680, 1000], [980, 1340], [1240, 1330], [300, 860], [1900, 860]];
  const CH_HAY = [[620, 900], [1560, 880], [1010, 640], [1230, 640]];
  const CH_LOGS = [[640, 1060, -0.3], [1520, 1060, 0.22], [360, 440, 0.12], [1800, 440, -0.12]];
  const CH_ROCKS = [[900, 300], [1300, 320], [440, 1240], [1780, 1240], [1000, 700], [1180, 700]];
  const CH_FLOWERS = [[500, 300], [900, 260], [1400, 300], [700, 1240], [1500, 1240], [1900, 620], [220, 760], [1080, 1350]];

  const zoneAt = (x, y) => {
    const n = (S.mode === "zones" && S.zoneN) ? S.zoneN : 4; // zona nonaktif dianggap bukan jawaban
    for (let i = 0; i < n; i++) {
      const z = ZONES[i];
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return i;
    }
    return -1;
  };
  const collide = (x, y) => {
    if (S.mode === "race" && S.race) {
      // arena balapan: hanya batas peta
      if (x < 40 || x > WORLD.w - 20 || y < 60 || y > WORLD.h - 40) return true;
      return false;
    }
    if (S.mode === "chase") {
      // padang kelinci: hanya batas peta (tanpa panggung/kolam)
      if (x < 24 || x > WORLD.w - 24 || y < 40 || y > WORLD.h - 24) return true;
      return false;
    }
    if (x < 24 || x > WORLD.w - 24 || y < 30 || y > WORLD.h - 20) return true;
    if (x > STAGE.x - 14 && x < STAGE.x + STAGE.w + 14 && y > STAGE.y - 10 && y < STAGE.y + STAGE.h + 18) return true;
    if (Math.hypot(x - POND.x, y - POND.y) < POND.r + 12) return true;
    return false;
  };
  const spawnFor = (i) => [[620, 1050], [1580, 1050], [860, 1140], [1350, 1140], [1100, 1180], [740, 990], [1460, 990], [1100, 990]][i % 8];

  /* ---- aturan ala ZEP: survival (hantu), tim, ronde ---- */
  const teamOf = (p) => ((p && p.team) | 0);
  function aliveCount() { let n = 0; S.players.forEach((p) => { if (!p.dead) n++; }); return n; }
  function teamScore(t) { let s = 0; S.players.forEach((p) => { if (teamOf(p) === t) s += (p.score || 0); }); return s; }
  function assignTeams() {
    const ids = [...S.players.keys()].sort();
    ids.forEach((id, i) => { const p = S.players.get(id); if (p) p.team = i % 2; });
    if (S.me) { const rec = S.players.get(S.me.id); if (rec) S.me.team = rec.team; }
  }
  function resetDead() { S.players.forEach((p) => { p.dead = false; }); if (S.me) S.me.dead = false; S.ghostT = 0; }
  function markGhost() {
    if (!S.me) return;
    S.me.dead = true;
    const rec = S.players.get(S.me.id); if (rec) rec.dead = true;
    S.ghostT = Date.now() + GHOST_MS;
    send("score", { id: S.me.id, name: S.me.name, avatar: S.me.avatar, color: S.me.color, look: S.me.look, score: S.me.score, dead: true });
    track();
  }
  function ghostLeft() { return (S.me && S.me.dead && S.ghostT) ? Math.max(0, Math.ceil((S.ghostT - Date.now()) / 1000)) : 0; }
  function ruleText(r) { r = r || S.rules; const on = ["survival", "team", "rounds"].filter((k) => r[k]).map((k) => RULE_LABEL[k]); return on.length ? on.join(" · ") : "—"; }
  const roundOf = (i) => Math.floor(i / ROUND_SIZE) + 1;

  const clampCamX = (px, ww) => (VIEW.w >= ww ? -(VIEW.w - ww) / 2 : Math.max(0, Math.min(ww - VIEW.w, px - VIEW.w / 2)));
  const clampCamY = (py, wh) => (VIEW.h >= wh ? -(VIEW.h - wh) / 2 : Math.max(0, Math.min(wh - VIEW.h, py - VIEW.h / 2)));

  /* ================= SOUND ================= */
  let AC = null;
  const ac = () => {
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      return AC;
    } catch (_) { return null; }
  };
  const beep = (f, t, d, type) => {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, c.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + d);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + t); o.stop(c.currentTime + t + d + 0.05);
  };
  const sfx = (k) => {
    try {
      if (k === "click") beep(600, 0, 0.08, "square");
      else if (k === "join") { beep(523, 0, 0.12); beep(784, 0.1, 0.15); }
      else if (k === "correct") { beep(659, 0, 0.12); beep(880, 0.1, 0.2); }
      else if (k === "wrong") beep(180, 0, 0.3, "sawtooth");
      else if (k === "tick") beep(880, 0, 0.06, "square");
      else if (k === "reveal") { beep(523, 0, 0.12); beep(659, 0.12, 0.12); beep(784, 0.24, 0.25); }
      else if (k === "win") { [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.13, 0.2)); }
      else if (k === "go") { beep(440, 0, 0.1, "square"); beep(440, 0.15, 0.1, "square"); beep(880, 0.3, 0.3, "square"); }
      else if (k === "catch") { beep(784, 0, 0.1); beep(1047, 0.08, 0.2); }
    } catch (_) {}
  };

  /* ================= helpers ================= */
  const uid = () => "p-" + Math.random().toString(36).slice(2, 9);
  const randCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
  const show = (name) => Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
  let toastT = null;
  const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 2400); };
  const err = (msg) => { $("lobby-err").textContent = msg || ""; };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ================= wardrobe (karakter) ================= */
  let meLook = ECAVATAR.load();
  S.progress = ECAVATAR.loadProgress();
  S.meLook = meLook;
  S.meAvatar = ECAVATAR.emoji(meLook);
  S.meColor = meLook.outfitColor;
  const ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>';
  let activeCat = (ECAVATAR.TABS[0] || {}).key;
  const catOf = (key) => ECAVATAR.CATS.find((c) => c.key === key) || ECAVATAR.CATS[0];
  const colorName = (hex) => ECAVATAR.COLOR_NAMES[hex] || hex;
  const itemName = (cat, value) => (cat.kind === "swatch" ? colorName(value) : (cat.names && cat.names[value]) || value);
  const updateLookName = () => {
    const el = $("look-name");
    if (!el) return;
    const input = $("in-name");
    const name = input ? input.value.trim() : "";
    el.textContent = name || "Karakter kamu";
    el.title = name || "Karakter kamu";
    el.classList.toggle("is-empty", !name);
  };
  const buildWardrobe = () => {
    const tabsEl = $("look-tabs"), gridEl = $("look-grid"), colorsEl = $("look-colorrow");
    if (!tabsEl || !gridEl) return;
    const canvas = $("look-preview");
    const stage = $("look-stage");
    const prog = S.progress || ECAVATAR.loadProgress();
    const refreshPreview = () => {
      try { ECAVATAR.drawPreview(canvas, meLook); } catch (_) {}
      S.meLook = meLook; S.meAvatar = ECAVATAR.emoji(meLook); S.meColor = meLook.outfitColor;
      updateLookName();
      if (stage) {
        const key = JSON.stringify(meLook);
        if (key !== refreshPreview.lastKey) {
          refreshPreview.lastKey = key;
          stage.classList.remove("is-pop");
          void stage.offsetWidth;
          stage.classList.add("is-pop");
        }
      }
    };
    const pickLook = (key, value) => {
      sfx("click");
      meLook = ECAVATAR.norm(Object.assign({}, meLook, { [key]: value }));
      ECAVATAR.save(meLook);
      buildWardrobe();
    };
    const lockHint = (name, lp) => (lp ? "🔒 " + name + " — " + lp.label + " (" + lp.have + "/" + lp.need + ")" : "🔒 " + name + " — belum terbuka");

    // tabs
    tabsEl.innerHTML = "";
    ECAVATAR.TABS.forEach((tab) => {
      const t = document.createElement("button");
      t.type = "button"; t.role = "tab"; t.dataset.cat = tab.key;
      t.id = "look-tab-" + tab.key;
      t.textContent = tab.label;
      t.classList.toggle("active", tab.key === activeCat);
      t.setAttribute("aria-selected", tab.key === activeCat ? "true" : "false");
      t.setAttribute("aria-controls", "look-grid");
      t.tabIndex = tab.key === activeCat ? 0 : -1;
      t.onclick = () => { activeCat = tab.key; sfx("click"); buildWardrobe(); };
      t.addEventListener("keydown", (event) => {
        const list = ECAVATAR.TABS;
        const at = list.findIndex((c) => c.key === activeCat);
        let next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % list.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + list.length) % list.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = list.length - 1;
        if (next == null) return;
        event.preventDefault();
        activeCat = list[next].key;
        buildWardrobe();
        const focusTab = tabsEl.querySelector('[data-cat="' + activeCat + '"]');
        if (focusTab) focusTab.focus();
      });
      tabsEl.appendChild(t);
    });
    gridEl.setAttribute("aria-labelledby", "look-tab-" + activeCat);

    const makeSwatch = (key, value, compact) => {
      const locked = !ECAVATAR.isUnlocked(key, value, prog);
      const sel = meLook[key] === value;
      const name = colorName(value);
      const lp = locked ? ECAVATAR.lockProgress(key, value, prog) : null;
      const b = document.createElement("button");
      b.type = "button"; b.dataset.key = key; b.dataset.val = value;
      b.className = compact
        ? ["swatch", sel ? "sel" : "", locked ? "locked" : ""].filter(Boolean).join(" ")
        : ["chip", "swatch-tile", sel ? "sel" : "", locked ? "locked" : ""].filter(Boolean).join(" ");
      b.setAttribute("aria-pressed", sel ? "true" : "false");
      b.innerHTML =
        '<span class="swatch-dot" style="background:' + value + '"></span>' +
        (compact ? "" : '<span class="swatch-name">' + escapeHtml(name) + "</span>") +
        (!compact && sel ? '<span class="sel-badge" aria-hidden="true">' + ICON_CHECK + "</span>" : "") +
        (locked ? '<span class="lock" aria-hidden="true">' + ICON_LOCK + "</span>" : "");
      b.setAttribute(
        "aria-label",
        name + (sel ? " (dipilih)" : "") + (lp ? " (terkunci: " + lp.label + ", " + lp.have + " dari " + lp.need + ")" : "")
      );
      b.title = lp ? "Terkunci · " + lp.label + " (" + lp.have + "/" + lp.need + ")" : name;
      b.onclick = lp ? () => { sfx("wrong"); toast(lockHint(name, lp)); } : () => pickLook(key, value);
      return b;
    };

    // warna kontekstual untuk rambut / baju
    if (colorsEl) {
      colorsEl.innerHTML = "";
      const tab = ECAVATAR.TABS.find((t) => t.key === activeCat);
      if (tab && tab.colorKey) {
        const label = document.createElement("span");
        label.className = "look-colorrow-label";
        label.textContent = tab.colorLabel;
        const current = document.createElement("span");
        current.className = "look-color-name";
        current.textContent = colorName(meLook[tab.colorKey]);
        const swatches = document.createElement("div");
        swatches.className = "look-swatches";
        catOf(tab.colorKey).items.forEach((v) => swatches.appendChild(makeSwatch(tab.colorKey, v, true)));
        colorsEl.append(label, current, swatches);
        colorsEl.hidden = false;
      } else {
        colorsEl.hidden = true;
      }
    }

    // grid untuk kategori aktif
    const cat = catOf(activeCat);
    gridEl.innerHTML = "";
    cat.items.forEach((value) => {
      if (cat.kind === "swatch") {
        gridEl.appendChild(makeSwatch(activeCat, value, false));
        return;
      }
      const locked = !ECAVATAR.isUnlocked(activeCat, value, prog);
      const sel = meLook[activeCat] === value;
      const lp = locked ? ECAVATAR.lockProgress(activeCat, value, prog) : null;
      const name = itemName(cat, value);
      const b = document.createElement("button");
      b.type = "button"; b.dataset.key = activeCat; b.dataset.val = value;
      b.className = ["chip", "item-tile", sel ? "sel" : "", locked ? "locked" : ""].filter(Boolean).join(" ");
      b.setAttribute("aria-pressed", sel ? "true" : "false");
      b.setAttribute(
        "aria-label",
        name + (sel ? " (dipilih)" : "") + (lp ? " (terkunci: " + lp.label + ", " + lp.have + " dari " + lp.need + ")" : "")
      );
      b.title = lp ? "Terkunci · " + lp.label + " (" + lp.have + "/" + lp.need + ")" : name;

      const wrap = document.createElement("span");
      wrap.className = "thumb-wrap";
      const thumb = document.createElement("canvas");
      thumb.className = "chip-thumb";
      thumb.setAttribute("aria-hidden", "true");
      wrap.appendChild(thumb);
      if (sel) {
        const badge = document.createElement("span");
        badge.className = "sel-badge"; badge.setAttribute("aria-hidden", "true"); badge.innerHTML = ICON_CHECK;
        wrap.appendChild(badge);
      }
      if (locked) {
        const lock = document.createElement("span");
        lock.className = "lock"; lock.setAttribute("aria-hidden", "true"); lock.innerHTML = ICON_LOCK;
        wrap.appendChild(lock);
      }
      b.appendChild(wrap);
      const label = document.createElement("span");
      label.className = "chip-name";
      label.textContent = name;
      b.appendChild(label);
      ECAVATAR.drawThumb(thumb, Object.assign({}, meLook, { [activeCat]: value }), 64);
      b.onclick = lp ? () => { sfx("wrong"); toast(lockHint(name, lp)); } : () => pickLook(activeCat, value);
      gridEl.appendChild(b);
    });

    const rb = $("look-random");
    if (rb) rb.onclick = () => { sfx("click"); meLook = unlockedRandom(prog); ECAVATAR.save(meLook); buildWardrobe(); };
    const rs = $("look-reset");
    if (rs) rs.onclick = () => {
      sfx("click");
      meLook = ECAVATAR.norm(ECAVATAR.DEFAULT);
      ECAVATAR.save(meLook);
      buildWardrobe();
      toast("Tampilan dikembalikan ke awal.");
    };
    const pl = $("look-progress");
    if (pl) {
      const keys = Object.keys(ECAVATAR.LOCKS || {});
      const got = keys.filter((k) => { const i = k.indexOf(":"); return ECAVATAR.isUnlocked(k.slice(0, i), k.slice(i + 1), prog); }).length;
      const pct = keys.length ? Math.round((got / keys.length) * 100) : 0;
      pl.innerHTML =
        '<span class="lp-label">Koleksi eksklusif</span>' +
        '<span class="lp-count">' + got + "/" + keys.length + '</span>' +
        '<span class="lp-track" aria-hidden="true"><span class="lp-fill" style="width:' + pct + '%"></span></span>';
      pl.classList.toggle("all", keys.length > 0 && got === keys.length);
      pl.setAttribute("aria-label", got + " dari " + keys.length + " item eksklusif sudah terbuka");
    }
    refreshPreview();
  };
  function unlockedRandom(prog) {
    let l = ECAVATAR.randomLook();
    for (let i = 0; i < 20 && !ECAVATAR.CATS.every((c) => ECAVATAR.isUnlocked(c.key, l[c.key], prog)); i++) l = ECAVATAR.randomLook();
    return l;
  }
  function bumpProgress(delta) {
    const p = S.progress = S.progress || ECAVATAR.loadProgress();
    if (delta.correct) p.correct += delta.correct;
    if (delta.points) p.points += delta.points;
    if (delta.wins) p.wins += delta.wins;
    if (delta.streak && delta.streak > (p.bestStreak || 0)) p.bestStreak = delta.streak;
    ECAVATAR.saveProgress(p);
    const lob = $("screen-lobby");
    if (lob && !lob.classList.contains("hidden")) buildWardrobe();
  }

  /* ================= Educrazy: soal ================= */
  const ecType = (qt) => /isian|fill|singkat/i.test(qt || "") ? "fill" : /ox|benar|salah|true/i.test(qt || "") ? "ox" : "mc";
  const normOpt = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ");
  function keyIndex(opts, ans) {
    if (!Array.isArray(opts) || !opts.length) return 0;
    const k = normOpt(ans);
    let i = opts.findIndex((o) => normOpt(o) === k);
    if (i >= 0) return i;
    // fallback: kunci berupa huruf (A–D) atau nomor (1-based)
    const raw = String(ans == null ? "" : ans).trim();
    const m = /^([a-zA-Z])[).:\s]?$/.exec(raw);
    if (m) { const n = m[1].toUpperCase().charCodeAt(0) - 65; if (n >= 0 && n < opts.length) return n; }
    if (/^\d+$/.test(raw)) { const n = parseInt(raw, 10); if (n >= 1 && n <= opts.length) return n - 1; if (n === 0) return 0; }
    return 0;
  }
  function applyEduQuiz(quiz, items) {
    EDU_QUIZ = { id: quiz.id, title: quiz.title };
    EDU_QIDS = items.map((it) => it.id);
    EDU_ANSWERS = {};
    QUESTIONS = items.map((it) => {
      const opts = Array.isArray(it.opts) ? it.opts.map(String) : [];
      const type = it.type || "mc";
      if (type === "fill") return { type: "fill", q: it.q, opts: [], text: it.text || String(it.ans == null ? "" : it.ans), hint: it.hint || "", answer: -1 };
      return { type, q: it.q, opts, answer: keyIndex(opts, it.ans) };
    });
    const sub = document.getElementById("lobby-sub");
    if (sub) sub.textContent = "🎓 " + quiz.title + " — soal dari Educrazy (" + QUESTIONS.length + " soal).";
    const back = document.getElementById("edu-back");
    if (back) back.classList.remove("hidden");
    const rl = document.getElementById("room-quiz-label");
    if (rl) rl.textContent = "🎓 " + quiz.title + " (" + QUESTIONS.length + " soal)";
  }
  async function loadEduQuiz() {
    if (!urlQuizId) { EDU_LOADING = false; return false; }
    try {
      const sb = sbClient();
      const { data: sess } = await sb.auth.getSession();
      if (sess && sess.session) {
        const { data: quiz, error: qe } = await sb.from("quizzes").select("id,title").eq("id", urlQuizId).maybeSingle();
        if (!qe && quiz) {
          const { data: rows, error: re } = await sb.from("quiz_questions").select("*").eq("quiz_id", urlQuizId).order("order_no");
          if (!re && rows && rows.length) {
            const pg = rows.filter((q) => q.qtype !== "essay" && (ecType(q.qtype) === "fill" || (Array.isArray(q.options) && q.options.length >= 2)));
            if (pg.length) {
              applyEduQuiz(quiz, pg.map((q) => ({ id: q.id, q: q.question, opts: q.options, ans: q.answer, type: ecType(q.qtype) })));
              try {
                const { data: prof } = await sb.from("profiles").select("name").eq("id", sess.session.user.id).maybeSingle();
                const inp = document.getElementById("in-name");
                if (prof && prof.name && inp && !inp.value) inp.value = String(prof.name).split(" ")[0].slice(0, 14);
              } catch (_) {}
              EDU_LOADING = false;
              return true;
            }
          }
        }
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem(EDU_KEY);
      if (!raw) { EDU_LOADING = false; return false; }
      const db = JSON.parse(raw);
      const quiz = (db.quizzes || []).find((q) => q.id === urlQuizId);
      if (!quiz) { EDU_LOADING = false; return false; }
      const qs = (db.quiz_questions || [])
        .filter((q) => q.quiz_id === urlQuizId)
        .sort((a, b) => (a.order_no || 0) - (b.order_no || 0))
        .filter((q) => q.qtype !== "essay" && (ecType(q.qtype) === "fill" || (Array.isArray(q.options) && q.options.length >= 2)));
      if (!qs.length) { EDU_LOADING = false; return false; }
      applyEduQuiz(quiz, qs.map((q) => ({ id: q.id, q: q.question, opts: q.options, ans: q.answer, type: ecType(q.qtype) })));
      try {
        const sid = localStorage.getItem(EDU_SESSION);
        const me = sid && (db.users || []).find((u) => u.id === sid);
        const inp = document.getElementById("in-name");
        if (me && inp && !inp.value) inp.value = String(me.name || "").split(" ")[0].slice(0, 14);
      } catch (_) {}
      EDU_LOADING = false;
      return true;
    } catch (_) { EDU_LOADING = false; return false; }
  }
  const stripQ = (list) => (list || []).map((q) => ({ q: q.q, opts: q.opts, type: q.type || "mc", text: q.text || "", hint: q.hint || "" }));
  // Soal per mode: zones butuh 4 opsi (zona A-D), chase butuh opsi, race semua tipe.
  function modeQuestions() {
    const qs = [], qids = [];
    QUESTIONS.forEach((Q, i) => {
      const t = Q.type || "mc";
      const nOpt = Array.isArray(Q.opts) ? Q.opts.length : 0;
      let ok = false;
      if (S.mode === "race") ok = (t === "mc" && nOpt >= 2) || t === "ox" || t === "fill";
      else if (S.mode === "chase") ok = (t === "mc" || t === "ox") && nOpt >= 2;
      else ok = (t === "mc" || t === "ox") && nOpt >= 2 && nOpt <= 4; // Zona: 2–4 opsi (sesuai 2×2 zona)
      if (ok) { qs.push(Q); qids.push(EDU_QIDS[i] || ""); }
    });
    return { qs, qids };
  }
  // Geometri lintasan balapan: satu jalur berkelok (serpentine)
  const raceK = () => (S.race ? S.race.K : 0);
  let RACE_PATH = null;
  function racePath() {
    if (RACE_PATH) return RACE_PATH;
    const { xL, xR, rowY } = RACE;
    const pts = [
      { x: xL, y: rowY[0] }, { x: xR, y: rowY[0] }, { x: xR, y: rowY[1] },
      { x: xL, y: rowY[1] }, { x: xL, y: rowY[2] }, { x: xR, y: rowY[2] },
    ];
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ a, b, len, acc: total, ux: (b.x - a.x) / len, uy: (b.y - a.y) / len });
      total += len;
    }
    RACE_PATH = { pts, segs, total };
    return RACE_PATH;
  }
  function raceGeom(K) {
    const P = racePath(), gateD = [];
    for (let i = 0; i < K; i++) gateD.push(P.total * (i + 1) / (K + 1));
    return { total: P.total, gateD, finishD: P.total };
  }
  function racePointAt(d) {
    const P = racePath();
    if (d <= 0) { const s = P.segs[0]; return { x: s.a.x + s.ux * d, y: s.a.y + s.uy * d, ux: s.ux, uy: s.uy }; }
    for (let i = 0; i < P.segs.length; i++) {
      const s = P.segs[i];
      if (d <= s.acc + s.len) { const t = d - s.acc; return { x: s.a.x + s.ux * t, y: s.a.y + s.uy * t, ux: s.ux, uy: s.uy }; }
    }
    const s = P.segs[P.segs.length - 1], t = d - s.acc;
    return { x: s.a.x + s.ux * t, y: s.a.y + s.uy * t, ux: s.ux, uy: s.uy };
  }
  function racePos(d, lat) { const p = racePointAt(d); return { x: p.x - p.uy * lat, y: p.y + p.ux * lat }; }
  function raceOff(i, n) { const step = Math.min(26, 96 / Math.max(1, n)); return (i - (n - 1) / 2) * step; }
  const raceLaneOf = (R, pid) => (R.lanes[pid] != null ? R.lanes[pid] : 0);
  const raceOffFor = (R, pid) => raceOff(raceLaneOf(R, pid), Math.max(1, Object.keys(R.lanes).length));
  const raceWorldW = () => RACE.xR + RACE.pad;
  const raceWorldH = () => RACE.rowY[2] + RACE.pad;
  const raceSetPos = (p, d, lat) => { const q = racePos(d, lat); p.x = q.x; p.y = q.y; p.tx = q.x; p.ty = q.y; };

  /* ================= supabase channel ================= */
  const sbClient = () => {
    if (S.sb) return S.sb;
    S.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return S.sb;
  };

  async function joinRoom(code, name, asHost) {
    err("");
    code = String(code || "").toUpperCase().trim();
    name = String(name || "").trim().slice(0, 14);
    if (!name) { err("Isi nama dulu ya."); return; }
    if (!/^[A-Z0-9]{4,6}$/.test(code)) { err("Kode room 4–6 huruf/angka."); return; }
    sfx("join");
    const sb = sbClient();
    const id = uid();
    const [sx, sy] = spawnFor(Math.floor(Math.random() * 8));
    S.me = { id, name, avatar: S.meAvatar, color: S.meColor, look: S.meLook, x: sx, y: sy, tx: sx, ty: sy, dir: 1, moving: false, score: 0, zone: -1, host: !!asHost };
    S.room = code; S.isHost = !!asHost; S.solo = false; S.streak = 0;
    if (!!asHost) { S.mode = S.wantMode; S.rules = { ...S.wantRules }; }
    S.players.clear();
    S.players.set(id, { ...S.me, isBot: false });

    if (S.channel) { const old = S.channel; S.channel = null; try { await sb.removeChannel(old.raw); } catch (_) {} }
    const rawCh = sb.channel("ec-" + code, { config: { broadcast: { self: false }, presence: { key: id } } });
    // Event yang hanya boleh dikirim host, dan event yang id-nya harus sama dengan pengirim.
    const HOST_EVENTS = new Set(["quiz_start", "rules", "mode", "quiz_q", "quiz_reveal", "quiz_end", "quiz_chase", "bun_move", "chase_lock", "chase_release", "duel_result", "race_start", "race_end", "race_state"]);
    const SELF_EVENTS = new Set(["move", "score", "chat", "race_prog", "race_finish", "race_hello", "bunny_claim"]);
    const ch = {
      on(type, filter, cb) {
        if (type !== "broadcast") { rawCh.on(type, filter, cb); return ch; }
        const ev = filter && filter.event;
        rawCh.on(type, filter, (msg) => {
          if (S.channel !== ch || !S.me) return;
          const payload = msg && msg.payload;
          if (HOST_EVENTS.has(ev) && !fromHost(payload)) return;
          if (SELF_EVENTS.has(ev) && !fromSelf(payload)) return;
          if (ev === "duel_pick" && !(payload && payload.from && payload.from === payload.holderId)) return;
          cb(msg);
        });
        return ch;
      },
      presenceState: () => rawCh.presenceState(),
      subscribe: (cb) => rawCh.subscribe(cb),
      track: (state) => rawCh.track(state),
      send: (msg) => rawCh.send({ ...msg, payload: { ...(msg.payload || {}), from: S.me && S.me.id } }),
      raw: rawCh
    };
    S.channel = ch;
    ch.on("broadcast", { event: "move" }, ({ payload }) => {
      if (!payload || payload.id === S.me.id) return;
      const p = S.players.get(payload.id);
      if (p) { p.tx = payload.x; p.ty = payload.y; p.dir = payload.dir; p.moving = payload.moving; p.name = payload.name; p.avatar = payload.avatar; p.color = payload.color; p.look = payload.look || p.look; p.zone = payload.zone; }
      else S.players.set(payload.id, { id: payload.id, name: payload.name, avatar: payload.avatar, color: payload.color, look: payload.look, x: payload.x, y: payload.y, tx: payload.x, ty: payload.y, dir: 1, moving: false, score: 0, zone: -1, host: false, isBot: false });
    });
    ch.on("broadcast", { event: "score" }, ({ payload }) => {
      if (!payload) return;
      const p = S.players.get(payload.id);
      if (p) { p.score = Math.max(0, Math.floor(Number(payload.score) || 0)); if (payload.look) p.look = payload.look; if (payload.dead != null) p.dead = !!payload.dead; }
      else S.players.set(payload.id, { id: payload.id, name: payload.name || "?", avatar: payload.avatar || "🦊", color: payload.color || "#888", look: payload.look, x: 800, y: 700, tx: 800, ty: 700, dir: 1, moving: false, score: payload.score || 0, zone: -1, dead: !!payload.dead, host: false });
      refreshHud(); renderBoard();
    });
    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      if (!payload || !payload.txt) return;
      sayBubble(payload.id, payload.name, payload.txt);
    });
    ch.on("broadcast", { event: "quiz_start" }, ({ payload }) => {
      if (payload) {
        if (Array.isArray(payload.questions) && payload.questions.length) { QUESTIONS = payload.questions; EDU_QIDS = payload.qids || []; EDU_ANSWERS = {}; }
        if (payload.quiz) EDU_QUIZ = payload.quiz;
        if (MODE_OK(payload.mode)) { S.mode = payload.mode; }
        if (payload.rules) S.rules = { survival: !!payload.rules.survival, team: !!payload.rules.team, rounds: !!payload.rules.rounds };
        resetDead();
        renderRoom(); refreshHud();
        quizCountdown();
      }
    });
    ch.on("broadcast", { event: "rules" }, ({ payload }) => {
      if (payload && payload.rules && !S.isHost) {
        S.rules = { survival: !!payload.rules.survival, team: !!payload.rules.team, rounds: !!payload.rules.rounds };
        toast("Aturan ZEP: " + ruleText(S.rules));
        renderRoom();
      }
    });
    ch.on("broadcast", { event: "mode" }, ({ payload }) => {
      if (payload && MODE_OK(payload.mode)) {
        S.mode = payload.mode;
        toast("Mode: " + MODE_LABEL[S.mode]);
        renderRoom(); refreshHud();
      }
    });
    ch.on("broadcast", { event: "quiz_q" }, ({ payload }) => {
      if (!payload) return;
      if (Array.isArray(payload.questions) && payload.questions.length) {
        QUESTIONS = payload.questions;
        if (payload.quiz) EDU_QUIZ = payload.quiz;
        if (Array.isArray(payload.qids)) EDU_QIDS = payload.qids;
        EDU_ANSWERS = {};
      }
      showQuestion(payload.index, payload.endsAt);
    });
    ch.on("broadcast", { event: "quiz_reveal" }, ({ payload }) => {
      if (payload) doReveal(payload.index, payload.correct);
    });
    ch.on("broadcast", { event: "quiz_end" }, () => { endQuiz(); });
    // ---- mode kejar kelinci ----
    ch.on("broadcast", { event: "quiz_chase" }, ({ payload }) => {
      if (!payload) return;
      if (Array.isArray(payload.questions) && payload.questions.length) {
        QUESTIONS = payload.questions;
        if (payload.quiz) EDU_QUIZ = payload.quiz;
        if (Array.isArray(payload.qids)) EDU_QIDS = payload.qids;
        EDU_ANSWERS = {};
      }
      if (payload.mode) S.mode = payload.mode;
      onChase(payload.index, payload.bx, payload.by);
    });
    ch.on("broadcast", { event: "bun_move" }, ({ payload }) => {
      if (!payload || (S.isHost || S.solo)) return;
      S.bunny.tx = payload.x; S.bunny.ty = payload.y; S.bunny.dir = payload.dir || 1;
      S.bunny.active = true;
    });
    ch.on("broadcast", { event: "bunny_claim" }, ({ payload }) => {
      if (!payload || !(S.isHost || S.solo)) return;
      onClaim(payload);
    });
    ch.on("broadcast", { event: "chase_lock" }, ({ payload }) => {
      if (!payload) return;
      onChaseLock(payload.index, payload.holderId, payload.holderName, payload.duelEndsAt);
    });
    ch.on("broadcast", { event: "chase_release" }, ({ payload }) => {
      if (!payload) return;
      onChaseRelease(payload.index, payload.bx, payload.by, payload.reason);
    });
    ch.on("broadcast", { event: "duel_pick" }, ({ payload }) => {
      if (!payload || !(S.isHost || S.solo)) return;
      onDuelPick(payload);
    });
    ch.on("broadcast", { event: "duel_result" }, ({ payload }) => {
      if (!payload) return;
      onDuelResult(payload);
    });
    // ---- mode balapan ----
    ch.on("broadcast", { event: "race_start" }, ({ payload }) => {
      if (!payload) return;
      if (Array.isArray(payload.full) && payload.full.length) {
        QUESTIONS = payload.full;
        if (payload.quiz) EDU_QUIZ = payload.quiz;
        if (Array.isArray(payload.qids)) EDU_QIDS = payload.qids;
        EDU_ANSWERS = {};
      }
      if (payload.mode) S.mode = payload.mode;
      onRaceStart(payload);
    });
    ch.on("broadcast", { event: "race_prog" }, ({ payload }) => {
      if (!payload || !S.race) return;
      const prev = Number(S.race.prog[payload.id]) || 0;
      const opened = Math.min(S.race.K, Math.max(prev, Math.floor(Number(payload.opened) || 0)));
      S.race.prog[payload.id] = opened;
      const p = S.players.get(payload.id);
      if (p) { p.score = Math.max(0, Math.floor(Number(payload.score) || 0)); p.raceOpened = opened; }
      refreshHud(); renderBoard();
    });
    ch.on("broadcast", { event: "race_finish" }, ({ payload }) => {
      if (!payload || !S.race) return;
      if (!(S.isHost || S.solo)) return;
      const R = S.race;
      if ((Number(R.prog[payload.id]) || 0) < R.K) return; // belum membuka semua gembok
      if (!R.finished.some((f) => f.id === payload.id)) {
        R.finished.push({ id: payload.id, name: payload.name, at: payload.at });
        toast(`🏁 ${payload.name} finis!`);
        sfx("reveal");
        raceMaybeEnd();
      }
    });
    ch.on("broadcast", { event: "race_end" }, ({ payload }) => {
      if (!payload) return;
      onRaceEnd(payload);
    });
    ch.on("broadcast", { event: "race_hello" }, ({ payload }) => {
      if (!payload || !(S.isHost || S.solo) || !S.race) return;
      const R = S.race;
      if (R.lanes[payload.id] == null) { // pemain telat: beri lajur sendiri
        R.lanes[payload.id] = Object.keys(R.lanes).length;
        R.prog[payload.id] = 0;
        R.dist[payload.id] = 0;
      }
      send("race_state", { to: payload.id, snap: raceSnapshot() });
    });
    ch.on("broadcast", { event: "race_state" }, ({ payload }) => {
      if (!payload || !S.me || payload.to !== S.me.id) return;
      if (S.race && !S.race.idle) return; // sudah ikut balapan berjalan
      const s = payload.snap; if (!s) return;
      if (Array.isArray(s.full) && s.full.length) {
        QUESTIONS = s.full;
        if (s.quiz) EDU_QUIZ = s.quiz;
        if (Array.isArray(s.qids)) EDU_QIDS = s.qids;
        EDU_ANSWERS = {};
      }
      S.mode = "race";
      onRaceStart({ lanes: s.lanes, K: s.K, endsAt: s.endsAt, late: true });
      (s.prog ? Object.entries(s.prog) : []).forEach(([pid, opened]) => {
        S.race.prog[pid] = opened;
        const p = S.players.get(pid);
        if (p) p.raceOpened = opened;
      });
      (s.dist ? Object.entries(s.dist) : []).forEach(([pid, d]) => {
        S.race.dist[pid] = d;
        const p = S.players.get(pid);
        if (p) raceSetPos(p, d, raceOffFor(S.race, pid));
      });
      (s.finished || []).forEach((f) => { if (!S.race.finished.some((x) => x.id === f.id)) S.race.finished.push(f); });
      refreshHud(); renderBoard();
    });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState();
      const seen = new Set();
      Object.values(st).flat().forEach((m) => {
        if (!m || !m.id) return; seen.add(m.id);
        const ex = S.players.get(m.id);
        if (m.host && MODE_OK(m.mode) && m.mode !== S.mode && m.id !== S.me.id) {
          S.mode = m.mode; toast("Mode: " + MODE_LABEL[S.mode]); syncModeUI();
        }
        if (m.host && m.rules && m.id !== S.me.id) {
          S.rules = { survival: !!m.rules.survival, team: !!m.rules.team, rounds: !!m.rules.rounds };
          syncRulesUI();
        }
        if (ex) { ex.name = m.name; ex.avatar = m.avatar; ex.color = m.color; ex.look = m.look || ex.look; ex.host = !!m.host; ex.score = m.score || ex.score || 0; if (m.dead != null) ex.dead = !!m.dead; }
        else if (m.id !== S.me.id) S.players.set(m.id, { id: m.id, name: m.name, avatar: m.avatar, color: m.color, look: m.look, x: m.x, y: m.y, tx: m.x, ty: m.y, dir: 1, moving: false, score: m.score || 0, zone: -1, host: !!m.host, dead: !!m.dead, isBot: false });
      });
      [...S.players.keys()].forEach((k) => { const p = S.players.get(k); if (k !== S.me.id && !p.isBot && !seen.has(k)) S.players.delete(k); });
      const ids = [...S.players.values()];
      if (!ids.some((p) => p.host)) {
        const oldest = [...seen].sort()[0];
        if (oldest === S.me.id) { S.isHost = true; S.me.host = true; track(); renderRoom(); toggleHostUI(); }
      } else {
        const mine = S.players.get(S.me.id);
        if (mine) { S.isHost = !!mine.host; toggleHostUI(); }
      }
      renderRoom(); refreshHud(); renderBoard();
      // balapan belum mulai: segarkan staging agar pemain baru dapat lajur
      if (S.mode === "race" && S.me && !screens.game.classList.contains("hidden") && (!S.race || S.race.idle)) ensureRaceIdle();
    });
    ch.on("presence", { event: "join" }, ({ newPresences }) => {
      (newPresences || []).forEach((m) => { if (m && m.name) { toast(m.name + " masuk! 🌟"); sfx("join"); } });
    });

    let firstJoin = true;
    await ch.subscribe(async (status) => {
      if (S.channel !== ch) return; // channel lama yang sudah ditinggalkan
      if (status === "SUBSCRIBED") {
        await track();
        if (firstJoin) { firstJoin = false; show("room"); }
        renderRoom(); toggleHostUI();
      } else if (status === "CLOSED" || status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
        err("Gagal konek realtime. Coba lagi.");
      }
    });
  }

  async function track() {
    if (!S.channel || !S.me) return;
    try {
      await S.channel.track({ id: S.me.id, name: S.me.name, avatar: S.me.avatar, color: S.me.color, look: S.me.look || S.meLook, x: Math.round(S.me.x), y: Math.round(S.me.y), host: S.isHost, score: S.me.score, dead: !!S.me.dead, mode: S.isHost ? S.mode : undefined, rules: S.isHost ? { ...S.rules } : undefined });
    } catch (_) {}
  }
  const send = (event, payload) => {
    if (!S.solo && S.channel) { try { S.channel.send({ type: "broadcast", event, payload }); } catch (_) {} }
  };
  // Pesan kontrol hanya diterima dari pemain yang tercatat sebagai host di presence.
  const fromHost = (payload) => {
    if (!payload || !payload.from || !S.me || payload.from === S.me.id) return false;
    const p = S.players.get(payload.from);
    return !!(p && p.host && !p.isBot);
  };
  // Pemain hanya boleh melaporkan data miliknya sendiri.
  const fromSelf = (payload) => !!(payload && payload.id && payload.from === payload.id);

  /* ================= lobby wiring ================= */
  const playerName = () => $("in-name").value.trim();
  function setPressed(el, on) { el.setAttribute("aria-pressed", on ? "true" : "false"); }
  document.querySelectorAll("#mode-pick button").forEach((b) => b.addEventListener("click", () => {
    sfx("click"); S.wantMode = b.dataset.mode || "zones";
    document.querySelectorAll("#mode-pick button").forEach((x) => { x.classList.toggle("sel", x === b); setPressed(x, x === b); });
    syncRulesUI();
  }));
  document.querySelectorAll("#host-mode-pick button").forEach((b) => b.addEventListener("click", () => {
    if (!S.isHost) return;
    sfx("click"); S.mode = b.dataset.hmode || "zones";
    send("mode", { mode: S.mode });
    renderRoom(); refreshHud();
  }));
  document.querySelectorAll("#rules-pick button").forEach((b) => b.addEventListener("click", () => {
    if (isRaceMode()) { toast("Balapan tidak memakai aturan ZEP."); return; }
    sfx("click"); const k = b.dataset.rule; S.wantRules[k] = !S.wantRules[k]; syncRulesUI();
  }));
  document.querySelectorAll("#host-rules-pick button").forEach((b) => b.addEventListener("click", () => {
    if (!S.isHost) return;
    if (isRaceMode()) { toast("Balapan tidak memakai aturan ZEP."); return; }
    sfx("click"); const k = b.dataset.hrule; S.rules[k] = !S.rules[k];
    send("rules", { rules: { ...S.rules } });
    track(); renderRoom(); syncRulesUI();
  }));
  $("btn-create").onclick = () => joinRoom(randCode(), playerName(), true);
  $("btn-join").onclick = () => joinRoom($("in-code").value, playerName(), false);
  $("btn-solo").onclick = () => startSolo(playerName());
  $("btn-copy").onclick = async () => { try { await navigator.clipboard.writeText(S.room); toast("Kode disalin! 📋"); } catch (_) {} };
  $("btn-leave").onclick = leaveAll;
  $("btn-claim-host").onclick = async () => {
    const ids = [...S.players.values()];
    if (ids.some((p) => p.host)) { toast("Sudah ada host."); return; }
    S.isHost = true; S.me.host = true;
    const p = S.players.get(S.me.id); if (p) p.host = true;
    await track(); renderRoom(); toggleHostUI();
  };
  $("btn-board").onclick = () => { renderBoard(); $("board").classList.toggle("hidden"); };
  $("btn-board-close").onclick = () => $("board").classList.add("hidden");
  $("btn-host-panel").onclick = () => $("host-panel").classList.toggle("hidden");
  $("btn-host-close").onclick = () => $("host-panel").classList.add("hidden");
  $("btn-help").onclick = () => $("help-panel").classList.toggle("hidden");
  $("btn-help-close").onclick = () => $("help-panel").classList.add("hidden");
  $("btn-quit").onclick = leaveAll;
  $("btn-continue").onclick = () => $("podium").classList.add("hidden");

  async function leaveAll() {
    const oldCh = S.channel;
    S.channel = null;
    try { if (oldCh) await sbClient().removeChannel(oldCh.raw); } catch (_) {}
    if (S.race) { try { clearInterval(S.race.timerInt); } catch (_) {} }
    clearTimeout(countDoneT);
    S.room = null; S.me = null; S.isHost = false; S.solo = false;
    S.players.clear(); S.bubbles.clear(); stopQuizLocal(); S.streak = 0;
    S.bunny.active = false; S.race = null; S.raceResults = null; S.mode = S.wantMode;
    S.rules = { survival: false, team: false, rounds: false };
    S.ghostT = 0; S.zoneN = 4;
    if (typeof restoreWorld === "function") { try { restoreWorld(); } catch (_) {} }
    clearInterval(countInt); clearTimeout(S.quizNextT);
    const scEl = $("start-count"); if (scEl) { scEl.classList.add("hidden"); scEl.textContent = ""; }
    const gtEl = $("ghost-timer"); if (gtEl) gtEl.classList.add("hidden");
    $("q-banner").classList.add("hidden");
    $("duel").classList.add("hidden");
    const rqL = $("raceq"); if (rqL) rqL.classList.add("hidden");
    const podH = document.querySelector("#podium h3"); if (podH) podH.textContent = "🎉 Hasil Akhir";
    $("podium").classList.add("hidden");
    $("host-panel").classList.add("hidden");
    $("help-panel").classList.add("hidden");
    $("board").classList.add("hidden");
    $("btn-host-panel").classList.add("hidden");
    const ss = $("btn-solo-start"); if (ss) ss.remove();
    show("lobby");
  }

  function toggleHostUI() {
    const h = S.isHost || S.solo;
    $("btn-host-panel").classList.toggle("hidden", !h);
    syncModeUI(); syncRulesUI();
  }
  const isRaceMode = () => (S.room ? S.mode : S.wantMode) === "race";
  function syncRulesUI() {
    if (S.solo) { S.rules = { ...S.wantRules }; }
    const raceOff = isRaceMode();
    document.querySelectorAll("#rules-pick button").forEach((x) => { const on = !!S.wantRules[x.dataset.rule]; x.classList.toggle("sel", on); setPressed(x, on); });
    document.querySelectorAll("#host-rules-pick button").forEach((x) => { const on = !!S.rules[x.dataset.hrule]; x.classList.toggle("sel", on); setPressed(x, on); });
    const lp = $("rules-pick"); if (lp) lp.classList.toggle("off", raceOff);
    const hp2 = $("host-rules-pick"); if (hp2) hp2.classList.toggle("off", raceOff);
    const rl = $("room-rules-label");
    if (rl) rl.textContent = raceOff ? "Aturan ZEP: Balapan tidak memakai aturan ini." : "Aturan ZEP: " + ruleText(S.rules) + (S.isHost ? " (host bisa ganti di bawah)" : "");
    const hp = $("host-rules-pick"); if (hp) hp.classList.toggle("hidden", !S.isHost);
  }
  function syncModeUI() {
    const rl = $("room-mode-label");
    if (rl) rl.textContent = "Mode: " + MODE_LABEL[S.mode] + (S.isHost ? " (host bisa ganti di bawah)" : "");
    document.querySelectorAll("#host-mode-pick button").forEach((x) => { const on = (x.dataset.hmode || "zones") === S.mode; x.classList.toggle("sel", on); setPressed(x, on); });
    const hp = $("host-mode-pick"); if (hp) hp.classList.toggle("hidden", !S.isHost);
    const hm = $("hud-mode"); if (hm) hm.textContent = MODE_SHORT[S.mode] || MODE_SHORT.zones;
  }

  /* ================= room render ================= */
  function renderRoom() {
    $("room-code").textContent = S.room || "------";
    syncModeUI(); syncRulesUI();
    const list = [...S.players.values()];
    $("player-count").textContent = list.length;
    const ul = $("player-list"); ul.innerHTML = "";
    list.sort((a, b) => (b.host - a.host) || String(a.name || "").localeCompare(String(b.name || ""))).forEach((p) => {
      const li = document.createElement("li");
      li.innerHTML = `<span style="font-size:22px">${escapeHtml(p.avatar || "🦊")}</span><span>${escapeHtml(p.name || "?")}${p.id === (S.me && S.me.id) ? " (kamu)" : ""}</span>${p.host ? '<span class="hosttag">👑 HOST</span>' : ""}<span style="margin-left:auto">⭐ ${Number(p.score) || 0}</span>`;
      ul.appendChild(li);
    });
    $("btn-start-quiz").classList.toggle("hidden", !S.isHost);
    const anyHost = list.some((p) => p.host);
    $("btn-claim-host").classList.toggle("hidden", S.isHost || anyHost);
  }

  // Kamera: selalu snap ke pemain saat masuk arena
  function snapCamToMe() {
    if (!S.me) return;
    S.cam.x = clampCamX(S.me.x, WORLD.w);
    S.cam.y = clampCamY(S.me.y, WORLD.h);
  }
  function snapCamIdle() {
    if (!S.me) return;
    S.cam.x = clampCamX(S.me.x, WORLD.w);
    S.cam.y = clampCamY(S.me.y, WORLD.h);
  }
  $("btn-enter").onclick = () => {
    sfx("go"); show("game"); resizeCanvas(); toggleHostUI();
    if (S.mode === "race") {
      ensureRaceIdle();
      snapCamToMe();
      toast("🏁 Kamu di garis start — tunggu host mulai!");
    } else {
      snapCamIdle();
      toast(S.mode === "chase" ? "Kejar 🐇 kelinci untuk dapat soal!" : "Berdiri di zona A/B/C/D untuk menjawab!");
    }
  };
  $("btn-start-quiz").onclick = hostStartQuiz;
  $("btn-host-start").onclick = hostStartQuiz;
  $("btn-host-next").onclick = () => {
    if (!(S.isHost || S.solo)) return;
    sfx("click");
    if (S.mode === "race") { toast("🏁 Balapan berakhir saat semua finis / waktu habis."); return; }
    if (!S.quiz) return;
    if (S.mode === "chase") { nextQuestion(S.quiz.qIndex + 1); }
    else if (S.quiz.phase === "answer") hostReveal(S.quiz.qIndex);
  };
  $("raceq-close").onclick = () => {
    const R = S.race; if (!R || !R.popupOpen || !S.me) return;
    const gi = R.popupGi;
    closeRacePopup();
    R.dist[S.me.id] = Math.max(0, raceGeom(R.K).gateD[gi] - 120); // mundur agar popup tidak langsung terbuka lagi
  };
  $("btn-host-end").onclick = () => { if (S.isHost || S.solo) { send("quiz_end", { at: Date.now() }); endQuiz(); } };
  $("btn-again").onclick = () => { if (S.isHost || S.solo) hostStartQuiz(); };

  /* ================= solo bots ================= */
  function startSolo(name) {
    if (!name) { err("Isi nama dulu ya."); return; }
    err(""); sfx("join");
    S.solo = true; S.room = "SOLO"; S.isHost = true; S.streak = 0; S.mode = S.wantMode;
    S.rules = { ...S.wantRules };
    const id = uid();
    S.me = { id, name, avatar: S.meAvatar, color: S.meColor, look: S.meLook, x: 1100, y: 1180, tx: 1100, ty: 1180, dir: 1, moving: false, score: 0, zone: -1, host: true };
    S.players.clear();
    S.players.set(id, { ...S.me, isBot: false });
    const botDefs = [["Budi", "🐼", "#4f7cff"], ["Siti", "🐰", "#ec4899"], ["Agus", "🤖", "#22c55e"]];
    botDefs.forEach(([n, av, c], i) => {
      const [x, y] = spawnFor(i + 1);
      const look = ECAVATAR.norm({ skin: ECAVATAR.SKINS[(i + 1) % ECAVATAR.SKINS.length], hair: ECAVATAR.HAIR[(i + 2) % ECAVATAR.HAIR.length], hairColor: ECAVATAR.HAIRCOLORS[(i + 1) % ECAVATAR.HAIRCOLORS.length], outfit: ECAVATAR.OUTFIT[i % ECAVATAR.OUTFIT.length], outfitColor: c, pants: ECAVATAR.DEFAULT.pants, acc: ECAVATAR.ACC[(i + 1) % ECAVATAR.ACC.length], eyes: ECAVATAR.EYES[i % ECAVATAR.EYES.length] });
      S.players.set("bot-" + i, { id: "bot-" + i, name: n + " (bot)", avatar: ECAVATAR.emoji(look), color: c, look, x, y, tx: x, ty: y, dir: 1, moving: false, score: 0, zone: -1, host: false, isBot: true, wt: 0, wx: x, wy: y, pick: -1, botStreak: 0, botOx: (Math.random() * 70 - 35), botOy: (Math.random() * 70 - 35) });
    });
    assignTeams(); resetDead();
    show("game"); resizeCanvas(); toggleHostUI();
    if (S.mode === "race") { ensureRaceIdle(); snapCamToMe(); }
    else snapCamIdle();
    const soloBase = S.mode === "chase" ? "🐇 Latihan kejar kelinci: sentuh kelinci lalu jawab!" : S.mode === "race" ? "🏁 Latihan balapan: lari kanan, buka semua gembok!" : "Tekan ▶ Mulai Kuis untuk mulai!";
    const soloRt = ruleText(S.rules);
    toast(soloBase + (soloRt !== "—" ? " · Aturan: " + soloRt : ""));
    ensureSoloStartBtn();
  }
  function ensureSoloStartBtn() {
    if ($("btn-solo-start")) return;
    const b = document.createElement("button");
    b.id = "btn-solo-start"; b.className = "btn secondary"; b.textContent = "▶ Mulai Kuis";
    b.style.cssText = "position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:5";
    b.onclick = () => hostStartQuiz();
    $("stage-wrap").appendChild(b);
  }

  /* ================= chat ================= */
  function sayBubble(pid, name, txt) {
    txt = String(txt || "").slice(0, 60);
    if (!txt) return;
    S.bubbles.set(pid, { txt, until: Date.now() + 4000 });
    const log = $("chat-log");
    const d = document.createElement("div");
    d.className = "chat-msg";
    d.textContent = name + ": " + txt;
    log.appendChild(d);
    while (log.children.length > 4) log.firstChild.remove();
    setTimeout(() => { try { d.remove(); } catch (_) {} }, 6000);
  }
  function sendChat(txt) {
    txt = String(txt || "").trim().slice(0, 60);
    if (!txt || !S.me) return;
    sayBubble(S.me.id, S.me.name, txt);
    send("chat", { id: S.me.id, name: S.me.name, txt });
  }
  $("btn-chat-toggle").onclick = () => {
    const f = $("chat-form");
    f.classList.toggle("hidden");
    if (!f.classList.contains("hidden")) $("chat-in").focus();
  };
  $("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    sendChat($("chat-in").value);
    $("chat-in").value = "";
    $("chat-form").classList.add("hidden");
    canvas.focus && canvas.focus();
  });

  /* ================= input ================= */
  window.addEventListener("keydown", (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    S.keys[e.key.toLowerCase()] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    if (e.key === "Enter" && S.me && !screens.game.classList.contains("hidden")) {
      $("chat-form").classList.remove("hidden");
      $("chat-in").focus();
    }
    if ((e.key.toLowerCase() === "q") && (S.isHost || S.solo) && S.me && !S.quiz && !screens.game.classList.contains("hidden")) hostStartQuiz(); // hanya saat belum ada kuis berjalan
  });
  window.addEventListener("keyup", (e) => { S.keys[e.key.toLowerCase()] = false; });

  const joy = $("joystick"), stick = $("stick");
  let joyActive = false;
  if (("ontouchstart" in window)) joy.classList.remove("hidden");
  joy.addEventListener("touchstart", (e) => { joyActive = true; e.preventDefault(); }, { passive: false });
  window.addEventListener("touchmove", (e) => {
    if (!joyActive) return;
    const t = e.touches[0]; const r = joy.getBoundingClientRect();
    S.joy.x = Math.max(-1, Math.min(1, (t.clientX - (r.left + r.width / 2)) / 40));
    S.joy.y = Math.max(-1, Math.min(1, (t.clientY - (r.top + r.height / 2)) / 40));
    stick.style.left = (32 + S.joy.x * 28) + "px"; stick.style.top = (32 + S.joy.y * 28) + "px";
  }, { passive: true });
  window.addEventListener("touchend", () => { joyActive = false; S.joy.x = 0; S.joy.y = 0; stick.style.left = "32px"; stick.style.top = "32px"; });

  function resizeCanvas() {
    const wrap = $("stage-wrap");
    const w = Math.max(320, Math.round(wrap.clientWidth || window.innerWidth || 960));
    const h = Math.max(240, Math.round(wrap.clientHeight || window.innerHeight || 600));
    DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    VIEW.w = w; VIEW.h = h;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 120));

  /* ================= loop ================= */
  let lastT = performance.now(), bcastT = 0, trackT = 0, lastTickSec = -1, bcastB = 0, quizBotT = 0, lastHello = 0, countInt = 0, countDoneT = 0, ghostSig = "";
  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (S.me && !screens.game.classList.contains("hidden")) step(dt, now);
    draw(now);
    requestAnimationFrame(loop);
  }

  function step(dt, now) {
    const me = S.me;
    if (S.mode === "race" && (!S.race || S.race.idle)) {
      // balapan belum mulai: tetap boleh jalan bebas di area tunggu,
      // sekalian minta snapshot kalau telat join
      if (!S.solo && S.channel && now - lastHello > 2000) {
        lastHello = now;
        try { S.channel.send({ type: "broadcast", event: "race_hello", payload: { id: me.id, name: me.name } }); } catch (_) {}
      }
    }
    else if (S.mode === "race" && S.race) { raceStep(dt, now); return; }
    let dx = 0, dy = 0;
    if (S.keys["w"] || S.keys["arrowup"]) dy -= 1;
    if (S.keys["s"] || S.keys["arrowdown"]) dy += 1;
    if (S.keys["a"] || S.keys["arrowleft"]) dx -= 1;
    if (S.keys["d"] || S.keys["arrowright"]) dx += 1;
    dx += S.joy.x; dy += S.joy.y;
    const len = Math.hypot(dx, dy);
    me.moving = len > 0.15;
    if (me.moving) {
      dx /= (len || 1); dy /= (len || 1);
      const sp = 260 * dt;
      const nx = me.x + dx * sp, ny = me.y + dy * sp;
      if (!collide(nx, me.y)) me.x = nx;
      if (!collide(me.x, ny)) me.y = ny;
      if (Math.abs(dx) > 0.2) me.dir = dx > 0 ? 1 : -1;
      me.x = Math.max(24, Math.min(WORLD.w - 24, me.x));
      me.y = Math.max(30, Math.min(WORLD.h - 20, me.y));
    }
    // zona jawab (mode zones: berdiri = menjawab)
    const qz = S.quiz;
    const chaseQ = qz && S.mode === "chase" && qz.phase === "chase";
    if (qz && S.mode === "zones" && qz.phase === "answer" && S.rules.survival && me.dead) {
      me.zone = -1;
    } else if (qz && S.mode === "zones" && qz.phase === "answer") {
      const z = zoneAt(me.x, me.y);
      if (z !== me.zone) {
        me.zone = z;
        if (z >= 0) {
          qz.enterT = now;
          $("quiz-status").textContent = `Pilihanmu: ${ZONE_LETTERS[z]} — tetap di sini sampai waktu habis!`;
          $("quiz-status").style.color = "#1d4ed8";
          sfx("click");
        } else {
          $("quiz-status").textContent = "";
        }
      }
    }
    // ---- simulasi kelinci: kabur dari pemain terdekat (hanya host/solo, bukan balapan) ----
    if (S.bunny.active && (S.isHost || S.solo) && S.mode !== "race") {
      let nx = -1, ny = -1, nd = 1e9;
      S.players.forEach((p) => {
        const d = Math.hypot(p.x - S.bunny.x, p.y - S.bunny.y);
        if (d < nd) { nd = d; nx = p.x; ny = p.y; }
      });
      S.bunny.wt -= dt;
      if (nd < 190 || S.bunny.wt <= 0) {
        // lari menjauh dari ancaman terdekat
        let ax = S.bunny.x - nx, ay = S.bunny.y - ny;
        const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
        const jx = (Math.random() - 0.5) * 1.2, jy = (Math.random() - 0.5) * 1.2;
        let gx = S.bunny.x + (ax + jx) * 260, gy = S.bunny.y + (ay + jy) * 260;
        gx = Math.max(80, Math.min(WORLD.w - 80, gx));
        gy = Math.max(140, Math.min(WORLD.h - 80, gy));
        if (!collide(gx, gy)) { S.bunny.wx = gx; S.bunny.wy = gy; }
        S.bunny.wt = 0.8 + Math.random() * 1.2;
      }
      const vx = S.bunny.wx - S.bunny.x, vy = S.bunny.wy - S.bunny.y, d = Math.hypot(vx, vy);
      if (d > 6) {
        const s = BUNNY_SPEED * dt;
        const px = S.bunny.x, py = S.bunny.y;
        const stepx = px + vx / d * s, stepy = py + vy / d * s;
        if (!collide(stepx, py)) S.bunny.x = stepx;
        if (!collide(S.bunny.x, stepy)) S.bunny.y = stepy;
        if (Math.abs(vx) > 4) S.bunny.dir = vx > 0 ? 1 : -1;
        S.bunny.hop += dt * 10;
      }
      // deteksi tangkapan oleh pemain lokal (hantu tidak bisa menangkap)
      if (chaseQ && !(S.rules.survival && me.dead) && Math.hypot(me.x - S.bunny.x, me.y - S.bunny.y) < CATCH_R) {
        claimAsMe();
      }
      // bot solo ikut mengejar kelinci
      if (S.solo && chaseQ && S.quiz && S.quiz.phase === "chase") {
        S.players.forEach((p) => {
          if (!p.isBot) return;
          if (S.rules.survival && p.dead) { p.moving = false; p.tx = p.x; p.ty = p.y; return; }
          if ((p.chaseDelay || 0) > 0) { p.chaseDelay -= dt; p.moving = false; p.tx = p.x; p.ty = p.y; return; }
          const vx2 = S.bunny.x + (p.botOx || 0) - p.x, vy2 = S.bunny.y + (p.botOy || 0) - p.y;
          const d2 = Math.hypot(vx2, vy2);
          p.moving = d2 > 10;
          if (p.moving) {
            const s2 = Math.min(200, BUNNY_SPEED - 45) * dt;
            const nx2 = p.x + vx2 / (d2 || 1) * s2, ny2 = p.y + vy2 / (d2 || 1) * s2;
            if (!collide(nx2, p.y)) p.x = nx2;
            if (!collide(p.x, ny2)) p.y = ny2;
            if (Math.abs(vx2) > 4) p.dir = vx2 > 0 ? 1 : -1;
          }
          p.tx = p.x; p.ty = p.y;
          if (d2 < CATCH_R && S.quiz && S.quiz.phase === "chase") {
            const qi = S.quiz.qIndex;
            lockChase(qi, { id: p.id, name: p.name });
            const Q = QUESTIONS[qi];
            const correct = Q && typeof Q.answer === "number" ? Q.answer : 0;
            setTimeout(() => {
              if (S.quiz && S.quiz.phase === "duel" && S.quiz.qIndex === qi) resolveDuel(qi, Math.random() < 0.5 ? correct : (correct + 1) % Math.max(1, Q.opts.length), p.id, false);
            }, 1800);
          }
        });
      }
      // siarkan posisi kelinci 10x/detik
      if (!S.solo && S.channel && now - bcastB > 100) {
        bcastB = now;
        try { S.channel.send({ type: "broadcast", event: "bun_move", payload: { x: Math.round(S.bunny.x), y: Math.round(S.bunny.y), dir: S.bunny.dir } }); } catch (_) {}
      }
    } else if (chaseQ && !S.bunny.active && S.solo) {
      // jaga-jaga: kelinci harus aktif saat fase chase solo
      S.bunny.active = true;
    }
  // non-host: interpolasi posisi kelinci dari host
    if (S.bunny.active && S.mode !== "race" && !(S.isHost || S.solo) && S.bunny.tx != null) {
      S.bunny.x += (S.bunny.tx - S.bunny.x) * Math.min(1, dt * 12);
      S.bunny.y += (S.bunny.ty - S.bunny.y) * Math.min(1, dt * 12);
      S.bunny.hop += dt * 10;
      // deteksi tangkapan lokal (optimis, host yang mengesahkan)
      if (chaseQ && !(S.rules.survival && me.dead) && Math.hypot(me.x - S.bunny.x, me.y - S.bunny.y) < CATCH_R) claimAsMe();
    }
    // kamera ngikutin
    S.cam.x = clampCamX(me.x, WORLD.w);
    S.cam.y = clampCamY(me.y, WORLD.h);

    const rec = S.players.get(me.id);
    if (rec) Object.assign(rec, { x: me.x, y: me.y, dir: me.dir, moving: me.moving, score: me.score, zone: me.zone });
    refreshHudGate();

    // bots umum: skip saat balapan (digerakkan raceBots) & saat chase
    const chaseActive = S.quiz && S.mode === "chase" && (S.quiz.phase === "chase" || S.quiz.phase === "duel");
    const raceActive = S.mode === "race" && !!S.race;
    if (!raceActive) S.players.forEach((p) => {
      if (!p.isBot) return;
      if (S.mode === "chase" && (S.quiz && (S.quiz.phase === "chase" || S.quiz.phase === "duel"))) { p.tx = p.x; p.ty = p.y; return; } // sudah digerakkan blok kelinci
      if (S.rules.survival && p.dead) { p.moving = false; p.tx = p.x; p.ty = p.y; return; } // hantu: diam
      if (qz && qz.phase === "answer" && p.pick >= 0) {
        const z = ZONES[p.pick];
        const gx = z.x + z.w / 2, gy = z.y + z.h / 2;
        const vx = gx - p.x, vy = gy - p.y, d = Math.hypot(vx, vy);
        p.moving = d > 12;
        if (p.moving) {
          const s = 200 * dt;
          const nx = p.x + vx / d * s, ny = p.y + vy / d * s;
          if (!collide(nx, p.y)) p.x = nx;
          if (!collide(p.x, ny)) p.y = ny;
          if (Math.abs(vx) > 4) p.dir = vx > 0 ? 1 : -1;
        }
        p.zone = zoneAt(p.x, p.y);
      } else {
        p.wt -= dt;
        if (p.wt <= 0) { p.wt = 1.5 + Math.random() * 2.5; p.wx = 120 + Math.random() * (WORLD.w - 240); p.wy = 200 + Math.random() * (WORLD.h - 320); }
        const vx = p.wx - p.x, vy = p.wy - p.y, d = Math.hypot(vx, vy);
        p.moving = d > 10;
        if (p.moving) {
          const s = 130 * dt;
          const nx = p.x + vx / d * s, ny = p.y + vy / d * s;
          if (!collide(nx, p.y)) p.x = nx;
          if (!collide(p.x, ny)) p.y = ny;
          if (Math.abs(vx) > 4) p.dir = vx > 0 ? 1 : -1;
        }
      }
      p.tx = p.x; p.ty = p.y;
    });

    // interpolasi remote
    S.players.forEach((p) => {
      if (p.id === me.id || p.isBot) return;
      p.x += (p.tx - p.x) * Math.min(1, dt * 10);
      p.y += (p.ty - p.y) * Math.min(1, dt * 10);
    });

    // timer kuis + bunyi detik terakhir
    if (qz && qz.phase === "answer") {
      const left = Math.ceil((qz.endsAt - Date.now()) / 1000);
      $("quiz-timer").textContent = Math.max(0, left);
      $("quiz-timer").classList.toggle("low", left <= 5);
      if (left <= 5 && left > 0 && left !== lastTickSec) { lastTickSec = left; sfx("tick"); }
    }

    if (!S.solo && S.channel && now - bcastT > 100 && (me.moving || (qz && qz.phase === "answer"))) {
      bcastT = now;
      S.channel.send({ type: "broadcast", event: "move", payload: { id: me.id, name: me.name, avatar: me.avatar, color: me.color, look: me.look, x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, moving: me.moving, zone: me.zone } });
    }
    if (!S.solo && S.channel && now - trackT > 5000) { trackT = now; track(); }
  }

  /* ================= draw ================= */
  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);
    ctx.translate(-Math.round(S.cam.x), -Math.round(S.cam.y));
    if (S.mode === "race" && S.race) {
      drawRaceScene(now);
      const arr = [...S.players.values()].sort((a, b) => a.y - b.y);
      arr.forEach((p) => drawPlayer(p, now));
      ctx.restore();
      return;
    }

    // mode 🐇 Kelinci punya map sendiri (padang + sarang + wortel)
    if (S.mode === "chase") {
      drawChaseWorld(now);
      if (S.bunny.active) drawBunny(now);
      const arr = [...S.players.values()].sort((a, b) => a.y - b.y);
      arr.forEach((p) => drawPlayer(p, now));
      ctx.restore();
      return;
    }

    // rumput ZEP: base hijau + bercak cahaya + bayangan + rumput liar
    {
      const gg = ctx.createLinearGradient(0, S.cam.y - 40, 0, S.cam.y + VIEW.h + 40);
      gg.addColorStop(0, ZP.grass1); gg.addColorStop(1, ZP.grass2);
      ctx.fillStyle = gg; ctx.fillRect(S.cam.x - 40, S.cam.y - 40, VIEW.w + 80, VIEW.h + 80);
    }
    ctx.fillStyle = "rgba(255,255,255,.07)";
    PATCHES.forEach(([x, y, r]) => { if (visIn(x - r, y - r, r * 2, r * 2)) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, 7); ctx.fill(); } });
    ctx.fillStyle = "rgba(70,140,60,.10)";
    PATCHES.forEach(([x, y, r]) => { const yy = y + r * 0.75; if (visIn(x - r, yy - r, r * 2, r * 2)) { ctx.beginPath(); ctx.ellipse(x + r * 0.4, yy, r * 0.7, r * 0.4, 0, 0, 7); ctx.fill(); } });
    GRASS_TUFTS.forEach(([x, y]) => { if (visIn(x - 10, y - 12, 20, 16)) drawTuft(x, y); });

    // jalur tanah ZEP: tepi lembut + kerikil (polos, tanpa garis)
    const pathRects = [
      [CX - 420, CY + 320, 840, 110], [CX - 420, CY - 430, 840, 110],
      [CX - 470, CY - 430, 120, 860], [CX + 350, CY - 430, 120, 860],
    ];
    ctx.fillStyle = ZP.dirtEdge;
    pathRects.forEach(([x, y, w, h]) => { rr(x - 5, y - 5, w + 10, h + 10, 30); ctx.fill(); });
    ctx.fillStyle = ZP.dirt2;
    pathRects.forEach(([x, y, w, h]) => { rr(x, y, w, h, 26); ctx.fill(); });
    ctx.fillStyle = ZP.dirt1;
    pathRects.forEach(([x, y, w, h]) => { rr(x + 7, y + 7, w - 14, h - 14, 22); ctx.fill(); });
    ctx.fillStyle = "rgba(120,90,55,.22)";
    pathRects.forEach(([x, y, w, h]) => {
      if (!visIn(x, y, w, h)) return;
      for (let bx = x + 20; bx < x + w - 12; bx += 34) for (let by = y + 20; by < y + h - 12; by += 28) { ctx.beginPath(); ctx.ellipse(bx, by, 2.6, 1.8, 0, 0, 7); ctx.fill(); }
    });

    // pagar post-and-rail abu terang (ZEP) + tiang
    ctx.strokeStyle = ZP.fenceLine; ctx.lineWidth = 11; rr(9, 9, WORLD.w - 18, WORLD.h - 18, 20); ctx.stroke();
    ctx.strokeStyle = ZP.fence; ctx.lineWidth = 6; rr(9, 9, WORLD.w - 18, WORLD.h - 18, 20); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 3; rr(16, 16, WORLD.w - 32, WORLD.h - 32, 16); ctx.stroke();
    const fencePost = (px, py) => {
      ctx.fillStyle = ZP.fenceD; rr(px - 5, py - 24, 10, 32, 3); ctx.fill();
      ctx.fillStyle = ZP.fence; rr(px - 4, py - 24, 8, 32, 3); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.06)"; rr(px + 1, py - 24, 3, 32, 3); ctx.fill();
    };
    for (let x = 40; x < WORLD.w - 20; x += 96) {
      if (visIn(x - 6, 4, 12, 32)) fencePost(x, 28);
      if (visIn(x - 6, WORLD.h - 28, 12, 32)) fencePost(x, WORLD.h - 8);
    }
    for (let y = 60; y < WORLD.h - 40; y += 96) {
      if (visIn(4, y - 6, 32, 12)) fencePost(28, y);
      if (visIn(WORLD.w - 28, y - 6, 32, 12)) fencePost(WORLD.w - 8, y);
    }

    // plaza (lapangan berpaving lembut) + pola tegel
    ctx.fillStyle = "rgba(0,0,0,.06)"; rr(CX - 372, CY - 272 + 7, 744, 544, 36); ctx.fill();
    ctx.fillStyle = "#efe7d2"; rr(CX - 372, CY - 272, 744, 544, 36); ctx.fill();
    ctx.save(); rr(CX - 372, CY - 272, 744, 544, 36); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,.4)";
    for (let gy = CY - 272; gy < CY + 272; gy += 68) for (let gx = CX - 372; gx < CX + 372; gx += 68) if (((gx + gy) / 68) % 2 === 0) ctx.fillRect(gx, gy, 68, 68);
    ctx.strokeStyle = "rgba(150,120,75,.12)"; ctx.lineWidth = 2;
    for (let gx = CX - 372 + 68; gx < CX + 372; gx += 68) { ctx.beginPath(); ctx.moveTo(gx, CY - 272); ctx.lineTo(gx, CY + 272); ctx.stroke(); }
    for (let gy = CY - 272 + 68; gy < CY + 272; gy += 68) { ctx.beginPath(); ctx.moveTo(CX - 372, gy); ctx.lineTo(CX + 372, gy); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = "rgba(150,120,75,.3)"; ctx.lineWidth = 5; rr(CX - 372, CY - 272, 744, 544, 36); ctx.stroke();
    ctx.strokeStyle = "rgba(150,120,75,.16)"; ctx.lineWidth = 3; rr(CX - 352, CY - 252, 704, 504, 30); ctx.stroke();

    // panggung host (kayu lembut)
    ctx.fillStyle = "rgba(0,0,0,.12)"; rr(STAGE.x - 14, STAGE.y - 12, STAGE.w + 28, STAGE.h + 28, 18); ctx.fill();
    ctx.fillStyle = "#c98a3f"; rr(STAGE.x - 14, STAGE.y - 14, STAGE.w + 28, STAGE.h + 28, 16); ctx.fill();
    ctx.fillStyle = "#FFD629"; rr(STAGE.x, STAGE.y, STAGE.w, STAGE.h, 12); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.28)";
    for (let i = 0; i < 8; i++) rr(STAGE.x + 8 + i * (STAGE.w - 16) / 8, STAGE.y + 6, (STAGE.w - 16) / 8 - 8, STAGE.h - 12, 6), ctx.fill();
    ctx.fillStyle = "#7a4d00"; ctx.font = "800 20px 'Plus Jakarta Sans',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("PANGGUNG KUIS", CX, STAGE.y + 58);
    ctx.font = "30px sans-serif"; ctx.fillText("🏆", CX - 152, STAGE.y + 62); ctx.fillText("🏆", CX + 152, STAGE.y + 62);

    // 4 zona jawab (kusam saat bukan fase menjawab)
    ctx.textAlign = "center";
    const qz = S.quiz;
    const zonesMode = S.mode === "zones";
    const inAnswer = zonesMode && qz && (qz.phase === "answer" || qz.phase === "reveal");
    const Q = inAnswer && QUESTIONS[qz.qIndex] ? QUESTIONS[qz.qIndex] : null;
    const activeN = Math.max(2, Math.min(4, (Q && Array.isArray(Q.opts) && Q.opts.length) || 4));
    // alas arena + bingkai putus-putus + permata sudut warna zona
    ctx.fillStyle = "rgba(255,255,255,.16)"; rr(CX - 392, CY - 280, 784, 560, 44); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3; ctx.setLineDash([15, 13]);
    rr(CX - 392, CY - 280, 784, 560, 44); ctx.stroke(); ctx.setLineDash([]);
    [[CX - 392, CY - 280, 0], [CX + 392, CY - 280, 1], [CX - 392, CY + 280, 2], [CX + 392, CY + 280, 3]].forEach(([dx, dy, ci]) => {
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = ZONE_DARK[ci]; rr(-10, -10, 20, 20, 5); ctx.fill();
      ctx.fillStyle = ZONE_COLORS[ci]; rr(-7, -7, 14, 14, 4); ctx.fill();
      ctx.restore();
    });
    ZONES.forEach((z, i) => {
      const cx = z.x + z.w / 2;
      if (i >= activeN) {
        // zona nonaktif: soal ini punya lebih sedikit opsi
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "rgba(110,122,116,.22)"; rr(z.x, z.y, z.w, z.h, 26); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
        rr(z.x + 4, z.y + 4, z.w - 8, z.h - 8, 22); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = "900 44px 'Plus Jakarta Sans',sans-serif";
        ctx.fillText("—", cx, z.y + z.h / 2 + 14);
        ctx.globalAlpha = 1;
        return;
      }
      const fill = ZONE_COLORS[i], dark = ZONE_DARK[i];
      ctx.globalAlpha = inAnswer ? 1 : 0.5;
      // bayangan lembut + panel berwarna + tepi gelap
      ctx.fillStyle = "rgba(40,60,40,.18)"; rr(z.x + 3, z.y + 8, z.w, z.h, 26); ctx.fill();
      ctx.fillStyle = dark; rr(z.x, z.y, z.w, z.h, 26); ctx.fill();
      ctx.fillStyle = fill; rr(z.x + 4, z.y + 4, z.w - 8, z.h - 6, 22); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)"; rr(z.x + 10, z.y + 10, z.w - 20, z.h * 0.5, 18); ctx.fill();
      // garis diagonal halus
      ctx.save(); rr(z.x + 4, z.y + 4, z.w - 8, z.h - 6, 22); ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 10;
      for (let s = -z.h; s < z.w; s += 34) { ctx.beginPath(); ctx.moveTo(z.x + s, z.y + z.h); ctx.lineTo(z.x + s + z.h, z.y); ctx.stroke(); }
      ctx.restore();
      // bingkai dalam
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 3; rr(z.x + 8, z.y + 8, z.w - 16, z.h - 16, 19); ctx.stroke();
      // ikon zona (pojok kanan atas)
      ctx.font = "26px sans-serif"; ctx.fillText(ZONE_ICONS[i], z.x + z.w - 32, z.y + 42);
      // badge huruf bulat (gaya ZEP) + cincin warna
      ctx.fillStyle = dark; disc(cx, z.y + 62, 36);
      ctx.fillStyle = "#fff"; disc(cx, z.y + 58, 33);
      ctx.strokeStyle = fill; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, z.y + 58, 28, 0, 7); ctx.stroke();
      ctx.fillStyle = fill; ctx.font = "900 38px 'Plus Jakarta Sans',sans-serif";
      ctx.fillText(ZONE_LETTERS[i], cx, z.y + 72);
      // label opsi pada pil putih
      ctx.fillStyle = "rgba(255,255,255,.92)"; rr(z.x + 18, z.y + z.h - 84, z.w - 36, 66, 16); ctx.fill();
      ctx.fillStyle = "#2b2b2b"; ctx.font = "bold 19px 'Plus Jakarta Sans',sans-serif";
      const label = Q && Q.opts[i] ? String(Q.opts[i]).slice(0, 26) : (inAnswer ? "…" : "zona " + ZONE_LETTERS[i]);
      wrapText(label, cx, z.y + z.h - 54, z.w - 52, 23);
      ctx.globalAlpha = 1;
      // highlight jawaban benar saat reveal
      if (qz && qz.phase === "reveal" && qz.correct === i) {
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 8;
        rr(z.x - 4, z.y - 4, z.w + 8, z.h + 8, 30); ctx.stroke();
        ctx.fillStyle = "#fff"; disc(z.x + 36, z.y + 36, 23);
        ctx.font = "26px sans-serif"; ctx.fillText("✅", z.x + 36, z.y + 46);
      }
      if (qz && qz.phase === "reveal" && qz.correct !== i) { ctx.fillStyle = "rgba(18,18,18,.34)"; rr(z.x, z.y, z.w, z.h, 26); ctx.fill(); }
    });

    // gedung sekolah mengelilingi plaza
    drawBuilding(300, 250, 200, 120, "#FF5D8F", "KELAS");
    drawBuilding(1620, 260, 200, 120, "#43D0C4", "PERPUS");
    drawBuilding(320, 1160, 200, 120, "#8A63F6", "KANTIN");
    drawBuilding(1640, 1160, 200, 120, "#3998F4", "LAB");
    drawBuilding(840, 130, 260, 130, "#FFD629", "AULA");
    // lampu taman, bangku, balon
    [[CX - 520, CY - 300], [CX + 520, CY - 300], [CX - 520, CY + 300], [CX + 520, CY + 300]].forEach(([x, y]) => drawLamp(x, y));
    drawBench(CX - 160, CY + 478); drawBench(CX + 160, CY + 478);
    drawBench(CX - 370, CY - 470); drawBench(CX + 370, CY - 470);
    drawBalloons(CX - 470, CY - 300);
    drawBalloons(CX + 410, CY - 300);

    // bendera meriah + pot bunga + gerbang + pagar hidup
    drawBunting(560, 252, 848, 152, now / 700);
    drawBunting(1352, 152, 1640, 258, now / 700 + 1.4);
    drawBunting(940, 120, 1260, 120, now / 640 + 0.6);
    drawBunting(300, 372, 232, 470, now / 720 + 2.2);
    drawBunting(1900, 372, 1968, 470, now / 720 + 3.1);
    drawPlanter(CX - 372, CY - 272 + 34);
    drawPlanter(CX + 372, CY - 272 + 34);
    drawPlanter(CX - 372, CY + 272 - 66);
    drawPlanter(CX + 372, CY + 272 - 66);
    drawGate(CX, 1432);
    drawHedge(CX - 242, 1424, 250);
    drawHedge(CX + 242, 1424, 250);
    drawHedge(CX - 372 + 40, CY - 500, 250);
    drawHedge(CX + 372 - 40, CY - 500, 250);

    // kolam (ZEP): tepi pasir + air berlapis + riak
    ctx.fillStyle = "#cfe8a8"; ctx.beginPath(); ctx.ellipse(POND.x, POND.y, POND.r + 26, POND.r + 18, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ZP.waterD; ctx.beginPath(); ctx.ellipse(POND.x, POND.y, POND.r + 8, POND.r + 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ZP.water2; ctx.beginPath(); ctx.ellipse(POND.x, POND.y, POND.r, POND.r - 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ZP.water1; ctx.beginPath(); ctx.ellipse(POND.x - 4, POND.y - 6, POND.r - 16, POND.r - 20, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath(); ctx.ellipse(POND.x - 30, POND.y - 26, 30, 9, -0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(POND.x + 40, POND.y + 18, 20, 6, -0.4, 0, 7); ctx.fill();
    [[-46, -20], [26, -40], [54, 22]].forEach(([dx, dy]) => {
      ctx.fillStyle = ZP.leaf2; ctx.beginPath(); ctx.ellipse(POND.x + dx, POND.y + dy, 16, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = ZP.leaf1; ctx.beginPath(); ctx.ellipse(POND.x + dx - 2, POND.y + dy - 1, 12, 6, 0, 0, 7); ctx.fill();
    });
    // riak air beranimasi
    for (let i = 0; i < 3; i++) {
      const t = ((now / 1500) + i / 3) % 1;
      ctx.strokeStyle = "rgba(255,255,255," + (0.5 * (1 - t)) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(POND.x, POND.y, 24 + t * (POND.r - 34), 18 + t * (POND.r - 44), 0, 0, 7); ctx.stroke();
    }
    // tumbuhan tepi kolam (kuncup)
    [[-126, -18], [-108, 34], [116, -34], [136, 18], [10, 128]].forEach(([dx, dy]) => {
      const rx = POND.x + dx, ry = POND.y + dy;
      ctx.strokeStyle = "#3f9e46"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(rx, ry + 14); ctx.lineTo(rx - 2, ry - 22); ctx.stroke();
      ctx.fillStyle = "#8a5a3b"; rr(rx - 4, ry - 32, 8, 15, 4); ctx.fill();
      ctx.fillStyle = "#a06a3f"; rr(rx - 3, ry - 32, 4, 15, 3); ctx.fill();
    });
    ctx.font = "30px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🦆", POND.x + 6, POND.y - 4);
    ctx.fillStyle = "#5b564f"; ctx.font = "bold 13px 'Plus Jakarta Sans',sans-serif"; ctx.fillText("KOLAM", POND.x, POND.y + POND.r + 24);

    // taman & vegetasi (ZEP: campuran pohon)
    TREES.forEach(([x, y], i) => drawTree(x, y, i % 3));
    ROCKS.forEach(([x, y]) => drawRock(x, y));
    FLOWERS.forEach(([x, y], i) => drawFlower(x, y, ["#ff77a9", "#FFD629", "#ff9f68", "#8A63F6"][i % 4]));
    [[700, 1030], [1500, 1030], [700, 350], [1500, 350], [1080, 1180]].forEach(([x, y]) => drawBush(x, y));
    // tunggul kayu + papan petunjuk
    [[960, 1310], [1050, 1330], [1150, 1330], [1240, 1310], [1000, 1370], [1200, 1370]].forEach(([x, y]) => drawStump(x, y));
    drawSignpost(170, 620, 4); drawSignpost(2030, 620, 8); drawSignpost(700, 1430, 2);
    drawRock(1900, 1380, 1.4); drawRock(250, 980, 1.2);
    // prop ZEP: log rebah, tumpukan batu, gazebo
    [[560, 470, -0.3], [1660, 820, 0.22], [360, 880, -0.5], [1800, 520, 0.35], [700, 1120, -0.15], [430, 1300, 0.4]]
      .forEach(([x, y, a]) => { if (visIn(x - 40, y - 30, 80, 50)) drawLog(x, y, a); });
    [[560, 900], [1620, 560], [420, 760], [1700, 900], [1000, 1240], [600, 590], [1850, 760]]
      .forEach(([x, y]) => { if (visIn(x - 28, y - 20, 56, 40)) drawRockPile(x, y); });
    drawGazebo(2000, 372);

    // kupu-kupu beranimasi
    drawButterfly(560, 520, "#FF5D8F", now / 520 + 0.4);
    drawButterfly(770, 300, "#FFD629", now / 430 + 1.9);
    drawButterfly(1580, 430, "#43D0C4", now / 470 + 3.2);
    drawButterfly(440, 900, "#8A63F6", now / 500 + 5.0);
    drawButterfly(1710, 1130, "#3998F4", now / 460 + 2.6);
    drawButterfly(1180, 350, "#FF7569", now / 490 + 4.1);

    // 🐇 kelinci rebutan (hanya saat aktif)
    if (S.bunny.active) drawBunny(now);

    // pemain urut y
    const arr = [...S.players.values()].sort((a, b) => a.y - b.y);
    arr.forEach((p) => drawPlayer(p, now));

    ctx.restore();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  const OUT = () => { ctx.strokeStyle = "#151515"; ctx.lineWidth = 2.4; };
  /* ---- ZEP-style palette + soft helpers ---- */
  const ZP = {
    grass1: "#8acb5c", grass2: "#7cc052", grassDark: "#6fb448",
    treeDark: "#2f7d3e", leaf1: "#4aa84f", leaf2: "#63c05f", leaf3: "#84d477",
    pine1: "#2f8f4e", pine2: "#46ad5f", pine3: "#6ac777",
    trunk: "#8a5a3b", trunkD: "#6d4527",
    dirt1: "#ddc389", dirt2: "#cbb175", dirtEdge: "#b79a62",
    rock1: "#cbc8bf", rock2: "#aeaba2", rockD: "#8b887f",
    fence: "#e6e6e6", fenceD: "#cfcfcf", fenceLine: "rgba(120,120,120,.28)",
    wood: "#b5804f", woodD: "#8f6136",
    log: "#a5713f", logD: "#7d5330",
    stone: "#c7c9c4", stoneD: "#9aa09a",
    water1: "#69cdf1", water2: "#45b0e2", waterD: "#2f95c9",
    pink: "#f8bcd7", pinkD: "#ef8fbb", snow: "#ffffff",
    shadow: "rgba(46,94,42,.20)",
  };
  const disc = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  const tri = (cx, cy, r) => { ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx - r * 0.92, cy + r * 0.58); ctx.lineTo(cx + r * 0.92, cy + r * 0.58); ctx.closePath(); ctx.fill(); };
  const zShadow = (x, y, rx, ry) => { ctx.fillStyle = ZP.shadow; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); };
  // kanopi ZEP: kubah bergerigi (banyak lobus) + sorotan atas + bayangan bawah
  const drawCanopy = (cx, cy, R, cDark, cMid, cLight, fruit) => {
    const lobes = [[cx, cy, R]];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.26;
      lobes.push([cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, R * 0.33]);
    }
    ctx.fillStyle = cDark;
    lobes.forEach(([x, y, r]) => disc(x, y, r + 2.5));
    ctx.fillStyle = cMid;
    lobes.forEach(([x, y, r]) => disc(x, y, r));
    // bagian atas lebih terang
    ctx.fillStyle = cLight;
    lobes.forEach(([x, y, r]) => { if (y <= cy + R * 0.12) disc(x, y - r * 0.14, r * 0.72); });
    // sorotan puncak
    ctx.fillStyle = "rgba(255,255,255,.20)";
    lobes.forEach(([x, y, r]) => { if (y <= cy - R * 0.28) disc(x - r * 0.22, y - r * 0.3, r * 0.5); });
    // bayangan bawah
    ctx.fillStyle = "rgba(28,66,38,.16)";
    lobes.forEach(([x, y, r]) => { if (y >= cy + R * 0.24) disc(x + r * 0.14, y + r * 0.2, r * 0.66); });
    if (fruit) { ctx.fillStyle = fruit; disc(cx - R * 0.4, cy - R * 0.5, 2.6); disc(cx + R * 0.32, cy - R * 0.42, 2.1); disc(cx + R * 0.02, cy - R * 0.12, 2.3); }
  };
  function drawTree(x, y, kind) {
    if (kind === 1) return drawPine(x, y);
    if (kind === 2) return drawBlossom(x, y);
    zShadow(x, y + 3, 28, 9);
    ctx.fillStyle = ZP.trunkD; rr(x - 5, y - 22, 10, 24, 5); ctx.fill();
    ctx.fillStyle = ZP.trunk; rr(x - 3, y - 22, 6, 24, 5); ctx.fill();
    drawCanopy(x, y - 44, 30, ZP.treeDark, ZP.leaf1, ZP.leaf3, "rgba(224,240,150,.8)");
  }
  function drawPine(x, y) {
    zShadow(x, y + 3, 22, 8);
    ctx.fillStyle = ZP.trunkD; rr(x - 4, y - 16, 8, 18, 4); ctx.fill();
    [[0, -12, 25], [0, -28, 20], [0, -43, 14]].forEach(([dx, dy, r]) => { ctx.fillStyle = ZP.pine1; tri(x + dx, y + dy, r); });
    [[0, -12, 25], [0, -28, 20], [0, -43, 14]].forEach(([dx, dy, r]) => { ctx.fillStyle = ZP.pine2; tri(x + dx - 1, y + dy - 2, r * 0.78); });
    [[0, -12, 25], [0, -28, 20], [0, -43, 14]].forEach(([dx, dy, r]) => { ctx.fillStyle = ZP.pine3; tri(x + dx - 2, y + dy - 4, r * 0.5); });
  }
  function drawBlossom(x, y) {
    zShadow(x, y + 3, 24, 8);
    ctx.fillStyle = ZP.trunkD; rr(x - 5, y - 22, 10, 24, 5); ctx.fill();
    ctx.fillStyle = ZP.trunk; rr(x - 3, y - 22, 6, 24, 5); ctx.fill();
    drawCanopy(x, y - 40, 27, ZP.pinkD, ZP.pink, "#fbe0ee", "rgba(255,255,255,.75)");
  }
  function drawBush(x, y) {
    zShadow(x, y + 2, 24, 7);
    drawCanopy(x, y - 10, 20, ZP.treeDark, ZP.leaf2, ZP.leaf3, null);
  }
  function drawLog(x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    zShadow(0, 6, 34, 7);
    ctx.fillStyle = ZP.logD; rr(-30, -11, 60, 22, 11); ctx.fill();
    ctx.fillStyle = ZP.log; rr(-30, -9, 60, 18, 9); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)"; rr(-26, -7, 52, 5, 3); ctx.fill();
    ctx.fillStyle = "#c79a63"; ctx.beginPath(); ctx.ellipse(-30, 0, 5, 9, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = ZP.logD; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-30, 0, 2.6, 5, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = ZP.logD; ctx.beginPath(); ctx.ellipse(30, 0, 6, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#c79a63"; ctx.beginPath(); ctx.ellipse(30, 0, 4, 7, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawRockPile(x, y) {
    zShadow(x, y + 3, 24, 7);
    const st = [[-14, 0, 9], [13, 1, 10], [0, -5, 11], [-6, 6, 7], [8, -7, 6]];
    ctx.fillStyle = ZP.stoneD; st.forEach(([dx, dy, r]) => disc(x + dx, y + dy, r));
    ctx.fillStyle = ZP.stone; st.forEach(([dx, dy, r]) => disc(x + dx - 1, y + dy - 1, r - 1.5));
    ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.ellipse(x - 2, y - 9, 6, 3, -0.3, 0, 7); ctx.fill();
  }
  function drawGazebo(x, y) {
    zShadow(x, y + 8, 78, 16);
    // alas batu
    ctx.fillStyle = ZP.stoneD; ctx.beginPath(); ctx.ellipse(x, y, 80, 30, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#dcded9"; ctx.beginPath(); ctx.ellipse(x, y - 3, 76, 27, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#c4c7c1"; ctx.beginPath(); ctx.ellipse(x, y - 3, 26, 10, 0, 0, 7); ctx.fill();
    // kolom
    ctx.fillStyle = "#e2e2df";
    [[-52, 0], [-14, -14], [22, -14], [56, 2]].forEach(([dx, dy]) => { rr(x + dx - 6, y + dy - 66, 12, 68, 4); ctx.fill(); });
    ctx.fillStyle = "rgba(0,0,0,.08)";
    [[-52, 0], [-14, -14], [22, -14], [56, 2]].forEach(([dx, dy]) => { rr(x + dx + 1, y + dy - 66, 4, 68, 3); ctx.fill(); });
    // atap kerucut (ZEP dome)
    ctx.fillStyle = "#8a63f6"; tri(x, y - 52, 72);
    ctx.fillStyle = "#a184f8"; tri(x, y - 58, 58);
    ctx.fillStyle = "#bda9fb"; tri(x, y - 64, 40);
    ctx.fillStyle = "#FFD629"; disc(x, y - 116, 6);
  }
  function drawStump(x, y) {
    zShadow(x, y + 3, 15, 6);
    ctx.fillStyle = ZP.woodD; ctx.beginPath(); ctx.ellipse(x, y - 4, 15, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ZP.wood; rr(x - 15, y - 6, 30, 14, 6); ctx.fill();
    ctx.fillStyle = "#c79a63"; ctx.beginPath(); ctx.ellipse(x, y - 6, 15, 8, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(140,98,54,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 6, 8, 4.5, 0, 0, 7); ctx.stroke();
  }
  function drawSignpost(x, y, n) {
    zShadow(x, y + 3, 12, 5);
    ctx.fillStyle = ZP.woodD; rr(x - 3, y - 40, 6, 42, 3); ctx.fill();
    ctx.fillStyle = ZP.wood; rr(x - 3, y - 40, 4, 42, 3); ctx.fill();
    ctx.fillStyle = "#e8cf9c"; rr(x - 22, y - 44, 44, 24, 7); ctx.fill();
    ctx.fillStyle = "#b5804f"; ctx.beginPath(); ctx.moveTo(x + 22, y - 44); ctx.lineTo(x + 32, y - 32); ctx.lineTo(x + 22, y - 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#5b3d22"; ctx.font = "800 15px 'Plus Jakarta Sans',sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(n), x - 2, y - 27);
  }
  function drawFlower(x, y, c) {
    zShadow(x, y + 1, 8, 2.6);
    ctx.strokeStyle = "#4a8f3c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 10); ctx.stroke();
    ctx.fillStyle = c || "#ff77a9";
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; disc(x + Math.cos(a) * 4.5, y - 12 + Math.sin(a) * 4.5, 3.6); }
    ctx.fillStyle = "#ffe27a"; disc(x, y - 12, 2.8);
  }
  function drawRock(x, y, s) {
    s = s || 1;
    zShadow(x, y + 2, 20 * s, 6 * s);
    ctx.fillStyle = ZP.rockD; ctx.beginPath(); ctx.ellipse(x, y - 6 * s, 19 * s, 15 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ZP.rock2; ctx.beginPath(); ctx.ellipse(x - 1 * s, y - 8 * s, 16 * s, 12 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ZP.rock1; ctx.beginPath(); ctx.ellipse(x - 3 * s, y - 10 * s, 12 * s, 9 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.ellipse(x - 5 * s, y - 13 * s, 6 * s, 3.5 * s, -0.3, 0, 7); ctx.fill();
  }
  function visIn(x, y, w, h) { return !(x > S.cam.x + VIEW.w || x + w < S.cam.x || y > S.cam.y + VIEW.h || y + h < S.cam.y); }
  function drawTuft(x, y) {
    ctx.strokeStyle = "rgba(58,140,76,.5)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y - 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 11); ctx.stroke();
  }
  function drawBunting(x1, y1, x2, y2, phase) {
    const cols = ["#FF5D8F", "#FFD629", "#43D0C4", "#8A63F6", "#3998F4", "#FF7569"];
    const span = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(4, Math.round(span / 48));
    const sag = 22 + Math.sin(phase) * 3;
    const at = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * sag];
    ctx.strokeStyle = "rgba(90,70,45,.75)"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const [px, py] = at(i / n); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const [px, py] = at((i + 0.5) / n);
      const sway = Math.sin(phase + i) * 1.6;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.moveTo(px - 8, py); ctx.lineTo(px + 8, py); ctx.lineTo(px + sway, py + 22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.13)";
      ctx.beginPath(); ctx.moveTo(px + sway, py + 22); ctx.lineTo(px + 8, py); ctx.lineTo(px + 3, py); ctx.lineTo(px + sway, py + 19); ctx.closePath(); ctx.fill();
    }
  }
  function drawPlanter(x, y) {
    zShadow(x, y + 22, 32, 9);
    ctx.fillStyle = "#b5713f"; rr(x - 30, y, 60, 24, 8); ctx.fill();
    ctx.fillStyle = "#cb8a54"; rr(x - 30, y, 60, 9, 8); ctx.fill();
    ctx.fillStyle = ZP.treeDark; disc(x - 16, y + 2, 15); disc(x + 16, y + 2, 15); disc(x, y - 6, 17);
    ctx.fillStyle = ZP.leaf2; disc(x - 15, y + 1, 13); disc(x + 15, y + 1, 13); disc(x, y - 8, 15);
    ctx.fillStyle = ZP.leaf3; disc(x - 5, y - 12, 9);
    ctx.fillStyle = "#FF5D8F"; disc(x - 12, y - 12, 4.2);
    ctx.fillStyle = "#FFD629"; disc(x + 12, y - 14, 4.2);
    ctx.fillStyle = "#43D0C4"; disc(x, y - 20, 4.2);
    ctx.fillStyle = "#FF7569"; disc(x - 20, y - 8, 3.6); disc(x + 20, y - 8, 3.6);
  }
  function drawHedge(x, y, w) {
    const n = Math.max(2, Math.round(w / 36));
    zShadow(x, y + 6, w / 2, 10);
    for (let i = 0; i <= n; i++) { const cx = x - w / 2 + (w / n) * i; ctx.fillStyle = ZP.treeDark; disc(cx, y, 22); }
    for (let i = 0; i <= n; i++) { const cx = x - w / 2 + (w / n) * i; ctx.fillStyle = ZP.leaf2; disc(cx, y - 3, 20); }
    for (let i = 0; i <= n; i++) { const cx = x - w / 2 + (w / n) * i; ctx.fillStyle = "rgba(255,255,255,.16)"; disc(cx - 6, y - 11, 8); }
  }
  function drawGate(x, y) {
    zShadow(x, y + 12, 96, 18);
    [-1, 1].forEach((s) => {
      ctx.fillStyle = ZP.woodD; rr(x + s * 78 - 15, y - 74, 30, 86, 8); ctx.fill();
      ctx.fillStyle = ZP.wood; rr(x + s * 78 - 13, y - 74, 26, 86, 8); ctx.fill();
      ctx.fillStyle = "#e8cf9c"; rr(x + s * 78 - 15, y - 80, 30, 16, 7); ctx.fill();
      ctx.fillStyle = s < 0 ? "#FF5D8F" : "#43D0C4"; disc(x + s * 78, y - 104, 8);
    });
    ctx.fillStyle = "#e8cf9c"; rr(x - 100, y - 100, 200, 42, 12); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.08)"; rr(x - 100, y - 66, 200, 8, 12); ctx.fill();
    ctx.fillStyle = "#5b3d22"; ctx.font = "800 21px 'Plus Jakarta Sans',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🌳 EC GAMES", x, y - 71);
  }
  function drawButterfly(x, y, c, phase) {
    const fx = x + Math.cos(phase * 0.7) * 16;
    const fy = y + Math.sin(phase) * 9;
    const open = Math.abs(Math.sin(phase * 3));
    ctx.save(); ctx.translate(fx, fy);
    ctx.fillStyle = "rgba(46,94,42,.16)"; ctx.beginPath(); ctx.ellipse(0, 7, 9, 3, 0, 0, 7); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(s * (5 + open * 6), -3, 5 + open * 4, 8, s * 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.14)";
      ctx.beginPath(); ctx.ellipse(s * (5 + open * 6), 1, 3.5 + open * 2, 4, s * 0.5, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "#4a3a28"; ctx.fillRect(-1.3, -6, 2.6, 12);
    ctx.restore();
  }
  function drawBuilding(x, y, w, h, roof, label) {
    zShadow(x + 4, y + h + 2, w / 2 + 8, 14);
    ctx.fillStyle = "#f7f0de"; rr(x, y, w, h, 12); ctx.fill();
    ctx.fillStyle = "rgba(160,130,90,.10)"; rr(x, y, w, 10, 12); ctx.fill();
    const cols = Math.max(2, Math.floor(w / 76));
    for (let i = 0; i < cols; i++) {
      const cw = 34, ch = 30, wx = x + (w / cols) * (i + 0.5) - cw / 2, wy = y + 20;
      ctx.fillStyle = "#7cc4ef"; rr(wx, wy, cw, ch, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)"; rr(wx + 3, wy + 3, 12, ch - 6, 4); ctx.fill();
      ctx.strokeStyle = "rgba(120,90,60,.35)"; ctx.lineWidth = 2; rr(wx, wy, cw, ch, 7); ctx.stroke();
    }
    ctx.fillStyle = ZP.woodD; rr(x + w / 2 - 20, y + h - 48, 40, 48, 8); ctx.fill();
    ctx.fillStyle = ZP.wood; rr(x + w / 2 - 17, y + h - 48, 34, 48, 8); ctx.fill();
    ctx.fillStyle = "#ffd629"; disc(x + w / 2 + 9, y + h - 24, 3);
    ctx.fillStyle = "rgba(0,0,0,.14)"; rr(x - 14, y - 24, w + 28, 34, 12); ctx.fill();
    ctx.fillStyle = roof; rr(x - 12, y - 26, w + 24, 32, 12); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.28)"; rr(x - 6, y - 22, w + 12, 10, 8); ctx.fill();
    if (label) {
      ctx.fillStyle = "rgba(0,0,0,.12)"; rr(x + w / 2 - 52, y - 46, 104, 26, 9); ctx.fill();
      ctx.fillStyle = "#e8cf9c"; rr(x + w / 2 - 52, y - 48, 104, 26, 9); ctx.fill();
      ctx.fillStyle = "#6b4527"; ctx.font = "800 13px 'Plus Jakarta Sans',sans-serif"; ctx.textAlign = "center";
      ctx.fillText(label, x + w / 2, y - 30);
    }
  }
  function drawLamp(x, y) {
    zShadow(x, y + 2, 12, 5);
    ctx.fillStyle = "#6f6a63"; rr(x - 3, y - 46, 6, 48, 3); ctx.fill();
    ctx.fillStyle = "#8b857c"; rr(x - 2, y - 46, 3, 48, 2); ctx.fill();
    ctx.fillStyle = "rgba(255,214,41,.28)"; disc(x, y - 50, 16);
    ctx.fillStyle = "#ffd629"; disc(x, y - 50, 11);
    ctx.fillStyle = "rgba(255,255,255,.6)"; disc(x - 3, y - 53, 4);
  }
  function drawBench(x, y) {
    zShadow(x, y + 5, 30, 7);
    ctx.fillStyle = ZP.woodD; rr(x - 28, y - 8, 56, 16, 6); ctx.fill();
    ctx.fillStyle = ZP.wood; rr(x - 28, y - 12, 56, 12, 6); ctx.fill();
    ctx.fillStyle = "#caa06d"; rr(x - 28, y - 22, 56, 10, 6); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.15)"; rr(x - 28, y - 14, 56, 3, 3); ctx.fill();
    ctx.fillStyle = ZP.woodD; rr(x - 24, y + 2, 6, 8, 2); rr(x + 18, y + 2, 6, 8, 2);
  }
  function drawBalloons(x, y) {
    const cols = ["#FF5D8F", "#FFD629", "#43D0C4", "#8A63F6"];
    cols.forEach((c, i) => {
      const bx = x + i * 26, by = y - 30 - (i % 2) * 14;
      ctx.strokeStyle = "rgba(90,80,60,.5)"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x + 40, y); ctx.stroke();
      ctx.fillStyle = c; disc(bx, by, 12);
      ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(bx + 4, by + 4, 7, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.6)"; disc(bx - 4, by - 4, 3.5);
    });
  }
  function drawBunny(now) {
    const b = S.bunny;
    if (b.x < S.cam.x - 60 || b.x > S.cam.x + VIEW.w + 60 || b.y < S.cam.y - 80 || b.y > S.cam.y + VIEW.h + 60) return;
    const hop = Math.abs(Math.sin((b.hop || 0))) * 8;
    const x = b.x, y = b.y - hop;
    // lingkaran tangkap
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(b.x, b.y + 14, CATCH_R, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    // bayangan
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(b.x, b.y + 22, 16, 6, 0, 0, 7); ctx.fill();
    // badan kelinci
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x, y + 4, 15, 12, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 10 * (b.dir || 1), y - 8, 10, 0, 7); ctx.fill();
    // telinga
    ctx.fillStyle = "#ffe3ec";
    ctx.beginPath(); ctx.ellipse(x - 4 + 8 * (b.dir || 1), y - 26, 4, 11, -0.15, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 6 + 8 * (b.dir || 1), y - 26, 4, 11, 0.15, 0, 7); ctx.fill();
    // mata
    ctx.fillStyle = "#222";
    ctx.beginPath(); ctx.arc(x + 4 + 8 * (b.dir || 1), y - 9, 2, 0, 7); ctx.fill();
    // wortel di punggung
    ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🥕", x - 12, y - 2);
    // label
    ctx.font = "bold 13px sans-serif";
    const t = "🐇 TANGKAP AKU!";
    const wpx = ctx.measureText(t).width + 14;
    ctx.fillStyle = "#fff3c4"; rr(x - wpx / 2, y - 56, wpx, 20, 10); ctx.fill();
    ctx.strokeStyle = "#ff8a00"; ctx.lineWidth = 2; rr(x - wpx / 2, y - 56, wpx, 20, 10); ctx.stroke();
    ctx.fillStyle = "#7a4d00"; ctx.fillText(t, x, y - 42);
  }
  /* ====== map mode 🐇 Kelinci: padang hangat, sarang, wortel, jerami ====== */
  function drawWoodFence() {
    ctx.fillStyle = ZP.woodD;
    rr(10, 22, WORLD.w - 20, 7, 3); ctx.fill();
    rr(10, 40, WORLD.w - 20, 7, 3); ctx.fill();
    rr(10, WORLD.h - 46, WORLD.w - 20, 7, 3); ctx.fill();
    rr(10, WORLD.h - 28, WORLD.w - 20, 7, 3); ctx.fill();
    rr(20, 10, 7, WORLD.h - 20, 3); ctx.fill();
    rr(38, 10, 7, WORLD.h - 20, 3); ctx.fill();
    rr(WORLD.w - 46, 10, 7, WORLD.h - 20, 3); ctx.fill();
    rr(WORLD.w - 28, 10, 7, WORLD.h - 20, 3); ctx.fill();
    const post = (px, py) => {
      ctx.fillStyle = ZP.woodD; rr(px - 6, py - 30, 12, 40, 3); ctx.fill();
      ctx.fillStyle = ZP.wood; rr(px - 5, py - 30, 9, 40, 3); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.10)"; rr(px + 1, py - 30, 3, 40, 3); ctx.fill();
    };
    for (let x = 60; x < WORLD.w - 40; x += 96) { if (visIn(x - 8, 0, 16, 50)) post(x, 36); if (visIn(x - 8, WORLD.h - 52, 16, 50)) post(x, WORLD.h - 16); }
    for (let y = 90; y < WORLD.h - 60; y += 96) { if (visIn(0, y - 8, 50, 16)) post(36, y); if (visIn(WORLD.w - 52, y - 8, 50, 16)) post(WORLD.w - 16, y); }
  }
  function drawBurrow(x, y) {
    zShadow(x, y + 8, 54, 15);
    ctx.fillStyle = "#c9a86e"; ctx.beginPath(); ctx.ellipse(x, y, 54, 34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#dcbe82"; ctx.beginPath(); ctx.ellipse(x, y - 4, 48, 28, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#6b4c2f"; ctx.beginPath(); ctx.ellipse(x, y + 1, 27, 19, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#3a2817"; ctx.beginPath(); ctx.ellipse(x, y + 3, 20, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.beginPath(); ctx.ellipse(x - 8, y - 12, 20, 9, -0.2, 0, 7); ctx.fill();
    ctx.font = "18px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🕳️", x + 30, y - 18);
  }
  function drawCarrot(x, y) {
    ctx.strokeStyle = "#3f9e46"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 12); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 12); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke();
    ctx.fillStyle = "#ef8a2b";
    ctx.beginPath(); ctx.moveTo(x - 6, y - 3); ctx.lineTo(x + 6, y - 3); ctx.lineTo(x, y + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 1, y - 2); ctx.lineTo(x - 1, y + 8); ctx.closePath(); ctx.fill();
  }
  function drawMushroom(x, y) {
    zShadow(x, y + 3, 13, 4);
    ctx.fillStyle = "#f2e6d0"; rr(x - 4, y - 14, 8, 17, 3); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.10)"; rr(x + 1, y - 14, 3, 17, 3); ctx.fill();
    ctx.fillStyle = "#e04a4a"; ctx.beginPath(); ctx.ellipse(x, y - 15, 16, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; disc(x - 6, y - 17, 2.6); disc(x + 4, y - 14, 2.2); disc(x + 1, y - 20, 2);
  }
  function drawHay(x, y) {
    zShadow(x, y + 5, 26, 8);
    ctx.fillStyle = "#d9a93c"; rr(x - 22, y - 18, 44, 28, 10); ctx.fill();
    ctx.fillStyle = "#f0c657"; rr(x - 22, y - 22, 44, 20, 10); ctx.fill();
    ctx.strokeStyle = "rgba(150,110,30,.4)"; ctx.lineWidth = 2;
    for (let i = -16; i <= 16; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y - 20); ctx.lineTo(x + i, y + 4); ctx.stroke(); }
  }
  function drawChaseWorld(now) {
    // padang rumput hangat
    const gg = ctx.createLinearGradient(0, S.cam.y - 40, 0, S.cam.y + VIEW.h + 40);
    gg.addColorStop(0, "#a8d46d"); gg.addColorStop(1, "#8cc253");
    ctx.fillStyle = gg; ctx.fillRect(S.cam.x - 40, S.cam.y - 40, VIEW.w + 80, VIEW.h + 80);
    ctx.fillStyle = "rgba(255,255,255,.08)";
    CH_PATCHES.forEach(([x, y, r]) => { if (visIn(x - r, y - r, r * 2, r * 2)) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, 7); ctx.fill(); } });
    ctx.fillStyle = "rgba(90,150,50,.12)";
    CH_PATCHES.forEach(([x, y, r]) => { const yy = y + r * 0.7; if (visIn(x - r, yy - r, r * 2, r * 2)) { ctx.beginPath(); ctx.ellipse(x + r * 0.4, yy, r * 0.7, r * 0.4, 0, 0, 7); ctx.fill(); } });
    GRASS_TUFTS.forEach(([x, y]) => { if (visIn(x - 10, y - 12, 20, 16)) drawTuft(x, y); });

    // lapangan tanah (arena duel) di tengah
    ctx.fillStyle = "rgba(60,90,40,.10)"; ctx.beginPath(); ctx.ellipse(CX, CY + 6, 430, 300, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#e3d09c"; ctx.beginPath(); ctx.ellipse(CX, CY, 424, 292, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#d8c184"; ctx.beginPath(); ctx.ellipse(CX, CY - 4, 404, 274, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(150,120,75,.28)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(CX, CY, 424, 292, 0, 0, 7); ctx.stroke();
    // ubin catur lembut
    ctx.save(); ctx.beginPath(); ctx.ellipse(CX, CY - 4, 404, 274, 0, 0, 7); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    for (let gy = CY - 280; gy < CY + 280; gy += 64) for (let gx = CX - 410; gx < CX + 410; gx += 64) if (((gx + gy) / 64) % 2 === 0) ctx.fillRect(gx, gy, 64, 64);
    ctx.restore();

    // pagar kayu rustic
    drawWoodFence();

    // sarang kelinci + papan arah
    CH_BURROWS.forEach(([x, y]) => { if (visIn(x - 60, y - 40, 120, 80)) drawBurrow(x, y); });
    drawSignpost(300, 700, 2); drawSignpost(1900, 700, 6);

    // tumpukan jerami
    CH_HAY.forEach(([x, y]) => { if (visIn(x - 30, y - 28, 60, 48)) drawHay(x, y); });
    // wortel (khas kelinci)
    CH_CARROTS.forEach(([x, y]) => { if (visIn(x - 10, y - 16, 20, 30)) drawCarrot(x, y); });
    // jamur cantik
    CH_MUSH.forEach(([x, y]) => { if (visIn(x - 18, y - 28, 36, 34)) drawMushroom(x, y); });
    // log rebah, tumpukan batu, tunggul
    CH_LOGS.forEach(([x, y, a]) => { if (visIn(x - 40, y - 30, 80, 50)) drawLog(x, y, a); });
    CH_ROCKS.forEach(([x, y]) => { if (visIn(x - 28, y - 22, 56, 44)) drawRockPile(x, y); });
    [[980, 900], [1220, 900], [1080, 1000]].forEach(([x, y]) => { if (visIn(x - 16, y - 16, 32, 24)) drawStump(x, y); });
    // bunga
    CH_FLOWERS.forEach(([x, y], i) => { if (visIn(x - 10, y - 18, 20, 24)) drawFlower(x, y, ["#ff77a9", "#FFD629", "#ff9f68", "#8A63F6"][i % 4]); });
    // hutan keliling
    CH_TREES.forEach(([x, y], i) => { if (visIn(x - 44, y - 74, 88, 88)) drawTree(x, y, i % 3); });

    // papan judul
    const tx = CX, ty = 250;
    ctx.fillStyle = "rgba(0,0,0,.12)"; rr(tx - 150, ty - 4, 300, 60, 16); ctx.fill();
    ctx.fillStyle = ZP.wood; rr(tx - 150, ty - 8, 300, 60, 16); ctx.fill();
    ctx.fillStyle = "#e8cf9c"; rr(tx - 142, ty, 284, 44, 12); ctx.fill();
    ctx.fillStyle = "#6b4527"; ctx.font = "800 24px 'Plus Jakarta Sans',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🐇 PADANG KELINCI", tx, ty + 32);

    // kupu-kupu + kunang hangat
    drawButterfly(560, 520, "#FFD629", now / 500 + 0.4);
    drawButterfly(1560, 430, "#43D0C4", now / 470 + 1.9);
    drawButterfly(900, 1180, "#FF5D8F", now / 520 + 3.2);
    drawButterfly(1700, 1100, "#8A63F6", now / 490 + 5.0);
  }

  function wrapText(text, cx, y, maxW, lh) {
    const words = String(text).split(" ");
    const lines = [];
    let line = "";
    words.forEach((w) => {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
      else line = t;
    });
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
  }
  function leader() {
    let best = null;
    S.players.forEach((p) => { if ((p.score || 0) > 0 && (!best || p.score > best.score)) best = p; });
    return best;
  }
  function drawPlayer(p, now) {
    if (p.x < S.cam.x - 60 || p.x > S.cam.x + VIEW.w + 60 || p.y < S.cam.y - 80 || p.y > S.cam.y + VIEW.h + 60) return;
    const step = p.moving ? Math.sin(now / 100 + p.x) : 0;
    const bob = p.moving ? Math.abs(step) * -4 : Math.sin(now / 520 + p.x) * 1.1;
    const x = p.x, y = p.y + bob;
    const col = p.color || "#8A63F6";
    const qz = S.quiz;
    const ghost = S.rules.survival && p.dead;
    if (qz && !ghost && (qz.phase === "answer" || qz.phase === "reveal") && p.zone >= 0) {
      ctx.strokeStyle = ZONE_COLORS[p.zone]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 22, 24, 10, 0, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = "rgba(21,21,21,.16)";
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 21, 18, 7, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#151515"; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (ghost) ctx.globalAlpha = 0.45;
    if (p.look && window.ECAVATAR) {
      ECAVATAR.draw(ctx, p.look, x, y, { moving: p.moving, t: now });
    } else {
      const leg = step * 6;
      ctx.fillStyle = "#3a3226";
      rr(x - 8, y + 3, 6, 12 + leg, 3); ctx.fill(); ctx.stroke();
      rr(x + 2, y + 3, 6, 12 - leg, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(x - 15, y - 3 + leg * 0.5, 5.5, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + 15, y - 3 - leg * 0.5, 5.5, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
      rr(x - 12, y - 16, 24, 23, 11); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.5)"; rr(x - 6, y - 7, 12, 11, 5); ctx.fill();
      ctx.strokeStyle = "rgba(21,21,21,.3)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 3); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y - 27, 17, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.42)";
      ctx.beginPath(); ctx.arc(x, y - 30, 13.5, 0, 7); ctx.fill();
      ctx.strokeStyle = "#151515"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(x, y - 27, 17, 0, 7); ctx.stroke();
      ctx.font = "27px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(p.avatar || "🦊", x, y - 17);
    }
    if (ghost) ctx.globalAlpha = 1;
    // mahkota untuk peringkat 1 (hantu: tanda 👻)
    if (ghost) { ctx.font = "22px sans-serif"; ctx.textAlign = "center"; ctx.fillText("👻", x + 1, y - 46); }
    else {
      const lead = leader();
      if (lead && lead.id === p.id) { ctx.font = "24px sans-serif"; ctx.fillText("👑", x + 1, y - 50); }
    }
    // bubble chat
    const bub = S.bubbles.get(p.id);
    if (bub && bub.until > now) {
      ctx.font = "bold 12px sans-serif";
      const wpx = Math.min(220, ctx.measureText(bub.txt).width + 18);
      ctx.fillStyle = "#fff"; rr(x - wpx / 2, y - 92, wpx, 24, 12); ctx.fill();
      ctx.fillStyle = "#111"; ctx.fillText(bub.txt.slice(0, 30), x, y - 75);
    }
    // label nama + skor
    ctx.font = "bold 12px sans-serif";
    const lock = (qz && qz.phase === "reveal" && p.zone >= 0) ? " 🔒" + ZONE_LETTERS[p.zone] : "";
    const label = `${p.name} · ${p.score || 0}${lock}`;
    const wpx = ctx.measureText(label).width + 12;
    const ny = y - (bub && bub.until > now ? 116 : 64);
    ctx.save();
    ctx.shadowColor = "rgba(35,55,40,.28)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = p.id === (S.me && S.me.id) ? "#FFD629" : "#FFFFFF";
    rr(x - wpx / 2, ny, wpx, 18, 9); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(38,49,42,.12)"; ctx.lineWidth = 1; rr(x - wpx / 2, ny, wpx, 18, 9); ctx.stroke();
    ctx.fillStyle = "#26312a"; ctx.fillText(label, x, ny + 13);
  }

  /* ================= HUD / board ================= */
  function refreshHud() {
    if (!S.me) return;
    $("hud-code").textContent = S.room || "------";
    const hm = $("hud-mode"); if (hm) hm.textContent = MODE_SHORT[S.mode] || MODE_SHORT.zones;
    const ht = $("hud-team");
    if (ht) {
      if (S.rules.team && S.mode !== "race") { ht.classList.remove("hidden"); const myT = teamOf(S.me); ht.style.color = TEAM_COLOR[myT]; $("hud-team-n").textContent = `${TEAM_LABEL[myT]} · ${teamScore(myT)}`; }
      else ht.classList.add("hidden");
    }
    const hr = $("hud-round");
    if (hr) {
      if (S.rules.rounds && S.mode !== "race" && S.quiz && S.quiz.qIndex >= 0) { hr.classList.remove("hidden"); $("hud-round-n").textContent = `Ronde ${roundOf(S.quiz.qIndex)}`; }
      else hr.classList.add("hidden");
    }
    $("hud-players").textContent = S.players.size;
    const gL = ghostLeft();
    $("hud-score").textContent = (S.rules.survival && S.me.dead) ? (gL > 0 ? `👻 ${gL}s` : "👻 gugur") : S.me.score;
    const st = $("hud-streak");
    if (S.streak >= 2) { st.classList.remove("hidden"); $("hud-streak-n").textContent = S.streak; }
    else st.classList.add("hidden");
    refreshHudGate();
  }
  function refreshHudGate() {
    const R = S.race, el = $("hud-gate"), n = $("hud-gate-n");
    const tEl = $("hud-time");
    const showRace = S.mode === "race" && R && S.me;
    if (el && n) {
      if (showRace) { el.classList.remove("hidden"); n.textContent = `${R.prog[S.me.id] || 0}/${R.K}`; }
      else el.classList.add("hidden");
    }
    if (tEl) tEl.classList.toggle("hidden", !showRace || !!R.idle);
    refreshGhostOverlay();
  }
  function refreshGhostOverlay() {
    const el = $("ghost-timer"), n = $("ghost-timer-n");
    if (!el || !n) return;
    const left = ghostLeft();
    const show = !!(S.rules.survival && S.me && S.me.dead && left > 0);
    const sig = show ? "t" + left : (S.rules.survival && S.me && S.me.dead ? "x" : "h");
    if (sig === ghostSig) return; // hindari tulis DOM tiap frame
    ghostSig = sig;
    el.classList.toggle("hidden", !show);
    if (show) n.textContent = left;
    if (S.me && S.rules.survival && S.me.dead) $("hud-score").textContent = left > 0 ? `👻 ${left}s` : "👻 gugur";
  }
  function renderBoard() {
    const ol = $("board-list"); if (!ol) return; ol.innerHTML = "";
    const medals = ["🥇", "🥈", "🥉"];
    if (S.rules.team) {
      [0, 1].forEach((t) => {
        const li = document.createElement("li");
        li.style.fontWeight = "800"; li.style.color = TEAM_COLOR[t];
        li.textContent = `${TEAM_LABEL[t]} — ${teamScore(t)}`;
        ol.appendChild(li);
      });
    }
    [...S.players.values()].sort((a, b) => (b.score || 0) - (a.score || 0)).forEach((p, i) => {
      const li = document.createElement("li");
      const dead = S.rules.survival && p.dead ? " 👻" : "";
      const tag = S.rules.team ? ` [${TEAM_LABEL[teamOf(p)]}]` : "";
      li.textContent = `${medals[i] || (i + 1) + "."} ${p.avatar} ${p.name}${dead}${tag} — ${p.score || 0}`;
      ol.appendChild(li);
    });
  }

  /* ================= QUIZ ================= */
  function hostStartQuiz() {
    if (!S.me) return;
    if (EDU_LOADING) { toast("⏳ Menunggu soal Educrazy dimuat..."); return; }
    if (!QUESTIONS.length) { toast("Soal belum ada."); return; }
    const mq = modeQuestions();
    if (!mq.qs.length) { toast(S.mode === "race" ? "Butuh soal MC/O-X/isi — tambah soal dulu." : "Butuh soal pilihan ganda 4 opsi untuk mode ini."); return; }
    QUESTIONS = mq.qs; EDU_QIDS = mq.qids; EDU_ANSWERS = {};
    sfx("go");
    S.me.score = 0; S.streak = 0; syncScore();
    const podH0 = document.querySelector("#podium h3"); if (podH0) podH0.textContent = "🎉 Hasil Akhir";
    S.raceResults = null;
    if (S.solo) S.players.forEach((p) => { p.score = 0; p.botStreak = 0; });
    S.players.forEach((p) => { p.dead = false; });
    assignTeams();
    if (S.mode === "race") { hostRaceStart(); return; }
    send("quiz_start", { at: Date.now(), questions: stripQ(QUESTIONS), quiz: EDU_QUIZ, qids: EDU_QIDS, mode: S.mode, rules: { ...S.rules } });
    $("podium").classList.add("hidden");
    const sv = $("btn-save-edu"); if (sv) sv.classList.add("hidden");
    const ss = $("btn-solo-start"); if (ss) ss.remove();
    quizCountdown();
  }
  function quizCountdown() {
    stopQuizLocal();
    if (S.rules.team) assignTeams();
    resetDead();
    S.quiz = { phase: "countdown", qIndex: -1, endsAt: 0, myZone: -1, enterT: 0, correct: -1, timerInt: 0 };
    S.bunny.active = false;
    if (S.mode !== "race" && S.race) { try { clearInterval(S.race.timerInt); } catch (_) {} S.race = null; restoreWorld(); }
    S.raceResults = null;
    const podH = document.querySelector("#podium h3"); if (podH) podH.textContent = "🎉 Hasil Akhir";
    $("podium").classList.add("hidden");
    $("duel").classList.add("hidden");
    const RQ = $("raceq"); if (RQ) RQ.classList.add("hidden");
    const chase = S.mode === "chase";
    const race = S.mode === "race";
    $("q-banner").classList.toggle("hidden", chase || race);
    if (race) {
      // toast ditangani di bawah (sertakan aturan aktif)
    } else if (!chase) {
      $("q-banner").classList.remove("hidden");
      $("quiz-qnum").textContent = "🎬 Bersiap...";
      $("quiz-timer").textContent = "…";
      $("quiz-timer").classList.remove("low");
      $("quiz-q").textContent = "Kuis segera dimulai! Berdirilah di tengah arena, lalu masuk ke zona warna untuk menjawab.";
      $("quiz-status").textContent = "";
    } else {
      $("quiz-qnum").textContent = "🐇 Bersiap...";
      $("quiz-status").textContent = "";
    }
    const baseToast = S.mode === "race" ? "🏁 Mode Balapan — jawab soal, buka gembok, finis duluan!" : chase ? "🐇 Mode Rebutan Kelinci — kejar kelincinya!" : "🅰️ Mode Zona ABCD";
    const rt = ruleText(S.rules);
    toast(baseToast + (rt !== "—" ? " · " + rt : ""));
    if (S.mode !== "race") {
      clearTimeout(S.quizNextT);
      const driver = (S.isHost || S.solo);
      startCountdown(3, () => { if (driver) nextQuestion(0); });
    }
  }
  function startCountdown(sec, done) {
    const el = $("start-count");
    let n = sec;
    if (el) el.classList.remove("hidden");
    const render = () => { if (el) el.textContent = n > 0 ? String(n) : "MULAI!"; };
    render(); sfx("click");
    clearInterval(countInt);
    countInt = setInterval(() => {
      n -= 1;
      if (n >= 1) { render(); sfx("click"); }
      else {
        clearInterval(countInt);
        render(); sfx("go");
        clearTimeout(countDoneT);
        countDoneT = setTimeout(() => { if (done && S.me) done(); }, 650);
        setTimeout(() => { if (el) { el.classList.add("hidden"); el.textContent = ""; } }, 650);
      }
    }, 1000);
  }
  function nextQuestion(i) {
    if (i >= QUESTIONS.length) {
      send("quiz_end", { at: Date.now() });
      endQuiz();
      return;
    }
    if (S.mode === "race") return; // balapan jalan sendiri
    // Survival: kalau tersisa <=1 pemain hidup, akhiri lebih awal (zones & chase). Jangan di soal pertama (i>0).
    if (S.rules.survival && i > 0 && (S.mode === "zones" || S.mode === "chase") && aliveCount() <= 1) {
      if (S.isHost || S.solo) { send("quiz_end", { at: Date.now() }); endQuiz(); }
      return;
    }
    if (S.mode === "chase") { hostChase(i); return; }
    if (S.rules.rounds && i > 0 && i % ROUND_SIZE === 0) toast(`🔁 Ronde ${roundOf(i)} dimulai!`);
    const endsAt = Date.now() + TIME_PER_Q * 1000;
    send("quiz_q", { index: i, endsAt, questions: stripQ(QUESTIONS), quiz: EDU_QUIZ, qids: EDU_QIDS });
    showQuestion(i, endsAt);
    if (S.isHost || S.solo) {
      clearTimeout(S.quizNextT);
      S.quizNextT = setTimeout(() => hostReveal(i), TIME_PER_Q * 1000 + 400);
    }
  }
  function claimAsMe() {
    const qz = S.quiz;
    if (!qz || qz.phase !== "chase" || !S.me) return;
    if (S.rules.survival && S.me.dead) return; // hantu tidak bisa mengejar
    if (S.solo || S.isHost) {
      lockChase(qz.qIndex, { id: S.me.id, name: S.me.name });
      if (!S.solo && S.quiz) send("chase_lock", { index: qz.qIndex, holderId: S.me.id, holderName: S.me.name, duelEndsAt: S.quiz.duelEndsAt });
    } else {
      send("bunny_claim", { id: S.me.id, name: S.me.name, index: qz.qIndex, x: Math.round(S.me.x), y: Math.round(S.me.y), at: Date.now() });
      lockChase(qz.qIndex, { id: S.me.id, name: S.me.name }); // optimis, dikoreksi via chase_lock
    }
  }
  function showQuestion(i, endsAt) {
    stopQuizLocal();
    const Q = QUESTIONS[i]; if (!Q) return;
    S.quiz = { phase: "answer", qIndex: i, endsAt, myZone: -1, enterT: 0, correct: -1, timerInt: 0 };
    S.zoneN = (S.mode === "zones" && Array.isArray(Q.opts)) ? Math.max(2, Math.min(4, Q.opts.length)) : 4;
    if (S.me) S.me.zone = -1;
    lastTickSec = -1;
    $("podium").classList.add("hidden");
    $("board").classList.add("hidden");
    $("q-banner").classList.remove("hidden");
    $("quiz-qnum").textContent = (S.rules.rounds ? `Ronde ${roundOf(i)} · ` : "") + `Soal ${i + 1}/${QUESTIONS.length}`;
    $("quiz-q").textContent = Q.q;
    if (S.rules.survival && S.me && S.me.dead) {
      $("quiz-status").textContent = "👻 Kamu sudah gugur — lihat saja sampai selesai.";
      $("quiz-status").style.color = "#6d7a71";
    } else {
      $("quiz-status").textContent = (S.rules.survival ? "⚠️ Survival: salah = jadi hantu! " : "") + `Berdiri di zona ${ZONE_LETTERS.slice(0, S.zoneN).join(" / ")} untuk menjawab!`;
      $("quiz-status").style.color = "#374151";
    }
    $("quiz-timer").classList.remove("low");
    const tick = () => {
      if (!S.quiz || S.quiz.phase !== "answer") return;
      const left = Math.max(0, (S.quiz.endsAt - Date.now()) / 1000);
      if (left <= 0 && (S.isHost || S.solo)) { hostReveal(i); }
      else if (left <= 0) { $("quiz-timer").textContent = "0"; $("quiz-status").textContent = "⏳ Mengunci jawaban..."; }
    };
    S.quiz.timerInt = setInterval(tick, 300);
    // bots pilih zona (mayoritas benar agar seru)
    if (S.solo) {
      S.players.forEach((p) => {
        if (!p.isBot) return;
        const correct = Q.answer;
        p.pick = Math.random() < 0.55 ? correct : Math.floor(Math.random() * Q.opts.length);
      });
    }
  }
  function hostReveal(i) {
    if (S.mode !== "zones" || !S.quiz || S.quiz.phase !== "answer" || S.quiz.qIndex !== i) return;
    const full = QUESTIONS[i];
    // host selalu pegang soal lengkap (jawaban tidak pernah dikirim sebelum reveal)
    const correct = full && typeof full.answer === "number" ? full.answer : 0;
    send("quiz_reveal", { index: i, correct });
    doReveal(i, correct);
    if (S.isHost || S.solo) {
      clearTimeout(S.quizNextT);
      S.quizNextT = setTimeout(() => nextQuestion(i + 1), REVEAL_MS);
    }
  }

  /* ================= MODE 🏁 BALAPAN (seperti video) ================= */
  // Staging sebelum balapan mulai: tampilkan lintasan + pemain di garis start
  // (seperti video: tiap pemain di lajurnya masing-masing, menunggu GO).
  function ensureRaceIdle() {
    if (S.mode !== "race") return;
    const ids = [...S.players.values()].map((p) => p.id);
    if (S.race && !S.race.idle) return; // balapan sedang/ sudah berjalan
    if (S.race && S.race.idle) {
      // sudah staging: hanya bangun ulang kalau daftar pemain berubah
      const known = Object.keys(S.race.lanes);
      if (known.length === ids.length && ids.every((id) => S.race.lanes[id] != null)) return;
    }
    const lanes = {}; ids.forEach((id, i) => { lanes[id] = i; });
    const K = Math.max(1, Math.min(RACE_MAX_GATES, QUESTIONS.length || 1));
    const qmap = []; for (let g = 0; g < K; g++) qmap.push(QUESTIONS.length ? g % QUESTIONS.length : 0);
    S.race = { lanes, prog: {}, dist: {}, finished: [], K, qmap, endsAt: 0, idle: true, over: false, popupGi: -1, popupOpen: false, retryUntil: 0, hintUsed: {}, iFinished: false, botSt: {}, timerInt: 0 };
    const R = S.race;
    S.players.forEach((pl) => {
      R.prog[pl.id] = 0;
      R.dist[pl.id] = -raceLaneOf(R, pl.id) * 6;
      pl.dir = 1; pl.moving = false; pl.zone = -1;
      raceSetPos(pl, R.dist[pl.id], raceOffFor(R, pl.id));
    });
    if (S.me) {
      raceSetPos(S.me, R.dist[S.me.id] || 0, raceOffFor(R, S.me.id));
      const c0 = racePos(0, 0);
      S.cam.x = clampCamX(c0.x, raceWorldW()); S.cam.y = clampCamY(c0.y, raceWorldH());
    }
    ensureRaceWorld();
    $("q-banner").classList.add("hidden");
    toast((S.isHost || S.solo) ? "🏁 Tekan ▶ Mulai Kuis untuk balapan!" : "🏁 Menunggu host memulai balapan...");
    refreshHud(); renderBoard();
  }
  function hostRaceStart() {
    if (!(S.isHost || S.solo)) return;
    const ids = [...S.players.values()].map((p) => p.id);
    const lanes = {}; ids.forEach((id, i) => { lanes[id] = i; });
    const K = Math.max(1, Math.min(RACE_MAX_GATES, QUESTIONS.length || 1));
    const qmap = []; for (let g = 0; g < K; g++) qmap.push(QUESTIONS.length ? g % QUESTIONS.length : 0);
    S.mode = "race";
    const endsAt = Date.now() + RACE_TIME_MS;
    send("race_start", { lanes, K, qmap, full: QUESTIONS, quiz: EDU_QUIZ, qids: EDU_QIDS, endsAt, mode: "race" });
    $("podium").classList.add("hidden");
    const sv = $("btn-save-edu"); if (sv) sv.classList.add("hidden");
    const ss = $("btn-solo-start"); if (ss) ss.remove();
    onRaceStart({ lanes, K, qmap, endsAt });
  }
  function raceSnapshot() {
    const R = S.race; if (!R) return null;
    return { lanes: { ...R.lanes }, prog: { ...R.prog }, dist: { ...R.dist }, finished: R.finished.map((f) => ({ ...f })), K: R.K, qmap: [...R.qmap], full: QUESTIONS, quiz: EDU_QUIZ, qids: EDU_QIDS, endsAt: R.endsAt };
  }
  function onRaceStart(p) {
    if (Array.isArray(p.full) && p.full.length) {
      QUESTIONS = p.full;
      if (p.quiz) EDU_QUIZ = p.quiz;
      if (Array.isArray(p.qids)) EDU_QIDS = p.qids;
      EDU_ANSWERS = {};
    }
    S.mode = "race"; syncModeUI();
    S.raceResults = null; S.streak = 0; EDU_ANSWERS = {};
    S.me.score = 0;
    S.players.forEach((p) => { p.score = 0; });
    S.quiz = null; S.bunny.active = false; S.streak = 0;
    $("podium").classList.add("hidden");
    $("board").classList.add("hidden");
    $("duel").classList.add("hidden");
    const RQ0 = $("raceq"); if (RQ0) RQ0.classList.add("hidden");
    const lanes = p.lanes || {};
    const K = Math.max(1, p.K || 1);
    S.race = { lanes: { ...lanes }, prog: {}, dist: {}, finished: [], K, qmap: Array.isArray(p.qmap) && p.qmap.length ? [...p.qmap] : [], endsAt: p.endsAt || (Date.now() + RACE_TIME_MS), popupGi: -1, popupOpen: false, retryUntil: 0, hintUsed: {}, iFinished: false, over: false, botSt: {}, timerInt: 0 };
    const R = S.race;
    if (!R.qmap.length) { for (let g = 0; g < K; g++) R.qmap.push(QUESTIONS.length ? g % QUESTIONS.length : 0); }
    S.players.forEach((pl) => {
      R.prog[pl.id] = 0;
      R.dist[pl.id] = -raceLaneOf(R, pl.id) * 6;
      pl.dir = 1; pl.moving = false; pl.score = 0; pl.raceOpened = 0; pl.zone = -1;
      raceSetPos(pl, R.dist[pl.id], raceOffFor(R, pl.id));
    });
    if (S.me) {
      raceSetPos(S.me, R.dist[S.me.id] || 0, raceOffFor(R, S.me.id));
      S.me.score = 0; S.me.zone = -1;
      const c0 = racePos(0, 0);
      S.cam.x = clampCamX(c0.x, raceWorldW()); S.cam.y = clampCamY(c0.y, raceWorldH());
    }
    ensureRaceWorld();
    $("q-banner").classList.add("hidden");
    toast(p.late ? "🏁 Kamu menyusul balapan — kejar!" : `🏁 GO! Buka ${K} gembok lalu finis!`);
    sfx("go");
    refreshHud(); renderBoard();
    try { clearInterval(R.timerInt); } catch (_) {}
    R.timerInt = setInterval(raceTick, 500);
    raceTick();
  }
  function raceTick() {
    const R = S.race; if (!R) return;
    const left = Math.max(0, Math.ceil((R.endsAt - Date.now()) / 1000));
    const mm = String(Math.floor(left / 60)).padStart(1, "0"), ss = String(left % 60).padStart(2, "0");
    const t = $("quiz-timer"); if (t) { t.textContent = mm + ":" + ss; t.classList.toggle("low", left <= 30); }
    const hn = $("hud-time-n"); if (hn) hn.textContent = mm + ":" + ss;
    refreshHud();
    if ((S.isHost || S.solo) && !R.over && Date.now() >= R.endsAt) hostRaceEnd();
  }
  function raceProgSync() {
    const R = S.race; if (!R || !S.me) return;
    const opened = R.prog[S.me.id] || 0;
    const rec = S.players.get(S.me.id);
    if (rec) { rec.score = S.me.score; rec.raceOpened = opened; }
    send("race_prog", { id: S.me.id, opened, score: S.me.score });
    refreshHud(); renderBoard();
  }
  function raceQuestion(gi) {
    const R = S.race; if (!R) return null;
    const qi = R.qmap[gi] != null ? R.qmap[gi] : 0;
    return QUESTIONS[qi] || null;
  }
  function openRacePopup(gi) {
    const R = S.race; if (!R || !S.me || R.popupOpen) return;
    const Q = raceQuestion(gi); if (!Q) return;
    R.popupGi = gi; R.popupOpen = true; R.frozenD = R.dist[S.me.id] || 0;
    S.me.moving = false;
    $("raceq-who").textContent = `Question ${gi + 1}`;
    const type = Q.type || "mc";
    const tEl = $("raceq-type");
    if (tEl) { tEl.textContent = type === "ox" ? "Benar / Salah" : type === "fill" ? "Isian" : "Pilihan Ganda"; tEl.dataset.type = type; }
    $("raceq-q").textContent = Q.q;
    $("raceq-status").textContent = "";
    const box = $("raceq-body"); box.innerHTML = "";
    box.classList.toggle("ox", type === "ox");
    if (type === "fill") {
      const inp = document.createElement("input");
      inp.id = "raceq-in"; inp.maxLength = 60; inp.placeholder = "Ketik jawaban..."; inp.autocomplete = "off";
      inp.className = "raceq-input";
      const row = document.createElement("div"); row.className = "raceq-row";
      const hb = document.createElement("button"); hb.type = "button"; hb.className = "btn ghost"; hb.textContent = "Hint";
      hb.onclick = () => { $("raceq-status").textContent = Q.hint ? "💡 " + Q.hint : "💡 Pikirkan baik-baik!"; $("raceq-status").style.color = "#b45309"; sfx("click"); };
      const sb = document.createElement("button"); sb.type = "button"; sb.className = "btn primary"; sb.textContent = "Submit";
      const go = () => submitRaceFill();
      sb.onclick = go;
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); go(); } });
      row.appendChild(hb); row.appendChild(sb);
      box.appendChild(inp); box.appendChild(row);
      setTimeout(() => { try { inp.focus(); } catch (_) {} }, 50);
    } else if (type === "ox") {
      (Q.opts || ["Benar", "Salah"]).forEach((op, k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = k === 0 ? "O" : "X";
        b.classList.add(k === 0 ? "ox-o" : "ox-x");
        b.onclick = () => { box.querySelectorAll("button").forEach((x) => x.classList.remove("picked")); b.classList.add("picked"); R.pick = k; };
        box.appendChild(b);
      });
      const row = document.createElement("div"); row.className = "raceq-row"; row.style.width = "100%";
      const sb = document.createElement("button"); sb.type = "button"; sb.className = "btn primary"; sb.textContent = "Submit";
      sb.onclick = () => { if (R.pick == null) { $("raceq-status").textContent = "Pilih O atau X dulu."; $("raceq-status").style.color = "#b45309"; return; } answerRaceMC(R.pick); };
      row.appendChild(sb); box.appendChild(row);
      R.pick = null;
    } else {
      const opts = Q.opts || [];
      opts.forEach((op, k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = op;
        b.onclick = () => { box.querySelectorAll("button.opt").forEach((x) => x.classList.remove("picked")); b.classList.add("picked"); R.pick = k; };
        b.classList.add("opt");
        box.appendChild(b);
      });
      const row = document.createElement("div"); row.className = "raceq-row";
      const sb = document.createElement("button"); sb.type = "button"; sb.className = "btn primary"; sb.textContent = "Submit";
      sb.onclick = () => { if (R.pick == null) { $("raceq-status").textContent = "Pilih jawaban dulu."; $("raceq-status").style.color = "#b45309"; return; } answerRaceMC(R.pick); };
      row.appendChild(sb); box.appendChild(row);
      R.pick = null;
    }
    $("raceq").classList.remove("hidden");
  }
  function closeRacePopup() {
    const R = S.race; if (!R) return;
    R.popupOpen = false; R.popupGi = -1;
    const rq = $("raceq"); if (rq) rq.classList.add("hidden");
  }
  function raceLockButtons(lock) {
    [...$("raceq-body").children].forEach((el) => {
      if (el.tagName === "BUTTON") el.disabled = lock;
      else if (el.tagName === "DIV") [...el.children].forEach((c) => { if (c.tagName === "BUTTON") c.disabled = lock; });
      else if (el.tagName === "INPUT") el.disabled = lock;
    });
  }
  function raceRecord(gi, givenText) {
    try {
      const R = S.race;
      const qi = R.qmap[gi];
      const qid = EDU_QIDS[qi];
      if (qid && givenText != null && String(givenText) !== "") EDU_ANSWERS[qid] = String(givenText);
    } catch (_) {}
  }
  function answerRaceMC(k) {
    const R = S.race; if (!R || !R.popupOpen) return;
    if (Date.now() < R.retryUntil) return;
    const gi = R.popupGi;
    const Q = raceQuestion(gi); if (!Q) return;
    const ok = k === Q.answer;
    [...$("raceq-body").querySelectorAll("button.opt, button.ox-o, button.ox-x")].forEach((b, idx) => {
      b.disabled = true;
      if (ok && idx === Q.answer) b.classList.add("right");
      if (idx === k && !ok) b.classList.add("wrong");
    });
    if (ok) {
      raceRecord(gi, Q.opts[k]);
      showRaceResult(gi + 1, true);
      raceOpenGate(gi);
    } else {
      R.retryUntil = Date.now() + RACE_RETRY_MS;
      showRaceResult(gi + 1, false);
      $("raceq-status").textContent = "❌ Salah! Coba lagi...";
      $("raceq-status").style.color = "#dc2626";
      sfx("wrong");
      setTimeout(() => {
        if (S.race && S.race.popupOpen && S.race.popupGi === gi) {
          [...$("raceq-body").children].forEach((b) => { if (b.tagName === "BUTTON") { b.disabled = false; b.classList.remove("wrong", "picked", "right"); } });
          R.pick = null;
          $("raceq-status").textContent = "";
        }
      }, RACE_RETRY_MS);
    }
  }
  function submitRaceFill() {
    const R = S.race; if (!R || !R.popupOpen) return;
    if (Date.now() < R.retryUntil) return;
    const gi = R.popupGi;
    const Q = raceQuestion(gi); if (!Q || (Q.type || "mc") !== "fill") return;
    const inp = document.getElementById("raceq-in");
    const v = inp ? inp.value : "";
    if (!String(v).trim()) { $("raceq-status").textContent = "Isi jawaban dulu ya."; $("raceq-status").style.color = "#b45309"; return; }
    const ok = normAns(v) === normAns(Q.text);
    raceLockButtons(true);
    if (ok) {
      raceRecord(gi, v);
      showRaceResult(gi + 1, true);
      raceOpenGate(gi);
    } else {
      R.retryUntil = Date.now() + RACE_RETRY_MS;
      showRaceResult(gi + 1, false);
      $("raceq-status").textContent = "❌ Belum tepat. Coba lagi!";
      $("raceq-status").style.color = "#dc2626";
      sfx("wrong");
      setTimeout(() => {
        if (S.race && S.race.popupOpen && S.race.popupGi === gi) { raceLockButtons(false); $("raceq-status").textContent = ""; }
      }, RACE_RETRY_MS);
    }
  }
  function showRaceResult(n, ok) {
    const el = $("race-result"); if (!el) return;
    $("race-result-n").textContent = n;
    $("race-result-t").textContent = ok ? "Jawaban benar!" : "Jawaban salah";
    $("race-result-n").style.color = ok ? "#4ade80" : "#f87171";
    el.classList.remove("hidden");
    clearTimeout(S.raceResT);
    S.raceResT = setTimeout(() => el.classList.add("hidden"), 1600);
  }
  function raceOpenGate(gi) {
    const R = S.race; if (!R || !S.me) return;
    if ((R.prog[S.me.id] || 0) !== gi) { closeRacePopup(); return; }
    R.prog[S.me.id] = gi + 1;
    S.me.score += RACE_OPEN_PTS;
    bumpProgress({ correct: 1, points: RACE_OPEN_PTS, streak: (S.race && S.race.streak) || 0 });
    $("raceq-status").textContent = `🔓 Terbuka! +${RACE_OPEN_PTS} — lari!`;
    $("raceq-status").style.color = "#159A70";
    sfx("correct");
    raceProgSync();
    const done = gi + 1 >= R.K;
    setTimeout(() => {
      if (!S.race || !S.race.popupOpen || S.race.popupGi !== gi) return;
      closeRacePopup();
      if (!done) toast(`🚪 Gembok ${gi + 1} terbuka!`);
    }, done ? 600 : 900);
  }
  function raceFinishMe() {
    const R = S.race; if (!R || R.iFinished || !S.me) return;
    R.iFinished = true;
    S.me.score += RACE_FIN_PTS;
    bumpProgress({ points: RACE_FIN_PTS, wins: R.finished.length === 0 ? 1 : 0 });
    raceProgSync();
    toast("🏁 Kamu finis! +" + RACE_FIN_PTS);
    sfx("win");
    if (S.solo) {
      if (!R.finished.some((f) => f.id === S.me.id)) R.finished.push({ id: S.me.id, name: S.me.name, at: Date.now() });
      setTimeout(() => { if (S.race === R) hostRaceEnd(); }, 2500); // solo: langsung umumkan setelah pemain finis
    } else {
      send("race_finish", { id: S.me.id, name: S.me.name, at: Date.now() });
    }
  }
  function raceMaybeEnd() {
    const R = S.race; if (!R || R.over || !(S.isHost || S.solo)) return;
    const need = Object.keys(R.lanes).filter((pid) => S.players.has(pid));
    if (need.length && need.every((pid) => R.finished.some((f) => f.id === pid))) hostRaceEnd();
  }
  // ---- gerak balapan: maju sepanjang jalur berkelok, gembok menghentikan ----
  function raceStep(dt, now) {
    const R = S.race; if (!R || !S.me) return;
    const me = S.me;
    const lat = raceOffFor(R, me.id);
    if (R.dist[me.id] == null) R.dist[me.id] = 0;
    const G = raceGeom(R.K);
    if (R.idle) {
      me.moving = false;
      raceSetPos(me, R.dist[me.id], lat);
      const c = racePos(R.dist[me.id], 0);
      S.cam.x = clampCamX(c.x, WORLD.w); S.cam.y = clampCamY(c.y, WORLD.h);
      const rec0 = S.players.get(me.id);
      if (rec0) Object.assign(rec0, { x: me.x, y: me.y, dir: 1, moving: false, score: me.score, zone: -1 });
      refreshHudGate();
      return;
    }
    const opened = R.prog[me.id] || 0;
    const iFin = R.iFinished || R.finished.some((f) => f.id === me.id);
    const RQ = $("raceq");
    const popupOpen = RQ && !RQ.classList.contains("hidden") && R.popupOpen;
    if (iFin) {
      me.moving = false;
      raceSetPos(me, G.finishD + 46, lat);
    } else if (popupOpen) {
      me.moving = false;
      raceSetPos(me, R.frozenD != null ? R.frozenD : R.dist[me.id], lat);
    } else {
      const right = (S.keys["d"] || S.keys["arrowright"] || S.joy.x > 0.3);
      const left = (S.keys["a"] || S.keys["arrowleft"] || S.joy.x < -0.3);
      const v = (right ? 1 : 0) - (left ? 1 : 0);
      me.moving = v !== 0;
      if (v !== 0) R.dist[me.id] = Math.max(0, R.dist[me.id] + v * RACE_RUN * dt);
      if (opened < R.K) {
        const gd = G.gateD[opened];
        if (R.dist[me.id] >= gd - 6) { R.dist[me.id] = gd - 6; me.moving = false; openRacePopup(opened); }
      } else if (R.dist[me.id] >= G.finishD) {
        raceFinishMe();
      }
      raceSetPos(me, R.dist[me.id], lat);
      me.dir = 1;
    }
    const c = racePos(R.dist[me.id], 0);
    S.cam.x = clampCamX(c.x, WORLD.w); S.cam.y = clampCamY(c.y, WORLD.h);
    const rec = S.players.get(me.id);
    if (rec) Object.assign(rec, { x: me.x, y: me.y, dir: 1, moving: me.moving, score: me.score, zone: -1 });
    raceBots(dt);
    // siarkan gerak
    if (!S.solo && S.channel && now - bcastT > 120 && (me.moving || popupOpen)) {
      bcastT = now;
      try { S.channel.send({ type: "broadcast", event: "move", payload: { id: me.id, name: me.name, avatar: me.avatar, color: me.color, look: me.look, x: Math.round(me.x), y: Math.round(me.y), dir: 1, moving: me.moving, zone: -1 } }); } catch (_) {}
    }
    if (!S.solo && S.channel && now - trackT > 5000) { trackT = now; track(); }
  }
  function hostRaceEnd() {
    const R = S.race; if (!R || R.over || !(S.isHost || S.solo)) return;
    R.over = true;
    const fin = [...R.finished].sort((a, b) => a.at - b.at);
    const rest = Object.keys(R.lanes)
      .filter((pid) => !fin.some((f) => f.id === pid))
      .map((pid) => ({ id: pid, dist: R.dist[pid] || 0, prog: R.prog[pid] || 0, score: (S.players.get(pid) || {}).score || 0 }))
      .sort((a, b) => b.dist - a.dist || b.prog - a.prog || b.score - a.score)
      .map((x) => { const p = S.players.get(x.id); return { id: x.id, name: p ? p.name : "pemain" }; });
    const order = [...fin.map((f) => ({ id: f.id, name: f.name })), ...rest];
    send("race_end", { order, at: Date.now() });
    onRaceEnd({ order });
  }
  function onRaceEnd(p) {
    if (!S.race) return;
    S.raceResults = Array.isArray(p.order) ? p.order : [];
    endQuiz();
  }
  function raceBots(dt) {
    const R = S.race; if (!R) return;
    const G = raceGeom(R.K);
    S.players.forEach((p) => {
      if (!p.isBot) return;
      const lat = raceOffFor(R, p.id);
      if (R.dist[p.id] == null) R.dist[p.id] = 0;
      const opened = R.prog[p.id] || 0;
      const st = R.botSt[p.id] || (R.botSt[p.id] = { wait: 1 + Math.random() * 2 });
      if (R.finished.some((f) => f.id === p.id)) { p.moving = false; raceSetPos(p, R.dist[p.id], lat); return; }
      if (opened >= R.K) {
        if (R.dist[p.id] < G.finishD) { p.moving = true; R.dist[p.id] = Math.min(G.finishD, R.dist[p.id] + 178 * dt); }
        else p.moving = false;
        raceSetPos(p, R.dist[p.id], lat);
        if (R.dist[p.id] >= G.finishD) {
          R.finished.push({ id: p.id, name: p.name, at: Date.now() + Math.random() * 500 });
          raceMaybeEnd();
        }
        return;
      }
      const gd = G.gateD[opened];
      if (R.dist[p.id] < gd - 6) {
        p.moving = true;
        R.dist[p.id] = Math.min(gd - 6, R.dist[p.id] + 176 * dt);
        raceSetPos(p, R.dist[p.id], lat);
        return;
      }
      // di depan gembok: berpikir lalu menjawab
      p.moving = false;
      raceSetPos(p, R.dist[p.id], lat);
      st.wait -= dt;
      if (st.wait > 0) return;
      st.wait = 1.6 + Math.random() * 2.6;
      if (Math.random() < 0.55) {
        R.prog[p.id] = opened + 1;
        p.score += RACE_OPEN_PTS;
        refreshHud(); renderBoard();
      }
    });
  }
  function drawLock(x, y, open) {
    const s = 1;
    ctx.save();
    ctx.shadowColor = "rgba(35,55,40,.28)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.lineWidth = 5 * s; ctx.strokeStyle = "#5c564d"; ctx.lineCap = "round";
    if (!open) {
      ctx.beginPath(); ctx.arc(x, y - 10 * s, 9 * s, Math.PI, 0); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x + 9 * s, y - 12 * s, 9 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    ctx.fillStyle = open ? "#3fca5b" : "#FFD629";
    rr(x - 14 * s, y - 6 * s, 28 * s, 24 * s, 7 * s); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.4)"; rr(x - 10 * s, y - 3 * s, 20 * s, 5 * s, 3 * s); ctx.fill();
    ctx.fillStyle = "#4a443c";
    ctx.beginPath(); ctx.arc(x, y + 2 * s, 3.2 * s, 0, 7); ctx.fill();
    rr(x - 1.6 * s, y + 2 * s, 3.2 * s, 8 * s, 1.5 * s); ctx.fill();
  }
  function raceTrace() {
    const P = racePath();
    ctx.beginPath(); ctx.moveTo(P.pts[0].x, P.pts[0].y);
    for (let i = 1; i < P.pts.length; i++) ctx.lineTo(P.pts[i].x, P.pts[i].y);
  }
  function drawRaceDecor() {
    const inView = (x, y, m) => !(x < S.cam.x - m || x > S.cam.x + VIEW.w + m || y < S.cam.y - m || y > S.cam.y + VIEW.h + m);
    TREES.forEach(([x, y], i) => { if (inView(x, y, 90)) drawTree(x, y, i % 3); });
    ROCKS.forEach(([x, y]) => { if (inView(x, y, 60)) drawRock(x, y); });
    FLOWERS.forEach(([x, y], i) => { if (inView(x, y, 40)) drawFlower(x, y, ["#ff77a9", "#FFD629", "#ff9f68", "#8A63F6"][i % 4]); });
    [[180, 200], [1620, 200], [180, 1140], [1620, 1140], [900, 120], [900, 1220]].forEach(([x, y]) => { if (inView(x, y, 60)) drawBush(x, y); });
    [[220, 320], [1580, 340], [260, 1080], [1560, 1060]].forEach(([x, y]) => { if (inView(x, y, 50)) drawRockPile(x, y); });
    [[700, 180, 0.2], [1150, 1120, -0.25]].forEach(([x, y, a]) => { if (inView(x, y, 50)) drawLog(x, y, a); });
  }
  function drawRaceGate(pos, gi, open, next, now) {
    const nx = -pos.uy, ny = pos.ux;
    // batu besar + gembok (ZEP)
    zShadow(pos.x, pos.y + 22, 32, 12);
    ctx.fillStyle = ZP.rockD; ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 6, 29, 24, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ZP.rock2; ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 2, 27, 22, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ZP.rock1; ctx.beginPath(); ctx.ellipse(pos.x - 3, pos.y - 2, 20, 16, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.42)"; ctx.beginPath(); ctx.ellipse(pos.x - 9, pos.y - 8, 9, 6, -0.4, 0, 7); ctx.fill();
    drawLock(pos.x, pos.y - 4, open);
    if (next) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 240);
      ctx.strokeStyle = "rgba(255,93,143," + (0.25 + pulse * 0.5) + ")"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 2, 40 + pulse * 6, 36 + pulse * 6, 0, 0, 7); ctx.stroke();
    }
    // papan angka kayu di pinggir jalan
    const sx = pos.x + nx * (RACE.road + 42), sy = pos.y + ny * (RACE.road + 42);
    ctx.fillStyle = ZP.woodD; rr(sx - 3, sy - 34, 7, 42, 3); ctx.fill();
    ctx.fillStyle = ZP.wood; rr(sx - 3, sy - 34, 5, 42, 3); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.14)"; rr(sx - 23, sy - 61, 46, 34, 10); ctx.fill();
    ctx.fillStyle = open ? "#8ed16a" : "#e8cf9c"; rr(sx - 22, sy - 63, 44, 32, 9); ctx.fill();
    ctx.fillStyle = "#5b3d22"; ctx.font = "800 18px 'Plus Jakarta Sans',sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(gi + 1), sx, sy - 39);
  }
  function drawRaceFences() {
    const P = racePath(), off = RACE.road + 18;
    ctx.lineCap = "round";
    for (const s of P.segs) {
      for (let t = 0; t <= s.len; t += 64) {
        const x = s.a.x + s.ux * t, y = s.a.y + s.uy * t;
        const nx = -s.uy, ny = s.ux;
        for (const side of [-1, 1]) {
          const px = x + nx * side * off, py = y + ny * side * off;
          if (px < S.cam.x - 40 || px > S.cam.x + VIEW.w + 40 || py < S.cam.y - 40 || py > S.cam.y + VIEW.h + 40) continue;
          ctx.fillStyle = "rgba(46,94,42,.16)"; ctx.beginPath(); ctx.ellipse(px, py + 2, 7, 3, 0, 0, 7); ctx.fill();
          ctx.fillStyle = ZP.fenceLine; rr(px - 5, py - 26, 10, 30, 3); ctx.fill();
          ctx.fillStyle = ZP.fence; rr(px - 4, py - 26, 8, 30, 3); ctx.fill();
          ctx.fillStyle = "rgba(0,0,0,.06)"; rr(px + 1, py - 26, 3, 30, 3); ctx.fill();
        }
      }
    }
  }
  function drawRaceScene(now) {
    const R = S.race; if (!R) return;
    const G = raceGeom(R.K);
    const P = racePath();
    const road = RACE.road;
    // rumput ZEP
    {
      const gg = ctx.createLinearGradient(0, S.cam.y - 30, 0, S.cam.y + VIEW.h + 30);
      gg.addColorStop(0, ZP.grass1); gg.addColorStop(1, ZP.grass2);
      ctx.fillStyle = gg; ctx.fillRect(S.cam.x - 30, S.cam.y - 30, VIEW.w + 60, VIEW.h + 60);
    }
    ctx.fillStyle = "rgba(255,255,255,.06)";
    for (let gx = Math.floor((S.cam.x - 30) / 96) * 96; gx < S.cam.x + VIEW.w + 30; gx += 96)
      for (let gy = Math.floor((S.cam.y - 30) / 96) * 96; gy < S.cam.y + VIEW.h + 30; gy += 96)
        if (((gx + gy) / 96) % 2 === 0) ctx.fillRect(gx, gy, 48, 48);

    // jalur tanah berkelok (ZEP, tanpa outline keras)
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    raceTrace(); ctx.strokeStyle = ZP.dirtEdge; ctx.lineWidth = road * 2 + 16; ctx.stroke();
    raceTrace(); ctx.strokeStyle = ZP.dirt2; ctx.lineWidth = road * 2; ctx.stroke();
    raceTrace(); ctx.strokeStyle = ZP.dirt1; ctx.lineWidth = road * 2 - 14; ctx.stroke();

    drawRaceFences();

    // papan angka + gembok batu tiap gerbang
    const myOpened = R.prog[S.me ? S.me.id : ""] || 0;
    for (let gi = 0; gi < R.K; gi++) {
      const pos = racePointAt(G.gateD[gi]);
      drawRaceGate(pos, gi, gi < myOpened, gi === myOpened, now);
    }

    // garis start (papan catur) + papan kayu
    const s0 = P.segs[0], nx0 = -s0.uy, ny0 = s0.ux;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#5b3d22" : "#fff";
      const t = -road + i * (road * 2 / 6);
      rr(P.pts[0].x + nx0 * t - 8, P.pts[0].y + ny0 * t - 13, 16, 26, 3); ctx.fill();
    }
    const bx = P.pts[0].x, by = P.pts[0].y;
    ctx.fillStyle = "rgba(0,0,0,.14)"; rr(bx - 64, by - road - 60, 128, 32, 9); ctx.fill();
    ctx.fillStyle = "#e8cf9c"; rr(bx - 63, by - road - 62, 126, 32, 9); ctx.fill();
    ctx.fillStyle = "#5b3d22"; ctx.font = "800 16px 'Plus Jakarta Sans',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("START", bx, by - road - 40);

    // garis finis (papan catur) + gapura kayu + podium
    const fp = P.pts[P.pts.length - 1], sN = P.segs[P.segs.length - 1];
    const nxN = -sN.uy, nyN = sN.ux;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#fff" : "#5b3d22";
      const t = -road + i * (road * 2 / 6);
      rr(fp.x + nxN * t - 8, fp.y + nyN * t - 13, 16, 26, 3); ctx.fill();
    }
    [-1, 1].forEach((s) => {
      ctx.fillStyle = ZP.woodD; rr(fp.x + s * 66 - 7, fp.y - road - 80, 14, 94, 6); ctx.fill();
      ctx.fillStyle = ZP.wood; rr(fp.x + s * 66 - 5, fp.y - road - 80, 10, 94, 6); ctx.fill();
    });
    ctx.fillStyle = "rgba(0,0,0,.14)"; rr(fp.x - 76, fp.y - road - 96, 152, 36, 10); ctx.fill();
    ctx.fillStyle = "#e8cf9c"; rr(fp.x - 74, fp.y - road - 98, 148, 34, 10); ctx.fill();
    ctx.fillStyle = "#5b3d22"; ctx.font = "800 17px 'Plus Jakarta Sans',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("FINISH", fp.x, fp.y - road - 75);
    ctx.font = "40px sans-serif"; ctx.fillText("🏆", fp.x, fp.y - 6);

    drawRaceDecor();
    void now;
  }
  function bunnySpot() {
    for (let t = 0; t < 20; t++) {
      const x = 120 + Math.random() * (WORLD.w - 240);
      const y = 200 + Math.random() * (WORLD.h - 320);
      if (collide(x, y)) continue;
      let ok = true;
      S.players.forEach((p) => { if (Math.hypot(p.x - x, p.y - y) < 220) ok = false; });
      if (ok) return [x, y];
    }
    return [800, 620];
  }
  function hostChase(i) {
    if (!(S.isHost || S.solo)) return;
    const [bx, by] = bunnySpot();
    S.bunny.x = bx; S.bunny.y = by; S.bunny.wx = bx; S.bunny.wy = by; S.bunny.wt = 0; S.bunny.active = true;
    send("quiz_chase", { index: i, bx: Math.round(bx), by: Math.round(by), questions: stripQ(QUESTIONS), quiz: EDU_QUIZ, qids: EDU_QIDS, mode: S.mode });
    onChase(i, bx, by);
  }
  function onChase(i, bx, by) {
    stopQuizLocal();
    S.quiz = { phase: "chase", qIndex: i, holder: null, correct: -1, pick: -1, releases: 0, duelEndsAt: 0, timerInt: 0 };
    S.bunny.x = bx; S.bunny.y = by; S.bunny.tx = bx; S.bunny.ty = by; S.bunny.wx = bx; S.bunny.wy = by; S.bunny.wt = 0; S.bunny.active = true;
    S.mode = "chase"; syncModeUI();
    $("podium").classList.add("hidden");
    $("board").classList.add("hidden");
    $("q-banner").classList.add("hidden");
    $("duel").classList.add("hidden");
    toast(`🐇 Soal ${i + 1}/${QUESTIONS.length}: kejar kelincinya!`);
    sfx("go");
    if (S.solo) {
      // bot ikut mengejar dengan kecepatan wajar
      S.players.forEach((p) => {
        if (!p.isBot) return;
        p.wt = 0; p.wx = bx; p.wy = by;
        p.chaseDelay = 0.4 + Math.random() * 1.6;
      });
      clearTimeout(quizBotT);
      // kalau bot duluan yang dapat: biarkan pemain merebut balik? tidak — duel milik bot, simulasikan jawab
      quizBotT = setTimeout(() => {
        if (!S.quiz || S.quiz.phase !== "chase" || !S.bunny.active) return;
        const bots = [...S.players.values()].filter((p) => p.isBot && !(S.rules.survival && p.dead));
        if (!bots.length) return;
        const Q = QUESTIONS[i];
        const holder = bots[Math.floor(Math.random() * bots.length)];
        const correct = Q && typeof Q.answer === "number" ? Q.answer : 0;
        const okBot = Math.random() < 0.5;
        lockChase(i, { id: holder.id, name: holder.name });
        setTimeout(() => {
          if (!S.quiz || S.quiz.phase !== "duel") return;
          resolveDuel(i, okBot ? correct : (correct + 1 + Math.floor(Math.random() * 3)) % Math.max(1, Q.opts.length), holder.id, false);
        }, 1500 + Math.random() * 2000);
      }, 9000 + Math.random() * 6000);
    }
  }
  function lockChase(i, holder) {
    const qz = S.quiz;
    if (!qz || qz.phase !== "chase" || qz.qIndex !== i) return;
    qz.phase = "duel"; qz.holder = holder; qz.pick = -1;
    qz.duelEndsAt = Date.now() + DUEL_MS;
    S.bunny.active = false;
    const mine = holder.id === (S.me && S.me.id);
    openDuel(i, holder, mine);
    sfx("catch");
    toast(mine ? "🐇 Kamu menangkap kelinci! Jawab cepat!" : `🐇 ${holder.name} menangkap kelinci!`);
    if (S.isHost || S.solo) {
      clearInterval(qz.timerInt);
      qz.timerInt = setInterval(() => {
        const left = Math.ceil((qz.duelEndsAt - Date.now()) / 1000);
        $("duel-timer").textContent = Math.max(0, left);
        if (left <= 0) releaseChase(i, "timeout");
      }, 250);
    }
  }
  function openDuel(i, holder, mine) {
    const Q = QUESTIONS[i]; if (!Q) return;
    $("duel").classList.remove("hidden");
    $("duel-who").textContent = `🐇 ${holder.name} menjawab · Soal ${i + 1}/${QUESTIONS.length}`;
    $("duel-q").textContent = Q.q;
    $("duel-timer").textContent = Math.ceil(DUEL_MS / 1000);
    $("duel-status").textContent = mine ? "Pilih jawabanmu, cepat!" : "Tonton... kalau salah, kelinci lepas lagi!";
    $("duel-status").style.color = "#374151";
    const box = $("duel-opts"); box.innerHTML = "";
    Q.opts.forEach((op, k) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = `${"ABCD"[k]}. ${op}`;
      b.disabled = !mine;
      b.onclick = () => {
        if (!mine) return;
        answerDuel(k);
      };
      box.appendChild(b);
    });
  }
  function answerDuel(k) {
    const qz = S.quiz;
    if (!qz || qz.phase !== "duel" || !qz.holder || qz.holder.id !== (S.me && S.me.id)) return;
    qz.pick = k;
    [...$("duel-opts").children].forEach((b, idx) => { b.disabled = true; if (idx === k) b.classList.add("picked"); });
    $("duel-status").textContent = "Terkunci! Menunggu hasil...";
    sfx("click");
    if (S.solo || S.isHost) {
      // penangkap = host: nilai langsung
      resolveDuel(qz.qIndex, k, S.me.id, true);
    } else {
      send("duel_pick", { index: qz.qIndex, holderId: S.me.id, pick: k, at: Date.now() });
    }
  }
  function onClaim(p) {
    // hanya host yang memutuskan; klaim pertama menang
    if (!S.quiz || S.quiz.phase !== "chase" || !S.bunny.active) return;
    const i = S.quiz.qIndex;
    if (typeof p.index === "number" && p.index !== i) return; // klaim untuk soal lain (basi)
    if (typeof p.id !== "string" || !p.id) return;
    const rec = S.players.get(p.id);
    if (!rec) return; // bukan pemain di room ini
    if (S.rules.survival && rec.dead) return; // hantu tidak boleh menangkap kelinci
    // validasi jarak (server-side): klaim harus dekat kelinci
    if (typeof p.x === "number" && typeof p.y === "number") {
      if (Math.hypot(p.x - S.bunny.x, p.y - S.bunny.y) > CATCH_R + 80) return;
    }
    lockChase(i, { id: p.id, name: p.name });
    send("chase_lock", { index: i, holderId: p.id, holderName: p.name, duelEndsAt: S.quiz.duelEndsAt });
  }
  function onChaseLock(i, holderId, holderName, duelEndsAt) {
    if (S.isHost || S.solo) return; // host sudah lock sendiri
    const qz = S.quiz;
    if (!qz) return;
    qz.phase = "duel"; qz.qIndex = i; qz.holder = { id: holderId, name: holderName }; qz.pick = -1; qz.duelEndsAt = duelEndsAt;
    S.bunny.active = false;
    openDuel(i, qz.holder, holderId === (S.me && S.me.id));
    clearInterval(qz.timerInt);
    qz.timerInt = setInterval(() => {
      const left = Math.ceil((duelEndsAt - Date.now()) / 1000);
      $("duel-timer").textContent = Math.max(0, left);
    }, 250);
  }
  // non-host yang memegang duel mengirim pick, host menilai
  function onDuelPick(p) {
    const qz = S.quiz;
    if (!qz || qz.phase !== "duel" || qz.qIndex !== p.index) return;
    if (!qz.holder || qz.holder.id !== p.holderId) return;
    resolveDuel(p.index, p.pick, p.holderId, false);
  }
  function releaseChase(i, reason) {
    if (!S.quiz || S.quiz.qIndex !== i) return;
    if (!(S.isHost || S.solo)) return;
    const [bx, by] = bunnySpot();
    S.bunny.x = bx; S.bunny.y = by; S.bunny.wx = bx; S.bunny.wy = by; S.bunny.active = true;
    send("chase_release", { index: i, bx: Math.round(bx), by: Math.round(by), reason });
    onChaseRelease(i, bx, by, reason);
    // duel berikutnya: biarkan pemain lain merebut; bot solo ikut lagi
    if (S.solo) {
      clearTimeout(quizBotT);
      quizBotT = setTimeout(() => {
        if (!S.quiz || S.quiz.phase !== "chase") return;
        const bots = [...S.players.values()].filter((p) => p.isBot && !(S.rules.survival && p.dead));
        if (!bots.length) return;
        const holder = bots[Math.floor(Math.random() * bots.length)];
        lockChase(i, { id: holder.id, name: holder.name });
        const Q = QUESTIONS[i];
        const correct = Q && typeof Q.answer === "number" ? Q.answer : 0;
        setTimeout(() => {
          if (S.quiz && S.quiz.phase === "duel") resolveDuel(i, Math.random() < 0.5 ? correct : (correct + 1) % Math.max(1, Q.opts.length), holder.id, false);
        }, 2000);
      }, 6000 + Math.random() * 5000);
    }
  }
  function onChaseRelease(i, bx, by, reason) {
    const qz = S.quiz;
    if (!qz || qz.qIndex !== i) return;
    clearInterval(qz.timerInt);
    qz.phase = "chase"; qz.holder = null; qz.pick = -1; qz.releases = (qz.releases || 0) + 1;
    S.bunny.x = bx; S.bunny.y = by; S.bunny.wx = bx; S.bunny.wy = by; S.bunny.active = true;
    $("duel").classList.add("hidden");
    if (reason === "timeout") { toast("⏰ Waktu duel habis — kelinci lepas lagi! Kejar!"); sfx("wrong"); }
    else if (reason === "wrong") { toast("❌ Salah! Kelinci lepas lagi — rebut!"); sfx("wrong"); }
    else toast("🐇 Kelinci lepas! Kejar lagi!");
  }
  function resolveDuel(i, pick, holderId, fromSelf) {
    const qz = S.quiz;
    if (!qz || qz.phase !== "duel" || qz.qIndex !== i) return;
    if (!(S.isHost || S.solo)) return;
    clearInterval(qz.timerInt);
    const Q = QUESTIONS[i];
    const correct = Q && typeof Q.answer === "number" ? Q.answer : 0;
    const ok = pick === correct;
    send("duel_result", { index: i, holderId, pick, correct, ok });
    onDuelResult({ index: i, holderId, pick, correct, ok });
  }
  function onDuelResult(r) {
    const qz = S.quiz;
    if (!qz || qz.qIndex !== r.index) return;
    clearInterval(qz.timerInt);
    qz.phase = "reveal"; qz.correct = r.correct;
    const Q = QUESTIONS[r.index];
    const holder = S.players.get(r.holderId);
    const holderName = holder ? holder.name : "pemain";
    const mine = r.holderId === (S.me && S.me.id);
    // tandai opsi di panel duel
    [...$("duel-opts").children].forEach((b, idx) => {
      b.disabled = true;
      if (idx === r.correct) b.classList.add("right");
      if (idx === r.pick && !r.ok) b.classList.add("wrong");
      if (idx === r.pick && r.ok) b.classList.add("picked");
    });
    try {
      const qid = EDU_QIDS[r.index];
      if (mine && qid && Q.opts[r.pick] != null) EDU_ANSWERS[qid] = String(Q.opts[r.pick]);
    } catch (_) {}
    if (r.ok) {
      if (mine) {
        S.streak += 1;
        const pts = 150 + (S.streak - 1) * 20;
        S.me.score += pts;
        bumpProgress({ correct: 1, points: pts, streak: S.streak });
        $("duel-status").textContent = `✅ Benar! +${pts}${S.streak >= 2 ? ` · 🔥 streak x${S.streak}` : ""}`;
        sfx("correct");
      } else {
        $("duel-status").textContent = `✅ ${holderName} benar! +150`;
        if (holder && holder.isBot && S.solo) { holder.score += 150; }
        sfx("reveal");
      }
    } else {
      const ghosted = !!S.rules.survival;
      if (mine) {
        S.streak = 0;
        if (ghosted) markGhost();
        const right = Q.opts[r.correct] != null ? `${"ABCD"[r.correct]}. ${Q.opts[r.correct]}` : "ABCD"[r.correct];
        $("duel-status").textContent = ghosted ? `👻 Salah! Jawaban: ${right} — kamu gugur, kelinci lepas...` : `❌ Salah. Jawaban: ${right} — kelinci akan lepas...`;
        $("duel-status").style.color = ghosted ? "#6d7a71" : "#374151";
        sfx("wrong");
      } else {
        if (ghosted && holder && holder.isBot) holder.dead = true;
        $("duel-status").textContent = ghosted ? `👻 ${holderName} salah — gugur! Kelinci lepas...` : `❌ ${holderName} salah! Kelinci lepas...`;
        sfx("reveal");
      }
    }
    syncScore(); refreshHud(); renderBoard();
    if (S.isHost || S.solo) {
      clearTimeout(S.quizNextT);
      if (r.ok) {
        S.quizNextT = setTimeout(() => nextQuestion(r.index + 1), 2600);
      } else {
        // salah -> kelinci lepas, soal yang SAMA diperebutkan lagi (maks 3x, lalu lanjut)
        S.quizNextT = setTimeout(() => {
          if (S.rules.survival && aliveCount() <= 1) { nextQuestion(r.index + 1); return; }
          const rel = (S.quiz && S.quiz.releases) || 0;
          if (rel >= 2) nextQuestion(r.index + 1);
          else releaseChase(r.index, "wrong");
        }, 2200);
      }
    }
  }
  function doReveal(i, correct) {
    const qz = S.quiz;
    if (!qz || qz.qIndex !== i) return;
    clearInterval(qz.timerInt);
    qz.phase = "reveal"; qz.correct = correct;
    $("quiz-timer").textContent = "✔";
    $("quiz-timer").classList.remove("low");
    const Q = QUESTIONS[i];
    const myPick = S.me ? S.me.zone : -1;
    // catat jawaban teks utk simpan ke Educrazy
    try {
      const qid = EDU_QIDS[i];
      if (qid && myPick >= 0 && Q.opts[myPick] != null) EDU_ANSWERS[qid] = String(Q.opts[myPick]);
    } catch (_) {}
    const meAlreadyDead = S.rules.survival && S.me && S.me.dead;
    if (S.me && !meAlreadyDead) {
      if (myPick === correct) {
        S.streak += 1;
        const speedBonus = Math.max(0, Math.round(((qz.endsAt - (qz.enterT || qz.endsAt)) / 1000) * 5));
        const pts = 100 + speedBonus + (S.streak - 1) * 20;
        S.me.score += pts;
        bumpProgress({ correct: 1, points: pts, streak: S.streak });
        $("quiz-status").textContent = `✅ Benar! +${pts}${S.streak >= 2 ? ` · 🔥 streak x${S.streak}` : ""}${S.rules.team ? ` · ${TEAM_LABEL[teamOf(S.me)]}` : ""}`;
        $("quiz-status").style.color = "#16a34a";
        sfx("correct");
      } else {
        S.streak = 0;
        const right = Q.opts[correct] != null ? `${ZONE_LETTERS[correct]}. ${Q.opts[correct]}` : ZONE_LETTERS[correct];
        if (S.rules.survival) {
          markGhost();
          $("quiz-status").textContent = myPick < 0 ? `👻 Tidak menjawab — gugur! Jawaban: ${right}` : `👻 Gugur! Jawaban: ${right}`;
          $("quiz-status").style.color = "#6d7a71";
        } else {
          $("quiz-status").textContent = myPick < 0 ? `⏰ Kamu tidak masuk zona! Jawaban: ${right}` : `❌ Kurang tepat. Jawaban: ${right}`;
          $("quiz-status").style.color = "#dc2626";
        }
        sfx("wrong");
      }
    }
    sfx("reveal");
    // bots dapat skor
    if (S.solo) {
      S.players.forEach((p) => {
        if (!p.isBot) return;
        if (S.rules.survival && p.dead) return;
        if (p.zone === correct) { p.botStreak = (p.botStreak || 0) + 1; p.score += 100 + (p.botStreak - 1) * 20 + Math.floor(Math.random() * 40); }
        else { p.botStreak = 0; if (S.rules.survival) p.dead = true; }
      });
    }
    syncScore(); refreshHud(); renderBoard();
  }
  function stopQuizLocal() {
    if (S.quiz && S.quiz.timerInt) clearInterval(S.quiz.timerInt);
    clearTimeout(S.quizNextT);
    clearTimeout(quizBotT);
    clearInterval(countInt);
    const sc = $("start-count"); if (sc) { sc.classList.add("hidden"); sc.textContent = ""; }
    S.quiz = null;
    const d = $("duel"); if (d) d.classList.add("hidden");
    const rq0 = $("raceq"); if (rq0) rq0.classList.add("hidden");
    // balapan punya siklus sendiri — jangan dimatikan di sini (endQuiz yang menutupnya)
  }
  function syncScore() {
    const rec = S.players.get(S.me.id);
    if (rec) { rec.score = S.me.score; rec.dead = !!S.me.dead; rec.team = S.me.team; }
    send("score", { id: S.me.id, name: S.me.name, avatar: S.me.avatar, color: S.me.color, look: S.me.look, score: S.me.score, dead: !!S.me.dead });
    if (!S.solo && S.channel) track();
    refreshHud(); renderBoard();
  }
  function endQuiz() {
    // balapan: hitung urutan finis DULU (seperti video), baru bersihkan state
    let order = null;
    if (S.mode === "race" && S.race) {
      if (Array.isArray(S.raceResults) && S.raceResults.length) order = S.raceResults;
      else {
        const R = S.race;
        const fin = [...R.finished].sort((a, b) => a.at - b.at);
        const rest = Object.keys(R.lanes)
          .filter((pid) => !fin.some((f) => f.id === pid))
          .map((pid) => ({ id: pid, prog: R.prog[pid] || 0, score: (S.players.get(pid) || {}).score || 0 }))
          .sort((a, b) => b.prog - a.prog || b.score - a.score)
          .map((x) => { const p = S.players.get(x.id); return { id: x.id, name: p ? p.name : "pemain" }; });
        order = [...fin.map((f) => ({ id: f.id, name: f.name })), ...rest];
      }
    }
    stopQuizLocal();
    S.bunny.active = false;
    if (S.race) { try { clearInterval(S.race.timerInt); } catch (_) {} }
    S.race = null; S.raceResults = null;
    restoreWorld();
    $("q-banner").classList.add("hidden");
    $("duel").classList.add("hidden");
    const rqE = $("raceq"); if (rqE) rqE.classList.add("hidden");
    const gtE = $("ghost-timer"); if (gtE) gtE.classList.add("hidden");
    S.ghostT = 0;
    const ol = $("podium-list"); ol.innerHTML = "";
    const medals = ["🥇", "🥈", "🥉"];
    if (order) {
      order.forEach((o, i) => {
        const p = S.players.get(o.id);
        const li = document.createElement("li");
        li.textContent = `${medals[i] || `${i + 1}.`} ${p ? p.avatar + " " : ""}${o.name} — ${p ? p.score || 0 : ""}`;
        ol.appendChild(li);
      });
    } else {
      if (S.rules.team) {
        [0, 1].forEach((t) => {
          const li = document.createElement("li");
          li.style.fontWeight = "800"; li.style.color = TEAM_COLOR[t];
          li.textContent = `${TEAM_LABEL[t]} — ${teamScore(t)}`;
          ol.appendChild(li);
        });
      }
      const rank = [...S.players.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
      rank.forEach((p, i) => {
        const li = document.createElement("li");
        const dead = S.rules.survival && p.dead ? " 👻" : "";
        const tag = S.rules.team ? ` [${TEAM_LABEL[teamOf(p)]}]` : "";
        li.textContent = `${medals[i] || `${i + 1}.`} ${p.avatar} ${p.name}${dead}${tag} — ${p.score || 0}`;
        ol.appendChild(li);
      });
    }
    if (S.mode === "race" && order && order[0]) {
      const h = document.querySelector("#podium h3");
      if (h) h.textContent = `🎉 ${order[0].name} WIN!`;
    }
    $("podium").classList.remove("hidden");
    $("host-panel").classList.add("hidden");
    $("btn-again").classList.toggle("hidden", !(S.isHost || S.solo));
    const sv2 = $("btn-save-edu");
    if (sv2) sv2.classList.toggle("hidden", !EDU_QUIZ);
    if (S.rules.team && !order) {
      const t0 = teamScore(0), t1 = teamScore(1);
      const winT = t0 === t1 ? -1 : (t0 > t1 ? 0 : 1);
      const h = document.querySelector("#podium h3");
      if (h) h.textContent = winT < 0 ? "🎉 Hasil Akhir — Seri" : `🎉 ${TEAM_LABEL[winT]} menang!`;
      toast(winT < 0 ? "🤝 Seri!" : (winT === teamOf(S.me) ? `🎉 Tim ${TEAM_LABEL[winT]} menang! 👑` : `🏆 Tim ${TEAM_LABEL[winT]} menang`));
      sfx("win");
      refreshHud(); renderBoard(); renderRoom();
      return;
    }
    const win = order ? order.map((o) => S.players.get(o.id)).find((p) => p) : [...S.players.values()].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    if (win) { toast(win.id === (S.me && S.me.id) ? "🎉 Kamu menang! 👑" : `🏆 Pemenang: ${win.name}`); sfx("win"); }
    else sfx("win");
    refreshHud(); renderBoard(); renderRoom();
  }

  /* ================= simpan nilai ke Educrazy ================= */
  function scoreFromAnswers(qs) {
    let score = 0, max = 0, hasEssay = false;
    qs.forEach((q) => {
      max += Number(q.points) || 0;
      if (q.qtype === "essay") { hasEssay = true; return; }
      const given = EDU_ANSWERS[q.id];
      if (String(given || "").trim().toLowerCase() === String(q.answer || "").trim().toLowerCase()) score += Number(q.points) || 0;
    });
    return { score, max, hasEssay };
  }
  async function saveToEducrazy() {
    if (!EDU_QUIZ) { toast("Tidak ada quiz Educrazy terkait."); return; }
    const btn = $("btn-save-edu");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Menyimpan..."; }
    try {
      try {
        const sb = sbClient();
        const { data: sess } = await sb.auth.getSession();
        if (sess && sess.session) {
          const me = sess.session.user;
          const { data: prof } = await sb.from("profiles").select("id,role").eq("id", me.id).maybeSingle();
          if (!prof) throw new Error("Profil tidak ditemukan.");
          if (prof.role !== "siswa") { toast("Hanya akun siswa yang bisa menyimpan nilai."); return; }
          const { data: qs, error: qe } = await sb.from("quiz_questions").select("*").eq("quiz_id", EDU_QUIZ.id);
          if (qe) throw qe;
          const { score, max, hasEssay } = scoreFromAnswers(qs || []);
          const { error: ue } = await sb.from("quiz_attempts").upsert(
            { quiz_id: EDU_QUIZ.id, user_id: me.id, answers: EDU_ANSWERS, score, max_score: max, status: hasEssay ? "pending" : "graded" },
            { onConflict: "quiz_id,user_id" }
          );
          if (ue) throw ue;
          toast("✅ Nilai tersimpan: " + score + "/" + max);
          if (btn) btn.classList.add("hidden");
          return;
        }
      } catch (e) {
        if (!localStorage.getItem(EDU_KEY)) { toast("Gagal menyimpan: " + (e.message || e)); return; }
      }
      let db;
      try { db = JSON.parse(localStorage.getItem(EDU_KEY) || "null"); } catch (_) { db = null; }
      if (!db) { toast("DB Educrazy tidak ditemukan di browser ini."); return; }
      const sid = localStorage.getItem(EDU_SESSION);
      const me2 = sid && (db.users || []).find((u) => u.id === sid);
      if (!me2) { toast("Login dulu di Educrazy (tab yang sama), lalu klik simpan lagi."); return; }
      if (me2.role !== "siswa") { toast("Hanya akun siswa yang bisa menyimpan nilai."); return; }
      const qs2 = (db.quiz_questions || []).filter((q) => q.quiz_id === EDU_QUIZ.id);
      const { score, max } = scoreFromAnswers(qs2);
      const uid2 = "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      db.quiz_attempts = db.quiz_attempts || [];
      const ix = db.quiz_attempts.findIndex((a) => a.quiz_id === EDU_QUIZ.id && a.user_id === me2.id);
      const row = { id: ix >= 0 ? db.quiz_attempts[ix].id : uid2, quiz_id: EDU_QUIZ.id, user_id: me2.id, answers: EDU_ANSWERS, score, max_score: max, status: "graded", feedback: "Via EC Games multiplayer", graded_by: "", started_at: new Date().toISOString(), submitted_at: new Date().toISOString() };
      if (ix >= 0) db.quiz_attempts[ix] = row; else db.quiz_attempts.push(row);
      db.reward_transactions = db.reward_transactions || [];
      const has = (t, s) => db.reward_transactions.some((x) => x.user_id === me2.id && x.type === t && x.source === s && String(x.source_id || "") === String(EDU_QUIZ.id));
      const bal = (t) => db.reward_transactions.filter((x) => x.user_id === me2.id && x.type === t).reduce((s, x) => s + (Number(x.amount) || 0), 0);
      if (!has("poin", "quiz")) db.reward_transactions.push({ id: uid2 + "p", user_id: me2.id, type: "poin", amount: 10, balance_after: bal("poin") + 10, source: "quiz", source_id: EDU_QUIZ.id, metadata: { score }, created_at: new Date().toISOString() });
      if (!has("xp", "quiz")) db.reward_transactions.push({ id: uid2 + "x", user_id: me2.id, type: "xp", amount: 20, balance_after: bal("xp") + 20, source: "quiz", source_id: EDU_QUIZ.id, metadata: { score }, created_at: new Date().toISOString() });
      try { localStorage.setItem(EDU_KEY, JSON.stringify(db)); } catch (_) { toast("Gagal menyimpan: penyimpanan penuh."); return; }
      toast("✅ Nilai tersimpan: " + score + "/" + max + " +10 poin +20 XP");
      if (btn) btn.classList.add("hidden");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "💾 Simpan Nilai ke Educrazy"; }
    }
  }
  $("btn-save-edu").onclick = saveToEducrazy;

  /* ================= boot ================= */
  buildWardrobe();
  const nameField = $("in-name");
  if (nameField) nameField.addEventListener("input", updateLookName);
  syncRulesUI();
  show("lobby");
  resizeCanvas();
  requestAnimationFrame(loop);
  setInterval(refreshHud, 1000);
  if (urlQuizId) loadEduQuiz().then((ok) => { if (!ok) err("Quiz Educrazy tidak ditemukan / belum ada soal PG. Cek quizId atau gunakan soal bawaan."); });
})();
