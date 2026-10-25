/* =============================================================
   EC Games — Wardrobe & chibi character renderer
   Prosedural (tanpa file gambar): satu karakter digambar dari
   konfigurasi "look" pilihan pemain. Dipakai di join screen
   (preview) dan di canvas permainan (drawPlayer).
   ============================================================= */
(function () {
  "use strict";

  const SKINS = ["#F8D9B8", "#EFC29A", "#DDA276", "#C07E4E", "#8A5A34"];
  const HAIRCOLORS = ["#201B16", "#4B2E1E", "#8B4513", "#D9A441", "#C0392B", "#6D4BC7", "#E9E4DA"];
  const OUTFITCOLORS = ["#FFD629", "#FF5D8F", "#39D353", "#43D0C4", "#8A63F6", "#3998F4", "#FF7569", "#151515"];
  const PANTS = ["#2F3B4C", "#4B5563", "#7C3AED", "#1F5E3F", "#8B4513"];

  const HAIR = ["pendek", "kuncir", "panjang", "afro", "spiky", "botak", "kepang", "mohawk"];
  const OUTFIT = ["kaos", "kemeja", "hoodie", "gaun", "jersey", "jas"];
  const ACC = ["none", "topi", "mahkota", "beanie", "pita", "kacamata", "headphone", "halo"];
  const EYES = ["normal", "senyum", "kaget", "keren"];
  const BACK = ["none", "jubah", "sayap", "tas", "ekor"];
  const SHOES = ["sneakers", "boots", "sandal", "heels", "none"];

  const LABEL = {
    hair: { pendek: "Pendek", kuncir: "Kuncir", panjang: "Panjang", afro: "Afro", spiky: "Spiky", botak: "Botak", kepang: "Kepang", mohawk: "Mohawk" },
    outfit: { kaos: "Kaos", kemeja: "Kemeja", hoodie: "Hoodie", gaun: "Gaun", jersey: "Jersey", jas: "Jas" },
    acc: { none: "Tanpa", topi: "Topi", mahkota: "Mahkota", beanie: "Beanie", pita: "Pita", kacamata: "Kacamata", headphone: "Headphone", halo: "Halo" },
    eyes: { normal: "Normal", senyum: "Senyum", kaget: "Kaget", keren: "Keren" },
    back: { none: "Tanpa", jubah: "Jubah", sayap: "Sayap", tas: "Tas", ekor: "Ekor" },
    shoes: { sneakers: "Sneakers", boots: "Boots", sandal: "Sandal", heels: "Hak", none: "Telanjang" },
  };

  const EMOJI = { pendek: "🧑", kuncir: "👧", panjang: "👩", afro: "🧑‍🦱", spiky: "👦", botak: "🧑‍🦲", kepang: "🧑‍🦰", mohawk: "🧑‍🎤" };

  const COLOR_NAMES = {
    "#F8D9B8": "Langkir", "#EFC29A": "Cerah", "#DDA276": "Sawo matang", "#C07E4E": "Cokelat", "#8A5A34": "Cokelat gelap",
    "#201B16": "Hitam", "#4B2E1E": "Cokelat tua", "#8B4513": "Cokelat", "#D9A441": "Pirang", "#C0392B": "Merah", "#6D4BC7": "Ungu", "#E9E4DA": "Putih",
    "#FFD629": "Kuning", "#FF5D8F": "Pink", "#39D353": "Hijau", "#43D0C4": "Tosca", "#8A63F6": "Ungu", "#3998F4": "Biru", "#FF7569": "Salmon", "#151515": "Hitam",
    "#2F3B4C": "Navy", "#4B5563": "Abu-abu", "#7C3AED": "Ungu", "#1F5E3F": "Hijau tua",
  };

  const TABS = [
    { key: "skin", label: "Kulit", icon: "🎨" },
    { key: "hair", label: "Rambut", icon: "💇", colorKey: "hairColor", colorLabel: "Warna rambut" },
    { key: "outfit", label: "Baju", icon: "👕", colorKey: "outfitColor", colorLabel: "Warna baju" },
    { key: "pants", label: "Celana", icon: "👖" },
    { key: "shoes", label: "Sepatu", icon: "👟" },
    { key: "acc", label: "Aksesori", icon: "🎩" },
    { key: "back", label: "Punggung", icon: "🎒" },
    { key: "eyes", label: "Mata", icon: "👀" },
  ];

  const DEFAULT = {
    skin: SKINS[1], hair: "pendek", hairColor: "#201B16", outfit: "kaos",
    outfitColor: "#43D0C4", pants: PANTS[0], acc: "none", eyes: "normal",
    back: "none", shoes: "sneakers",
  };

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function norm(c) {
    c = c || {};
    return {
      skin: SKINS.indexOf(c.skin) >= 0 ? c.skin : DEFAULT.skin,
      hair: HAIR.indexOf(c.hair) >= 0 ? c.hair : DEFAULT.hair,
      hairColor: HAIRCOLORS.indexOf(c.hairColor) >= 0 ? c.hairColor : DEFAULT.hairColor,
      outfit: OUTFIT.indexOf(c.outfit) >= 0 ? c.outfit : DEFAULT.outfit,
      outfitColor: OUTFITCOLORS.indexOf(c.outfitColor) >= 0 ? c.outfitColor : DEFAULT.outfitColor,
      pants: PANTS.indexOf(c.pants) >= 0 ? c.pants : DEFAULT.pants,
      acc: ACC.indexOf(c.acc) >= 0 ? c.acc : DEFAULT.acc,
      eyes: EYES.indexOf(c.eyes) >= 0 ? c.eyes : DEFAULT.eyes,
      back: BACK.indexOf(c.back) >= 0 ? c.back : DEFAULT.back,
      shoes: SHOES.indexOf(c.shoes) >= 0 ? c.shoes : DEFAULT.shoes,
    };
  }

  function randomLook() {
    return norm({
      skin: pick(SKINS), hair: pick(HAIR), hairColor: pick(HAIRCOLORS),
      outfit: pick(OUTFIT), outfitColor: pick(OUTFITCOLORS), pants: pick(PANTS),
      acc: pick(ACC), eyes: pick(EYES), back: pick(BACK), shoes: pick(SHOES),
    });
  }
  const hairColorHex = (c) => (typeof c === "number" ? (HAIRCOLORS[c] || HAIRCOLORS[0]) : (HAIRCOLORS.indexOf(c) >= 0 ? c : HAIRCOLORS[0]));
  const emoji = (c) => EMOJI[norm(c).hair] || "🧑";

  /* ---------- pixel chibi renderer (layered sprites) ---------- */
  const GW = 20, GH = 28; // ukuran grid sprite (pixel)

  function shade(hex, f) {
    let n = String(hex || "#808080").replace("#", "");
    if (n.length === 3) n = n.split("").map((c) => c + c).join("");
    let r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) { r = g = b = 128; }
    const m = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + f))));
    return "#" + [m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function pal(look) {
    const S = look.skin;
    const H = hairColorHex(look.hairColor);
    const O = look.outfitColor;
    return {
      k: "#151515", S, D: shade(S, -0.18),
      H, hh: shade(H, -0.28),
      O, oo: shade(O, -0.22),
      P: look.pants, p: shade(look.pants, -0.2),
      pink: "#FF5D8F", gold: "#FFD629", blue: "#3998F4", purple: "#8A63F6", teal: "#43D0C4",
      green: "#39D353", white: "#FFFCF8", nw: "#EAF2FF", brown: "#B5651D", red: "#C0392B", shoe: "#2B2B2B",
    };
  }

  const _sprites = new Map();
  const spriteKey = (l) => [l.skin, l.hair, l.hairColor, l.outfit, l.outfitColor, l.pants, l.acc, l.eyes, l.back, l.shoes].join("|");

  function buildSprite(look) {
    const cv = document.createElement("canvas"); cv.width = GW; cv.height = GH;
    const g = cv.getContext("2d");
    const P = pal(look);
    const px = (x, y, c) => { if (!c || x < 0 || y < 0 || x >= GW || y >= GH) return; g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    const clr = (x, y) => { if (x < 0 || y < 0 || x >= GW || y >= GH) return; g.clearRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
    const line = (x, y, w, c) => rect(x, y, w, 1, c);
    const vline = (x, y, h, c) => rect(x, y, 1, h, c);
    const box = (x, y, w, h, c) => { rect(x, y, w, h, P.k); if (w > 2 && h > 2) rect(x + 1, y + 1, w - 2, h - 2, c); else rect(x, y, w, h, c); };

    /* punggung (di belakang badan) */
    if (look.back === "jubah") { rect(3, 16, 3, 11, P.red); rect(14, 16, 3, 11, P.red); rect(2, 24, 16, 3, P.red); }
    else if (look.back === "sayap") { rect(1, 12, 3, 10, P.nw); rect(16, 12, 3, 10, P.nw); line(1, 12, 3, P.k); line(16, 12, 3, P.k); }
    else if (look.back === "tas") { box(5, 17, 10, 8, P.purple); rect(8, 14, 1, 3, P.k); rect(11, 14, 1, 3, P.k); }
    else if (look.back === "ekor") { rect(15, 20, 3, 2, P.H); rect(17, 22, 2, 4, P.H); }

    /* kaki + celana */
    box(7, 22, 3, 5, look.pants);
    box(11, 22, 3, 5, look.pants);

    /* sepatu */
    {
      const sc = look.shoes === "boots" ? P.brown : look.shoes === "heels" ? P.red : look.shoes === "sandal" ? P.brown : look.shoes === "none" ? P.S : P.shoe;
      if (look.shoes === "none") { rect(7, 26, 3, 2, P.S); rect(11, 26, 3, 2, P.S); }
      else if (look.shoes === "sandal") { line(6, 26, 4, sc); line(11, 26, 4, sc); line(6, 27, 4, P.k); line(11, 27, 4, P.k); }
      else if (look.shoes === "heels") { rect(6, 26, 4, 2, sc); rect(11, 26, 4, 2, sc); line(6, 27, 4, P.k); line(11, 27, 4, P.k); }
      else if (look.shoes === "boots") { rect(6, 24, 4, 4, sc); rect(11, 24, 4, 4, sc); line(6, 27, 4, P.k); line(11, 27, 4, P.k); }
      else { rect(6, 26, 4, 2, sc); rect(11, 26, 4, 2, sc); line(6, 26, 4, P.k); line(11, 26, 4, P.k); rect(7, 26, 2, 1, P.white); rect(12, 26, 2, 1, P.white); }
    }

    /* torso + lengan + leher (kulit) */
    box(6, 15, 8, 7, P.S);
    box(3, 16, 3, 6, P.S);
    box(14, 16, 3, 6, P.S);
    rect(9, 14, 2, 2, P.S);

    /* rambut belakang */
    if (look.hair === "panjang") { rect(3, 6, 2, 16, P.H); rect(15, 6, 2, 16, P.H); vline(3, 6, 16, P.k); vline(16, 6, 16, P.k); }
    else if (look.hair === "afro") { rect(2, 1, 16, 8, P.H); clr(2, 1); clr(3, 1); clr(16, 1); clr(17, 1); clr(2, 2); clr(17, 2); }
    else if (look.hair === "kuncir") { box(2, 6, 3, 4, P.H); box(15, 6, 3, 4, P.H); }
    else if (look.hair === "kepang") { for (let i = 0; i < 5; i++) { rect(3, 10 + i * 3, 2, 2, P.H); rect(15, 10 + i * 3, 2, 2, P.H); } }

    /* kepala + telinga */
    box(4, 2, 12, 12, P.S);
    clr(4, 2); clr(15, 2); clr(4, 3); clr(15, 3);
    box(2, 6, 2, 3, P.S); box(16, 6, 2, 3, P.S);

    /* wajah */
    const ex1 = 7, ex2 = 11, ey = 8;
    if (look.eyes === "keren") { rect(5, 8, 10, 2, P.k); rect(6, 8, 3, 1, P.blue); rect(11, 8, 3, 1, P.blue); }
    else if (look.eyes === "senyum") { px(ex1, ey + 1, P.k); px(ex1 + 1, ey, P.k); px(ex2 + 1, ey, P.k); px(ex2, ey + 1, P.k); }
    else if (look.eyes === "kaget") { rect(ex1, ey, 2, 2, P.k); rect(ex2, ey, 2, 2, P.k); }
    else { px(ex1, ey, P.k); px(ex1 + 1, ey, P.k); px(ex2, ey, P.k); px(ex2 + 1, ey, P.k); }
    if (look.eyes === "kaget") rect(9, 11, 2, 1, P.k);
    else if (look.eyes === "senyum") { rect(8, 11, 4, 1, P.k); px(8, 12, P.k); px(11, 12, P.k); }
    else rect(9, 11, 2, 1, P.k);
    px(6, 10, shade(P.pink, 0.55)); px(13, 10, shade(P.pink, 0.55));

    /* pakaian (menutup torso + lengan) */
    const oc = look.outfitColor;
    box(6, 15, 8, 7, oc);
    box(3, 16, 3, 6, oc);
    box(14, 16, 3, 6, oc);
    if (look.outfit === "kemeja") { rect(9, 15, 2, 1, P.white); rect(10, 16, 1, 5, P.k); px(9, 16, P.S); }
    else if (look.outfit === "hoodie") { rect(7, 14, 6, 2, shade(oc, -0.12)); rect(8, 19, 4, 2, shade(oc, -0.15)); }
    else if (look.outfit === "gaun") { rect(4, 19, 12, 3, oc); line(4, 19, 12, P.k); line(7, 17, 6, P.white); }
    else if (look.outfit === "jersey") { line(6, 17, 8, P.white); px(10, 19, P.white); }
    else if (look.outfit === "jas") { rect(7, 15, 2, 7, P.white); rect(12, 15, 2, 7, P.white); rect(9, 15, 2, 3, P.S); px(8, 18, P.blue); }
    else { rect(8, 15, 4, 1, shade(oc, 0.18)); }

    /* rambut depan (topi rambut) */
    if (look.hair !== "botak" && look.hair !== "afro") {
      rect(4, 2, 12, 4, P.H);
      line(4, 2, 12, P.k);
      if (look.hair !== "mohawk") { px(9, 5, P.H); px(10, 5, P.H); }
      vline(4, 6, 2, P.H); vline(15, 6, 2, P.H);
    }
    if (look.hair === "afro") { rect(2, 0, 16, 4, P.H); rect(5, 3, 10, 1, P.H); }
    if (look.hair === "spiky") { px(6, 1, P.H); px(8, 0, P.H); px(10, 1, P.H); px(12, 0, P.H); px(14, 1, P.H); }
    if (look.hair === "mohawk") { rect(9, 0, 2, 3, P.H); line(9, 0, 2, P.k); px(9, 3, P.hh); }

    /* aksesori */
    if (look.acc === "topi") { rect(4, 1, 12, 3, P.pink); line(3, 4, 14, P.pink); line(3, 5, 14, P.k); }
    else if (look.acc === "beanie") { rect(4, 0, 12, 4, P.purple); rect(3, 4, 14, 1, P.white); line(3, 5, 14, P.k); }
    else if (look.acc === "mahkota") { rect(6, 2, 8, 1, P.gold); px(6, 1, P.gold); px(9, 0, P.gold); px(13, 1, P.gold); }
    else if (look.acc === "pita") { rect(14, 2, 3, 3, P.pink); px(16, 1, P.pink); px(17, 2, P.pink); }
    else if (look.acc === "kacamata") { rect(5, 8, 4, 1, P.k); rect(11, 8, 4, 1, P.k); px(5, 9, P.k); px(8, 9, P.k); px(11, 9, P.k); px(14, 9, P.k); line(9, 8, 2, P.k); }
    else if (look.acc === "headphone") { line(4, 1, 12, P.blue); box(2, 6, 3, 4, P.blue); box(15, 6, 3, 4, P.blue); }
    else if (look.acc === "halo") { rect(6, 0, 8, 1, P.gold); clr(9, 0); clr(11, 0); px(5, 1, P.gold); px(14, 1, P.gold); }

    return cv;
  }

  function getSprite(look) {
    const key = spriteKey(look);
    let s = _sprites.get(key);
    if (!s) { s = buildSprite(look); _sprites.set(key, s); }
    return s;
  }

  function draw(ctx, lookRaw, x, y, o) {
    o = o || {};
    const look = norm(lookRaw);
    const k = o.k || 2;
    const w = GW * k, h = GH * k;
    const bob = o.moving ? -(Math.abs(Math.sin((o.t || 0) / 100 + x)) * 3) : (Math.sin((o.t || 0) / 520 + x) * 1);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(getSprite(look), Math.round(x - w / 2), Math.round(y + 15 - h + bob), w, h);
    ctx.restore();
  }

  /* preview untuk join screen */
  function drawPreview(canvas, lookRaw) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 132, H = canvas.clientHeight || 168;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const k = Math.max(2, Math.floor((H - 22) / GH));
    const w = GW * k, h = GH * k;
    const feetY = H - 14;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "rgba(21,21,21,.16)";
    ctx.beginPath(); ctx.ellipse(W / 2, feetY + 3, w * 0.34, w * 0.12, 0, 0, 7); ctx.fill();
    ctx.drawImage(getSprite(norm(lookRaw)), Math.round(W / 2 - w / 2), Math.round(feetY - h), w, h);
    ctx.restore();
  }

  /* thumbnail kecil untuk grid wardrobe */
  function drawThumb(canvas, lookRaw, size) {
    if (!canvas) return;
    const W = Math.max(56, Number(size) || 64);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(W * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = W + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    const k = Math.max(2, Math.floor((W - 6) / GH));
    const w = GW * k, h = GH * k;
    const feetY = W - 3;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(getSprite(norm(lookRaw)), Math.round((W - w) / 2), Math.round(feetY - h), w, h);
    ctx.restore();
  }

  /* ---------- wardrobe schema untuk UI ---------- */
  const CATS = [
    { key: "skin", label: "Kulit", kind: "swatch", items: SKINS },
    { key: "hair", label: "Rambut", kind: "label", items: HAIR, names: LABEL.hair },
    { key: "hairColor", label: "Warna rambut", kind: "swatch", items: HAIRCOLORS },
    { key: "outfit", label: "Pakaian", kind: "label", items: OUTFIT, names: LABEL.outfit },
    { key: "outfitColor", label: "Warna baju", kind: "swatch", items: OUTFITCOLORS },
    { key: "pants", label: "Celana", kind: "swatch", items: PANTS },
    { key: "shoes", label: "Sepatu", kind: "label", items: SHOES, names: LABEL.shoes },
    { key: "acc", label: "Aksesori", kind: "label", items: ACC, names: LABEL.acc },
    { key: "back", label: "Punggung", kind: "label", items: BACK, names: LABEL.back },
    { key: "eyes", label: "Mata", kind: "label", items: EYES, names: LABEL.eyes },
  ];

  /* ---------- unlock: item eksklusif dari progres bermain ---------- */
  const LOCKS = {
    "hair:mohawk": { type: "correct", n: 5, label: "Jawab 5 soal benar" },
    "hair:kepang": { type: "correct", n: 15, label: "Jawab 15 soal benar" },
    "outfit:jersey": { type: "points", n: 500, label: "Kumpulkan 500 poin" },
    "outfit:jas": { type: "points", n: 1000, label: "Kumpulkan 1000 poin" },
    "acc:kacamata": { type: "correct", n: 3, label: "Jawab 3 soal benar" },
    "acc:headphone": { type: "wins", n: 1, label: "Menang 1 kali" },
    "acc:halo": { type: "streak", n: 3, label: "Streak 3 beruntun" },
    "back:tas": { type: "points", n: 300, label: "Kumpulkan 300 poin" },
    "back:jubah": { type: "correct", n: 10, label: "Jawab 10 soal benar" },
    "back:sayap": { type: "wins", n: 3, label: "Menang 3 kali" },
    "back:ekor": { type: "streak", n: 5, label: "Streak 5 beruntun" },
    "shoes:boots": { type: "correct", n: 8, label: "Jawab 8 soal benar" },
    "shoes:heels": { type: "wins", n: 2, label: "Menang 2 kali" },
  };
  const PKEY = "ec-progress";
  const DEFAULT_PROGRESS = { correct: 0, points: 0, bestStreak: 0, wins: 0 };
  function loadProgress() {
    try { const raw = localStorage.getItem(PKEY); if (raw) { const p = JSON.parse(raw); return Object.assign({}, DEFAULT_PROGRESS, p || {}); } } catch (_) {}
    return Object.assign({}, DEFAULT_PROGRESS);
  }
  function saveProgress(p) { try { localStorage.setItem(PKEY, JSON.stringify(Object.assign({}, DEFAULT_PROGRESS, p || {}))); } catch (_) {} }
  function lockOf(key, val) { return LOCKS[key + ":" + val] || null; }
  function isUnlocked(key, val, prog) {
    const lk = lockOf(key, val);
    if (!lk) return true;
    prog = prog || loadProgress();
    const have = lk.type === "streak" ? (Number(prog.bestStreak) || 0) : (Number(prog[lk.type]) || 0);
    return have >= lk.n;
  }
  function lockProgress(key, val, prog) {
    const lk = lockOf(key, val);
    if (!lk) return null;
    prog = prog || loadProgress();
    const have = lk.type === "streak" ? (Number(prog.bestStreak) || 0) : (Number(prog[lk.type]) || 0);
    return {
      have: Math.min(have, lk.n),
      need: lk.n,
      label: lk.label,
      pct: Math.min(100, Math.round((have / lk.n) * 100)),
    };
  }

  const KEY = "ec-look";
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return norm(JSON.parse(raw)); } catch (_) {}
    return norm(DEFAULT);
  }
  function save(look) { try { localStorage.setItem(KEY, JSON.stringify(norm(look))); } catch (_) {} }

  window.ECAVATAR = {
    DEFAULT, CATS, TABS, LOCKS, COLOR_NAMES, norm, randomLook, emoji, draw, drawPreview, drawThumb, load, save,
    loadProgress, saveProgress, isUnlocked, lockOf, lockProgress,
    SKINS, HAIR, HAIRCOLORS, OUTFIT, OUTFITCOLORS, ACC, EYES, BACK, SHOES, LABEL,
  };
})();
