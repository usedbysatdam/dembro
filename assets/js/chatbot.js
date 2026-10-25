(function () {
  "use strict";

  if (window.__educrazyChatbot) return;
  window.__educrazyChatbot = true;

  var STORAGE_KEY = "educrazy_chat_history";
  var MAX_HISTORY = 24;
  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  var INTENTS = [
    {
      id: "greeting",
      keywords: [
        "halo",
        "hai",
        "hi",
        "hello",
        "selamat pagi",
        "selamat siang",
        "selamat sore",
        "selamat malam",
      ],
      text: "Hai! Saya asisten Educrazy. Saya bisa bantu soal resource, game edukatif, harga, akun, dan sekolah.",
      links: [
        { label: "Jelajahi resource", href: "resources.html" },
        { label: "Lihat paket", href: "pricing.html" },
      ],
    },
    {
      id: "thanks",
      keywords: [
        "terima kasih",
        "makasih",
        "thanks",
        "thank you",
        "oke terima kasih",
      ],
      text: "Sama-sama! Kalau ada yang lain, tanya saja ya.",
      links: [],
    },
    {
      id: "bye",
      keywords: ["bye", "sampai jumpa", "dadah", "selamat tinggal"],
      text: "Sampai jumpa! Semoga belajarnya menyenangkan.",
      links: [],
    },
    {
      id: "pricing",
      keywords: [
        "harga",
        "biaya",
        "premium",
        "paket",
        "langganan",
        "membership",
        "bayar",
        "tagihan",
        "diskon",
        "gratis",
      ],
      text: "Educrazy punya paket Free dan Premium. Premium bulanan atau tahunan, dan tahunan lebih hemat. Semua detail dan perbandingan fitur ada di halaman Membership.",
      links: [
        { label: "Buka halaman Membership", href: "pricing.html" },
        { label: "Lihat paket sekolah", href: "pricing.html#schools" },
      ],
    },
    {
      id: "school",
      keywords: [
        "sekolah",
        "guru",
        "tim",
        "demo",
        "penjualan",
        "sales",
        "kepala sekolah",
        "pelatihan",
        "lisensi",
      ],
      text: "Untuk kebutuhan sekolah, tim Educrazy bisa membantu pemetaan perangkat, lisensi, dan pelatihan guru. Isi formulir di bagian sekolah agar tim kami menghubungi Anda.",
      links: [{ label: "Hubungi tim sekolah", href: "pricing.html#schools" }],
    },
    {
      id: "games",
      keywords: [
        "game",
        "permainan",
        "kuis",
        "quiz",
        "bermain",
        "main",
        "habitat hop",
        "sight word",
        "multiplication",
        "meteor",
      ],
      text: "Game edukatif ada di perpustakaan resource. Buka Library, lalu filter tipe Game. Contohnya Habitat Hop, Sight Word Safari, dan Multiplication Meteor. Sebagian game bisa dimainkan gratis, sebagian khusus Premium.",
      links: [{ label: "Buka Library", href: "resources.html" }],
    },
    {
      id: "library",
      keywords: [
        "resource",
        "resources",
        "materi",
        "worksheet",
        "lembar kerja",
        "perpustakaan",
        "library",
        "unduh",
        "download",
        "aktivitas",
        "rencana pelajaran",
        "lesson plan",
        "simpan",
      ],
      text: "Perpustakaan resource berisi worksheet, aktivitas, game, dan rencana pelajaran. Anda bisa memfilter berdasarkan kelas, mata pelajaran, dan tipe. Resource yang disimpan masuk ke koleksi akun Anda.",
      links: [{ label: "Jelajahi resource", href: "resources.html" }],
    },
    {
      id: "dashboard",
      keywords: [
        "dashboard",
        "dasbor",
        "progres",
        "progress",
        "kemajuan",
        "koleksi",
        "tersimpan",
        "riwayat",
      ],
      text: "Dasbor menampilkan resource tersimpan dan progres belajar Anda. Anda perlu masuk ke akun terlebih dahulu untuk membukanya.",
      links: [
        { label: "Buka dasbor", href: "dashboard.html" },
        { label: "Masuk", href: "login.html" },
      ],
    },
    {
      id: "account",
      keywords: [
        "login",
        "masuk",
        "akun",
        "daftar",
        "signup",
        "sign up",
        "password",
        "sandi",
        "lupa",
        "email",
      ],
      text: "Anda bisa membuat akun gratis atau masuk dengan akun yang sudah ada. Akun dipakai untuk menyimpan resource dan progres.",
      links: [
        { label: "Masuk", href: "login.html" },
        { label: "Buat akun", href: "signup.html" },
      ],
    },
    {
      id: "ai",
      keywords: [
        "ai",
        "kecerdasan buatan",
        "gemini",
        "educrazy ai",
        "buat kuis",
        "buat gambar",
        "otomatis",
        "generator",
      ],
      text: "Educrazy AI membantu menyusun kuis dan materi dari topik yang Anda ajarkan. Tulis topiknya, lalu sesuaikan hasilnya sebelum dipakai di kelas.",
      links: [
        { label: "Lihat cara kerja AI", href: "index.html#ai" },
        { label: "Coba resource", href: "resources.html" },
      ],
    },
    {
      id: "contact",
      keywords: [
        "kontak",
        "hubungi",
        "bantuan",
        "support",
        "cs",
        "keluhan",
        "kendala",
        "error",
      ],
      text: "Untuk bantuan langsung, hubungi tim kami lewat formulir sekolah atau email yang tertera di footer. Sertakan jenjang kelas dan kendala Anda agar lebih cepat ditangani.",
      links: [{ label: "Hubungi tim Educrazy", href: "pricing.html#schools" }],
    },
    {
      id: "about",
      keywords: [
        "educrazy",
        "apa itu",
        "tentang",
        "platform",
        "situs",
        "website",
        "fitur",
      ],
      text: "Educrazy adalah ruang belajar digital untuk guru dan siswa: perpustakaan resource, game edukatif, alat bantu AI, dan dasbor progres. Semua dirancang agar mudah dipakai di kelas.",
      links: [
        { label: "Kenali Educrazy", href: "index.html" },
        { label: "Jelajahi resource", href: "resources.html" },
      ],
    },
  ];

  var CHIPS = [
    "Apa itu Educrazy?",
    "Berapa biaya Premium?",
    "Bagaimana cara main game?",
  ];

  var FALLBACK = {
    text: "Saya belum yakin dengan pertanyaan itu. Coba tanya soal resource, game, harga, akun, atau kebutuhan sekolah. Untuk hal khusus, tim kami siap membantu.",
    links: [
      { label: "Jelajahi resource", href: "resources.html" },
      { label: "Hubungi tim", href: "pricing.html#schools" },
    ],
  };

  var history = [];
  var queue = [];
  var busy = false;
  var isOpen = false;
  var root;
  var panel;
  var logEl;
  var chipsEl;
  var form;
  var input;
  var launcher;
  var badge;

  function norm(text) {
    return (
      " " +
      String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim() +
      " "
    );
  }

  function hasWord(haystack, needle) {
    var escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|\\s)" + escaped + "(?=\\s|$)").test(haystack);
  }

  function replyFor(raw) {
    var text = norm(raw);
    var best = null;
    var bestScore = 0;

    for (var i = 0; i < INTENTS.length; i++) {
      var intent = INTENTS[i];
      var score = 0;
      for (var k = 0; k < intent.keywords.length; k++) {
        var kw = intent.keywords[k];
        if (hasWord(text, kw)) {
          score += 1 + kw.length / 40;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }

    if (!best) return FALLBACK;
    return { text: best.text, links: best.links || [] };
  }

  function safeHistory() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (m) {
          return (
            m &&
            (m.role === "user" || m.role === "bot") &&
            typeof m.text === "string"
          );
        })
        .slice(-MAX_HISTORY)
        .map(function (m) {
          return {
            role: m.role,
            text: m.text.slice(0, 600),
            links: Array.isArray(m.links)
              ? m.links
                  .filter(function (l) {
                    return (
                      l &&
                      typeof l.label === "string" &&
                      typeof l.href === "string"
                    );
                  })
                  .slice(0, 3)
              : [],
          };
        });
    } catch (err) {
      return [];
    }
  }

  function persist() {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history.slice(-MAX_HISTORY)),
      );
    } catch (err) {
      /* storage penuh atau diblokir */
    }
  }

  function brandIcon(node) {
    node.src = "assets/logo/educrazy-logo.webp";
    node.alt = "";
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function addMessage(msg, save) {
    var row = document.createElement("div");
    row.className = "ecb-msg " + (msg.role === "user" ? "ecb-user" : "ecb-bot");

    if (msg.role !== "user") {
      var avatar = brandIcon(document.createElement("img"));
      avatar.className = "ecb-msg-avatar";
      avatar.width = 26;
      avatar.height = 26;
      row.appendChild(avatar);
    }

    var bubble = document.createElement("div");
    bubble.className = "ecb-bubble";
    bubble.textContent = msg.text;
    (msg.links || []).forEach(function (link) {
      var a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.label;
      if (/^https?:/i.test(link.href)) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      bubble.appendChild(a);
    });

    row.appendChild(bubble);
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;

    if (save !== false) {
      history.push({ role: msg.role, text: msg.text, links: msg.links || [] });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      persist();
    }
  }

  function showTyping() {
    var row = document.createElement("div");
    row.className = "ecb-msg ecb-bot";
    row.setAttribute("data-typing", "true");

    var avatar = brandIcon(document.createElement("img"));
    avatar.className = "ecb-msg-avatar";
    avatar.width = 26;
    avatar.height = 26;

    var bubble = document.createElement("div");
    bubble.className = "ecb-bubble ecb-typing";
    bubble.setAttribute("aria-label", "Asisten sedang menulis");
    bubble.innerHTML = "<i></i><i></i><i></i>";

    row.appendChild(avatar);
    row.appendChild(bubble);
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
    return row;
  }

  function removeTyping(row) {
    if (row && row.parentNode) row.parentNode.removeChild(row);
  }

  function send(text) {
    var clean = String(text || "")
      .trim()
      .slice(0, 280);
    if (!clean) return;

    addMessage({ role: "user", text: clean, links: [] });
    input.value = "";
    input.focus({ preventScroll: true });
    queue.push(clean);
    processQueue();
  }

  function processQueue() {
    if (busy || !queue.length) return;
    busy = true;

    var clean = queue.shift();
    var typing = showTyping();
    var delay = 380 + Math.min(420, clean.length * 8);
    if (reduceMotion) delay = 80;

    window.setTimeout(function () {
      removeTyping(typing);
      var reply = replyFor(clean);
      addMessage({ role: "bot", text: reply.text, links: reply.links });
      busy = false;
      processQueue();
    }, delay);
  }

  function buildChips() {
    CHIPS.forEach(function (label) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ecb-chip";
      chip.textContent = label;
      chip.addEventListener("click", function () {
        send(label);
      });
      chipsEl.appendChild(chip);
    });
  }

  function focusInput() {
    try {
      input.focus({ preventScroll: true });
    } catch (err) {
      input.focus();
    }
  }

  function setOpen(next) {
    if (isOpen === next) return;
    isOpen = next;

    if (isOpen) {
      root.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      launcher.setAttribute("aria-expanded", "true");
      launcher.setAttribute("aria-label", "Tutup chat Educrazy");
      badge.hidden = true;
      logEl.scrollTop = logEl.scrollHeight;
      window.setTimeout(
        function () {
          if (isOpen) focusInput();
        },
        reduceMotion ? 0 : 120,
      );
      return;
    }

    launcher.focus({ preventScroll: true });
    root.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Buka chat Educrazy");
  }

  function build() {
    root = document.createElement("div");
    root.className = "ecb";
    root.setAttribute("data-ecb", "");

    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "ecb-launcher";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "ecb-panel");
    launcher.setAttribute("aria-label", "Buka chat Educrazy");
    launcher.innerHTML =
      '<svg class="ecb-ic-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.4 9.4 0 0 1-3.4-.6L3 21l1.7-5a8.4 8.4 0 0 1-.7-3.5 8.4 8.4 0 0 1 8.4-8.4h.6A8.4 8.4 0 0 1 21 11.5z"/></svg>' +
      '<svg class="ecb-ic-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    badge = document.createElement("span");
    badge.className = "ecb-badge";
    badge.setAttribute("aria-hidden", "true");
    launcher.appendChild(badge);

    panel = document.createElement("section");
    panel.className = "ecb-panel";
    panel.id = "ecb-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "ecb-title");
    panel.setAttribute("aria-hidden", "true");

    panel.innerHTML =
      '<header class="ecb-head">' +
      '<img class="ecb-avatar" src="assets/logo/educrazy-logo.webp" alt="" width="34" height="34" />' +
      '<div class="ecb-head-copy">' +
      '<h2 class="ecb-title" id="ecb-title">Gipsy AI</h2>' +
      '<p class="ecb-status">Balasan otomatis \u00b7 Bahasa Indonesia</p>' +
      "</div>" +
      '<button class="ecb-close" type="button" aria-label="Tutup chat">\u00d7</button>' +
      "</header>" +
      '<div class="ecb-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<div class="ecb-chips"></div>' +
      '<form class="ecb-form" novalidate>' +
      '<label class="ecb-sr" for="ecb-input">Tulis pesan</label>' +
      '<input class="ecb-input" id="ecb-input" type="text" maxlength="280" autocomplete="off" placeholder="Tanya soal fitur Educrazy..." />' +
      '<button class="ecb-send" type="submit" aria-label="Kirim pesan">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
      "</button>" +
      "</form>";

    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    logEl = panel.querySelector(".ecb-log");
    chipsEl = panel.querySelector(".ecb-chips");
    form = panel.querySelector(".ecb-form");
    input = panel.querySelector(".ecb-input");

    logEl.id = "ecb-log";
    input.id = "ecb-input";

    buildChips();

    launcher.addEventListener("click", function () {
      setOpen(!isOpen);
    });

    panel.querySelector(".ecb-close").addEventListener("click", function () {
      setOpen(false);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      send(input.value);
    });

    document.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
      },
      true,
    );

    document.addEventListener("click", function (event) {
      var trigger =
        event.target && event.target.closest
          ? event.target.closest("[data-chat-open]")
          : null;
      if (!trigger) return;
      event.preventDefault();
      setOpen(true);
    });
  }

  function restore() {
    history = safeHistory();
    if (history.length) {
      history.forEach(function (msg) {
        addMessage(msg, false);
      });
      return;
    }
    addMessage(
      {
        role: "bot",
        text: "Hai! Saya asisten Educrazy. Tanya soal resource, game, harga, akun, atau kebutuhan sekolah ya.",
        links: [],
      },
      true,
    );
  }

  function init() {
    if (document.querySelector("[data-ecb]")) return;
    build();
    restore();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
