(function () {
  const $ = UI.$;
  const toast = UI.toast;
  const esc = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /* ---------------- shared helpers ---------------- */

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function fractionHTML(value) {
    const parts = String(value).split("/");
    return `<span class="frac"><b>${parts[0]}</b><i>${parts[1]}</i></span>`;
  }

  const heartSVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.2-4.6-9.2-9.1A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 9.2 5.3C19.2 16.4 12 21 12 21Z"/></svg>';

  const speakerSVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h3l4-4v14l-4-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';

  const starSVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.2 14.7 9l6.3 1-4.6 4.4 1.1 6.3-5.5-3-5.5 3 1.1-6.3L3 9l6.3-1z"/></svg>';

  const clockSVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 1.9"/></svg>';

  const THEME_ICONS = {
    bubbles: "🔤",
    pancakes: "🥞",
    coins: "🪙",
    safari: "🦁",
    ski: "⛷️",
    typing: "🚀",
    meteor: "☄️",
    train: "🚂",
    parade: "🎉",
    habitat: "🌍"
  };

  function hearts(count, total) {
    return Array.from(
      { length: total },
      (_, i) => `<span class="heart ${i < count ? "" : "is-empty"}">${heartSVG}</span>`
    ).join("");
  }

  /* ---------------- audio ---------------- */

  let audioCtx = null;

  function sfx(type) {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === "suspended") audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const presets = {
        pop: [520, 900, 0.18],
        good: [660, 1180, 0.24],
        bad: [200, 90, 0.3],
        coin: [880, 1320, 0.16],
        launch: [300, 1200, 0.24],
        start: [440, 880, 0.2]
      };
      const [start, end, length] = presets[type] || presets.pop;
      osc.type = type === "bad" ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(start, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, end), now + length);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + length + 0.02);
    } catch (error) {
      /* audio is optional */
    }
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      toast("Speech is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  }

  /* ---------------- arcade engine ---------------- */

  class Arcade {
    constructor(resource, config, onRestart) {
      this.resource = resource;
      this.config = config;
      this.onRestart = onRestart;
      this.shell = $("#gameShell");
      this.score = 0;
      this.lives = 3;
      this.timeLeft = config.duration;
      this.ended = false;
      this.frameFn = null;
      this.timers = new Set();
      this.intervals = new Set();
      this.cleanups = [];
      this.raf = null;
      this.lastTs = 0;
      this.render();
    }

    get w() {
      return this.stage.clientWidth;
    }

    get h() {
      return this.stage.clientHeight;
    }

    render() {
      this.shell.innerHTML = `
        <div class="arcade-hud">
          <div class="hud-card hud-score" id="scoreCard">
            <span class="hud-icon">${starSVG}</span>
            <div class="hud-info">
              <small>Score</small>
              <strong id="scoreValue">0</strong>
            </div>
            <div class="hud-goal">
              <small>Goal</small>
              <span id="goalValue">${this.config.goal}</span>
            </div>
          </div>
          <div class="arcade-clock" id="arcadeClock">
            <div class="clock-face">
              <span class="clock-icon">${clockSVG}</span>
              <span class="clock-time" id="timeLeft">${this.timeLeft}s</span>
            </div>
            <div class="arcade-timebar"><i id="timeBar" style="width:100%"></i></div>
          </div>
          <div class="hud-card hud-lives" id="livesCard">
            <span class="hud-icon hud-icon-heart">${heartSVG}</span>
            <div class="hud-info hud-info-end">
              <small>Lives</small>
              <div class="lives" id="livesValue">${hearts(3, 3)}</div>
            </div>
          </div>
        </div>
        <div class="arcade-banner theme-${this.config.theme}" id="arcadeBanner"></div>
        <div class="arcade-stage stage-${this.config.theme}" id="arcadeStage"></div>
        <p class="game-hint">${esc(this.config.instructions)}</p>`;
      this.stage = $("#arcadeStage");
      this.banner = $("#arcadeBanner");
    }

    showStart() {
      const icon = THEME_ICONS[this.config.theme] || "🎮";
      this.stage.innerHTML = `
        <div class="arcade-start">
          <span class="start-emblem" aria-hidden="true">${icon}</span>
          <span class="arcade-start-kicker">${esc(this.config.genre)}</span>
          <h2>${esc(this.resource.title)}</h2>
          <p>${esc(this.config.instructions)}</p>
          <div class="start-stats">
            <div><small>Time</small><strong>${this.config.duration}s</strong></div>
            <div><small>Goal</small><strong>${this.config.goal} pts</strong></div>
            <div><small>Lives</small><strong>3</strong></div>
          </div>
          <div class="arcade-controls">
            <span><strong>${esc(this.config.controlsTitle)}</strong> ${esc(this.config.controls)}</span>
          </div>
          <button class="btn btn-primary btn-lg" type="button" id="arcadeStartBtn">Start game</button>
        </div>`;
      this.setBanner('<span class="banner-hint">Press start to play</span>');
      $("#arcadeStartBtn").addEventListener("click", () => this.start());
    }

    start() {
      sfx("start");
      this.stage.innerHTML = "";
      this.setBanner('<span class="banner-label">Get ready!</span>');
      this.timeLeft = this.config.duration;
      this.updateTime();
      this.timerId = setInterval(() => {
        if (this.ended) return;
        this.timeLeft -= 1;
        this.updateTime();
        if (this.timeLeft <= 0) this.end("time");
      }, 1000);
      this.runFrame();
      this.config.mount(this);
    }

    updateTime() {
      const el = $("#timeLeft");
      const bar = $("#timeBar");
      const clock = $("#arcadeClock");
      if (el) el.textContent = Math.max(0, this.timeLeft) + "s";
      if (bar) bar.style.width = Math.max(0, (this.timeLeft / this.config.duration) * 100) + "%";
      if (clock) clock.classList.toggle("is-low", this.timeLeft <= 10 && !this.ended);
    }

    setBanner(html) {
      if (this.banner) this.banner.innerHTML = html;
    }

    renderLives() {
      const el = $("#livesValue");
      if (el) el.innerHTML = hearts(this.lives, 3);
    }

    addScore(points, x, y) {
      if (this.ended) return;
      this.score += points;
      const el = $("#scoreValue");
      if (el) el.textContent = this.score;
      const card = $("#scoreCard");
      if (card) {
        card.classList.remove("is-bump");
        void card.offsetWidth;
        card.classList.add("is-bump");
      }
      if (typeof x === "number" && typeof y === "number") {
        this.floater(x, y, "+" + points, "score");
      }
    }

    loseLife() {
      if (this.ended) return;
      this.lives = Math.max(0, this.lives - 1);
      this.renderLives();
      const card = $("#livesCard");
      if (card) {
        card.classList.remove("is-hit");
        void card.offsetWidth;
        card.classList.add("is-hit");
      }
      this.shell.classList.remove("is-hit");
      void this.shell.offsetWidth;
      this.shell.classList.add("is-hit");
      sfx("bad");
      if (this.lives <= 0) this.end("lives");
    }

    floater(x, y, text, tone) {
      if (this.ended) return;
      const el = document.createElement("span");
      el.className = "arcade-floater " + (tone || "");
      el.textContent = text;
      el.style.left = x + "px";
      el.style.top = y + "px";
      this.stage.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }

    eventPoint(event) {
      const rect = this.stage.getBoundingClientRect();
      return {
        x: (event.clientX || rect.left + rect.width / 2) - rect.left,
        y: (event.clientY || rect.top + rect.height / 2) - rect.top
      };
    }

    every(ms, fn) {
      const id = setInterval(() => {
        if (!this.ended) fn();
      }, ms);
      this.intervals.add(id);
      return id;
    }

    after(ms, fn) {
      const id = setTimeout(() => {
        this.timers.delete(id);
        if (!this.ended) fn();
      }, ms);
      this.timers.add(id);
      return id;
    }

    addCleanup(fn) {
      this.cleanups.push(fn);
    }

    runFrame() {
      const step = (ts) => {
        if (this.ended) return;
        const dt = Math.min(48, ts - (this.lastTs || ts));
        this.lastTs = ts;
        if (this.frameFn) this.frameFn(dt);
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    end(reason) {
      if (this.ended) return;
      this.ended = true;
      clearInterval(this.timerId);
      if (this.raf) cancelAnimationFrame(this.raf);
      this.timers.forEach((id) => clearTimeout(id));
      this.intervals.forEach((id) => clearInterval(id));
      this.cleanups.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          /* noop */
        }
      });
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      this.showResults(reason);
    }

    showResults(reason) {
      const bestKey = "educrazy_best_" + this.resource.id;
      const previousBest = Number(localStorage.getItem(bestKey) || 0);
      const best = Math.max(previousBest, this.score);
      localStorage.setItem(bestKey, String(best));

      const ratio = this.score / this.config.goal;
      const stars = ratio >= 1.4 ? 3 : ratio >= 0.9 ? 2 : this.score > 0 ? 1 : 0;
      const heading =
        stars === 3 ? "Amazing run!" : stars === 2 ? "Great job!" : stars === 1 ? "Nice try!" : "Keep practicing!";
      const progress = Math.min(100, Math.round(ratio * 100));
      const isNewBest = this.score > previousBest;
      const medal = stars === 3 ? "🏆" : stars === 2 ? "🥇" : stars === 1 ? "🎖️" : "💪";

      if (typeof user !== "undefined" && user && this.score > 0) {
        Educrazy.markComplete(this.resource.id).then(({ error }) => {
          if (!error) toast("Progress saved to your account.");
        });
      }

      this.shell.innerHTML = `
        <div class="game-result">
          <span class="result-medal" aria-hidden="true">${medal}</span>
          <span class="eyebrow ${reason === "lives" ? "orange" : ""}">${
            reason === "lives" ? "Out of lives" : "Time is up"
          }</span>
          <div class="result-stars" aria-label="${stars} out of 3 stars">
            ${"&#9733;".repeat(stars)}<span class="star-empty">${"&#9733;".repeat(3 - stars)}</span>
          </div>
          <h2>${heading}</h2>
          <p>You scored <strong>${this.score}</strong> points in ${esc(this.resource.title)}.</p>
          ${isNewBest ? '<span class="result-newbest">✨ New personal best!</span>' : ""}

          <div class="result-stats">
            <div><small>Score</small><strong>${this.score}</strong></div>
            <div><small>Best</small><strong>${best}</strong></div>
            <div><small>Goal</small><strong>${this.config.goal}</strong></div>
          </div>

          <div class="result-progress">
            <div class="result-progress-head"><span>Goal progress</span><strong>${progress}%</strong></div>
            <div class="result-progress-track"><i style="width:${progress}%"></i></div>
          </div>

          <div class="game-actions">
            <button class="btn btn-primary" type="button" id="playAgain">Play again</button>
            <a class="btn btn-outline" href="resources.html?type=game">More games</a>
            ${
              user
                ? ""
                : `<a class="btn btn-ghost" href="signup.html?next=${encodeURIComponent(
                    "game.html?id=" + this.resource.id
                  )}">Save progress</a>`
            }
          </div>
          <p class="best-line">${user ? "Progress saved. " : ""}Best score: <strong>${best}</strong></p>
        </div>`;

      const again = $("#playAgain");
      if (again) again.addEventListener("click", () => this.onRestart());
    }
  }

  /* ============================================================
     GAME 1 — Alphabet Bubble Pop
     ============================================================ */

  function mountBubbles(a) {
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    const colors = ["#ffd166", "#7fe3a3", "#a9d6ff", "#ffb3c7", "#c6b6ff", "#ffc48a"];
    const bubbles = new Set();
    let target = pick(letters);
    let hits = 0;
    let spawned = 0;

    const setTarget = (fromPresent) => {
      if (fromPresent) {
        const present = Array.from(new Set(Array.from(bubbles).filter((bubble) => !bubble.popped).map((bubble) => bubble.letter)));
        if (!present.length) return;
        target = pick(present);
      } else {
        target = pick(letters);
      }
      a.setBanner(`
        <span class="banner-label">Pop the letter</span>
        <span class="banner-big">${target.toUpperCase()}</span>
        <span class="banner-sub">Find every bubble with this letter</span>`);
    };
    setTarget();

    const spawn = (initial, forceTarget) => {
      if (a.ended) return;
      const size = rand(54, 76);
      const isTarget = forceTarget || Math.random() < 0.4;
      const letter = isTarget ? target : pick(letters.filter((item) => item !== target));
      const el = document.createElement("button");
      el.type = "button";
      el.className = "bubble";
      el.textContent = letter;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.setProperty("--bubble", pick(colors));
      const slot = spawned++;
      let x;
      let y;
      if (initial) {
        const col = slot % 3;
        const row = Math.floor(slot / 3) % 2;
        x = 12 + col * ((a.w - size - 24) / 3) + rand(0, 24);
        y = 56 + row * (a.h / 2 - 30) + rand(0, 24);
      } else {
        x = rand(6, Math.max(10, a.w - size - 6));
        y = a.h + size;
      }
      el.style.transform = `translate(${x}px, ${y}px)`;
      a.stage.appendChild(el);

      const bubble = { el, x, y, size, vy: rand(34, 62), phase: rand(0, 6.28), letter, popped: false };
      el.addEventListener("click", (event) => pop(bubble, event));
      bubbles.add(bubble);
    };

    const pop = (bubble, event) => {
      if (a.ended || bubble.popped) return;
      bubble.popped = true;
      bubbles.delete(bubble);
      const point = a.eventPoint(event);

      if (bubble.letter === target) {
        sfx("pop");
        a.addScore(10, point.x, point.y);
        bubble.el.classList.add("is-popped");
        a.after(120, () => spawn(false));
        hits += 1;
        if (hits % 3 === 0) setTarget(true);
      } else {
        a.floater(point.x, point.y, "Oops!", "bad");
        a.loseLife();
        bubble.el.classList.add("is-wrong");
        bubble.el.disabled = true;
      }
      setTimeout(() => bubble.el.remove(), 330);
    };

    spawn(true, true);
    spawn(true, true);
    for (let i = 0; i < 3; i++) spawn(true);
    a.every(750, () => spawn(false));

    a.frameFn = (dt) => {
      bubbles.forEach((bubble) => {
        bubble.phase += dt / 700;
        bubble.y -= (bubble.vy * dt) / 1000;
        const sway = Math.sin(bubble.phase) * 12;
        bubble.el.style.transform = `translate(${bubble.x + sway}px, ${bubble.y}px)`;
        if (bubble.y < -bubble.size - 20) {
          bubbles.delete(bubble);
          bubble.el.remove();
        }
      });
    };
  }

  /* ============================================================
     GAME 2 — Flipping Pancakes Fractions
     ============================================================ */

  function mountPancakes(a) {
    const fractions = [];
    [2, 3, 4, 5, 6, 8].forEach((den) => {
      for (let num = 1; num < den; num++) fractions.push(num + "/" + den);
    });

    const items = new Set();
    let target = pick(fractions);
    let hits = 0;

    const setTarget = (fromPresent) => {
      if (fromPresent) {
        const present = Array.from(new Set(Array.from(items).filter((item) => !item.done).map((item) => item.value)));
        if (!present.length) return;
        target = pick(present);
      } else {
        target = pick(fractions);
      }
      a.setBanner(`
        <span class="banner-label">Order up!</span>
        <span class="banner-frac">${fractionHTML(target)}</span>
        <span class="banner-sub">Flip the pancake with this fraction</span>`);
    };
    setTarget();

    const spawn = (initial) => {
      if (a.ended) return;
      const hasTarget = Array.from(items).some((item) => item.value === target);
      const value = !hasTarget || Math.random() < 0.3 ? target : pick(fractions.filter((f) => f !== target));
      const size = 86;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "pancake";
      el.innerHTML = `<span class="pancake-frac">${fractionHTML(value)}</span>`;
      el.style.width = size + "px";
      el.style.height = size + "px";
      const x = rand(10, Math.max(20, a.w - size - 10));
      const y = initial ? rand(30, Math.max(90, a.h - 170)) : -size - 10;
      const rotation = rand(-12, 12);
      el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
      a.stage.appendChild(el);

      const item = { el, x, y, size, value, vy: rand(26, 44), phase: rand(0, 6.28), rotation, done: false };
      el.addEventListener("click", (event) => flip(item, event));
      items.add(item);
    };

    const flip = (item, event) => {
      if (a.ended || item.done) return;
      const point = a.eventPoint(event);
      item.done = true;
      items.delete(item);

      if (item.value === target) {
        sfx("good");
        a.addScore(15, point.x, point.y);
        item.el.classList.add("is-flipped");
        hits += 1;
        if (hits % 3 === 0) setTarget(true);
        a.after(200, () => spawn(false));
      } else {
        a.floater(point.x, point.y, "Burnt!", "bad");
        a.loseLife();
        item.el.classList.add("is-burnt");
        item.el.disabled = true;
      }
      setTimeout(() => item.el.remove(), 500);
    };

    for (let i = 0; i < 4; i++) spawn(true);
    a.every(1150, () => spawn(false));

    a.frameFn = (dt) => {
      items.forEach((item) => {
        item.phase += dt / 900;
        item.y += (item.vy * dt) / 1000;
        const wobble = Math.sin(item.phase) * 5;
        item.el.style.transform = `translate(${item.x + wobble}px, ${item.y}px) rotate(${
          item.rotation + Math.sin(item.phase) * 4
        }deg)`;
        if (item.y > a.h + 20) {
          items.delete(item);
          item.el.remove();
        }
      });
    };
  }

  /* ============================================================
     GAME 3 — Counting Coins Arcade
     ============================================================ */

  function mountCoins(a) {
    const COINS = [
      { value: 1, label: "1&cent;", name: "Penny", tone: "copper" },
      { value: 5, label: "5&cent;", name: "Nickel", tone: "silver" },
      { value: 10, label: "10&cent;", name: "Dime", tone: "silver" },
      { value: 25, label: "25&cent;", name: "Quarter", tone: "gold" }
    ];

    let target = Math.floor(rand(15, 96));
    let total = 0;
    let busy = false;

    const format = (cents) => "$" + (cents / 100).toFixed(2);

    const setTarget = () => {
      target = Math.floor(rand(15, 96));
      a.setBanner(`
        <span class="banner-label">Make this amount</span>
        <span class="banner-big">${format(target)}</span>
        <span class="banner-sub">Tap coins to fill the tray</span>`);
    };
    setTarget();

    a.stage.innerHTML = `
      <div class="coin-wrap">
        <div class="coin-tray" id="coinTray">
          <div class="tray-coins" id="trayCoins"><span class="tray-empty">Tap a coin to begin</span></div>
          <div class="tray-total"><span>Total</span><strong id="trayTotal">$0.00</strong></div>
        </div>
        <div class="coin-buttons">
          ${COINS.map(
            (coin) => `
            <button class="coin-btn" type="button" data-value="${coin.value}" data-label="${coin.label}" data-tone="${coin.tone}">
              <span class="coin coin-${coin.tone}">${coin.label}</span>
              <span>${coin.name}</span>
            </button>`
          ).join("")}
        </div>
      </div>`;

    const tray = $("#coinTray");
    const trayCoins = $("#trayCoins");
    const trayTotal = $("#trayTotal");

    const resetTray = (delay) => {
      busy = true;
      a.after(delay || 600, () => {
        total = 0;
        trayTotal.textContent = "$0.00";
        trayCoins.innerHTML = '<span class="tray-empty">Tap a coin to begin</span>';
        tray.classList.remove("is-success", "is-over");
        busy = false;
        setTarget();
      });
    };

    a.stage.addEventListener("click", (event) => {
      const button = event.target.closest(".coin-btn");
      if (!button || a.ended || busy) return;

      const value = Number(button.dataset.value);
      total += value;
      sfx("coin");

      const mini = document.createElement("span");
      mini.className = "tray-coin coin coin-" + button.dataset.tone;
      mini.innerHTML = button.dataset.label;
      if (trayCoins.querySelector(".tray-empty")) trayCoins.innerHTML = "";
      trayCoins.appendChild(mini);
      trayTotal.textContent = format(total);

      if (total === target) {
        sfx("good");
        a.addScore(25);
        tray.classList.add("is-success");
        trayCoins.insertAdjacentHTML("beforeend", '<span class="tray-badge">Exact!</span>');
        resetTray(750);
      } else if (total > target) {
        a.loseLife();
        tray.classList.add("is-over");
        trayCoins.insertAdjacentHTML("beforeend", '<span class="tray-badge is-bad">Too much</span>');
        resetTray(750);
      }
    });
  }

  /* ============================================================
     GAME 4 — Sight Word Safari
     ============================================================ */

  const SIGHT_WORDS = [
    "the", "and", "said", "have", "they", "with", "what", "where",
    "come", "some", "look", "make", "like", "play", "good", "new",
    "want", "help", "here", "into"
  ];

  function mountSafari(a) {
    const animals = new Set();
    const furColors = ["#f2a65a", "#8bcf7a", "#f2cf5b", "#e98bb7", "#7cb8e8", "#b79bea"];
    let target = pick(SIGHT_WORDS);
    let hits = 0;
    let spawned = 0;

    const setTarget = (fromPresent) => {
      if (fromPresent) {
        const present = Array.from(new Set(Array.from(animals).filter((animal) => !animal.done).map((animal) => animal.word)));
        if (!present.length) return;
        target = pick(present);
      } else {
        target = pick(SIGHT_WORDS);
      }
      a.setBanner(`
        <span class="banner-label">Find the sight word</span>
        <span class="banner-row">
          <span class="banner-big banner-word">${target}</span>
          <button class="speak-btn" type="button" data-speak="${esc(target)}" aria-label="Hear the word">${speakerSVG}</button>
        </span>
        <span class="banner-sub">Tap the animal carrying this word</span>`);
    };
    setTarget();

    const spawn = (initial) => {
      if (a.ended) return;
      const hasTarget = Array.from(animals).some((animal) => animal.word === target);
      const word = !hasTarget || Math.random() < 0.35 ? target : pick(SIGHT_WORDS.filter((w) => w !== target));
      const el = document.createElement("button");
      el.type = "button";
      el.className = "safari-animal";
      el.style.setProperty("--fur", pick(furColors));
      el.innerHTML = `
        <span class="animal-body">
          <span class="animal-ear left"></span>
          <span class="animal-ear right"></span>
          <span class="animal-eye left"></span>
          <span class="animal-eye right"></span>
          <span class="animal-snout"></span>
        </span>
        <span class="animal-sign">${esc(word)}</span>`;

      const slot = spawned++;
      const rows = [0, 0.5, 1];
      const row = initial ? slot % rows.length : pick(rows);
      const y = 50 + row * Math.max(40, a.h - 250);
      const x = initial ? rand(20, Math.max(40, a.w - 130)) : -130;
      el.style.transform = `translate(${x}px, ${y}px)`;
      a.stage.appendChild(el);

      const animal = {
        el,
        x,
        y,
        word,
        vx: rand(42, 76),
        phase: rand(0, 6.28),
        done: false
      };
      el.addEventListener("click", (event) => catchAnimal(animal, event));
      animals.add(animal);
    };

    const catchAnimal = (animal, event) => {
      if (a.ended || animal.done) return;
      const point = a.eventPoint(event);
      animal.done = true;
      animals.delete(animal);

      if (animal.word === target) {
        sfx("good");
        a.addScore(12, point.x, point.y);
        animal.el.classList.add("is-caught");
        hits += 1;
        if (hits % 3 === 0) setTarget(true);
        a.after(150, () => spawn(false));
      } else {
        a.floater(point.x, point.y, "Wrong word", "bad");
        a.loseLife();
        animal.el.classList.add("is-missed");
        animal.el.disabled = true;
      }
      setTimeout(() => animal.el.remove(), 450);
    };

    for (let i = 0; i < 3; i++) spawn(true);
    a.every(1500, () => spawn(false));

    a.frameFn = (dt) => {
      animals.forEach((animal) => {
        animal.phase += dt / 600;
        animal.x += (animal.vx * dt) / 1000;
        const hop = Math.sin(animal.phase * 2) * 4;
        animal.el.style.transform = `translate(${animal.x}px, ${animal.y + hop}px)`;
        if (animal.x > a.w + 40) {
          animals.delete(animal);
          animal.el.remove();
        }
      });
    };
  }

  /* ============================================================
     GAME 5 — Irregular Nouns Ski Race
     ============================================================ */

  const NOUNS = [
    ["child", "children"],
    ["mouse", "mice"],
    ["foot", "feet"],
    ["tooth", "teeth"],
    ["goose", "geese"],
    ["man", "men"],
    ["woman", "women"],
    ["person", "people"],
    ["leaf", "leaves"],
    ["wolf", "wolves"],
    ["knife", "knives"],
    ["baby", "babies"],
    ["box", "boxes"],
    ["bus", "buses"],
    ["fish", "fish"],
    ["sheep", "sheep"]
  ];

  function mountSki(a) {
    let lane = 0;
    let speed = 64;
    let activeGate = null;
    const gates = new Set();

    a.stage.classList.add("stage-ski-live");
    a.stage.innerHTML = `
      <div class="ski-route" id="skiRoute"></div>
      <div class="skier" id="skier" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="25" cy="10" r="4.2" fill="#1f8a4c" stroke="none"/>
          <path d="M25 14v13M25 18l-8 5M25 20l8 4M25 27l-7 11M25 27l7 11"/>
          <path d="M7 41h34" stroke="#1f8a4c" stroke-width="3"/>
          <path d="M10 37l5 4M33 37l5 4" stroke="#3b82f6"/>
        </svg>
      </div>
      <div class="ski-controls">
        <button type="button" data-lane="0" aria-label="Move left">&#9664;</button>
        <button type="button" data-lane="1" aria-label="Move right">&#9654;</button>
      </div>`;

    const route = $("#skiRoute");
    const skier = $("#skier");

    const setLane = (next) => {
      lane = next;
      skier.style.left = (lane === 0 ? 25 : 75) + "%";
      skier.classList.toggle("is-right", lane === 1);
    };

    const setQuestion = (gate) => {
      if (!gate) {
        a.setBanner('<span class="banner-label">Steady...</span><span class="banner-sub">Get ready for the next gate</span>');
        return;
      }
      a.setBanner(`
        <span class="banner-label">Choose the correct plural</span>
        <span class="banner-big">${esc(gate.singular)}</span>
        <span class="banner-sub">Steer into the correct gate</span>`);
    };

    const spawnGate = () => {
      if (a.ended) return;
      const pair = pick(NOUNS);
      const other = pick(NOUNS.filter((item) => item[1] !== pair[1]));
      const correctSide = Math.random() < 0.5 ? 0 : 1;
      const options = correctSide === 0 ? [pair[1], other[1]] : [other[1], pair[1]];

      const el = document.createElement("div");
      el.className = "ski-gate";
      el.innerHTML = `
        <div class="gate-line"></div>
        <div class="gate-options">
          <span class="gate-option ${correctSide === 0 ? "is-answer" : ""}">${esc(options[0])}</span>
          <span class="gate-option ${correctSide === 1 ? "is-answer" : ""}">${esc(options[1])}</span>
        </div>`;
      el.style.transform = "translate(-50%, -160px)";
      route.appendChild(el);

      const gate = { el, y: -160, singular: pair[0], correctSide, options, checked: false };
      gates.add(gate);
      if (!activeGate || activeGate.checked) {
        activeGate = gate;
        setQuestion(gate);
      }
    };

    const checkGate = (gate) => {
      const correct = gate.correctSide === lane;
      const point = { x: a.w / 2, y: a.h - 130 };
      if (correct) {
        sfx("good");
        a.addScore(15, point.x, point.y);
        speed = Math.min(150, speed + 7);
        gate.el.classList.add("is-passed");
      } else {
        a.floater(point.x, point.y, "Crash!", "bad");
        a.loseLife();
        gate.el.classList.add("is-crash");
        skier.classList.add("is-crash");
        a.after(420, () => skier.classList.remove("is-crash"));
      }
      a.after(500, () => gate.el.remove());
    };

    setLane(0);
    spawnGate();
    a.every(2200, spawnGate);

    a.frameFn = (dt) => {
      gates.forEach((gate) => {
        gate.y += (speed * dt) / 1000;
        gate.el.style.transform = `translate(-50%, ${gate.y}px)`;

        if (!gate.checked && gate.y >= a.h - 128) {
          gate.checked = true;
          checkGate(gate);
        }

        if (gate.y > a.h + 80) {
          gates.delete(gate);
          gate.el.remove();
        }
      });

      const nearest = Array.from(gates)
        .filter((gate) => !gate.checked)
        .sort((x, y) => y.y - x.y)[0];
      if (nearest && nearest !== activeGate) {
        activeGate = nearest;
        setQuestion(nearest);
      }
    };

    const onKey = (event) => {
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        event.preventDefault();
        setLane(0);
      } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        event.preventDefault();
        setLane(1);
      }
    };
    document.addEventListener("keydown", onKey);
    a.addCleanup(() => document.removeEventListener("keydown", onKey));

    a.stage.addEventListener("click", (event) => {
      const button = event.target.closest("[data-lane]");
      if (button) {
        setLane(Number(button.dataset.lane));
        return;
      }
      if (event.target.closest(".ski-controls")) return;
      const half = a.stage.getBoundingClientRect().width / 2;
      setLane(event.clientX - a.stage.getBoundingClientRect().left < half ? 0 : 1);
    });
  }

  /* ============================================================
     GAME 6 — Typing Rockets
     ============================================================ */

  const TYPING_WORDS = [
    "adventure", "computer", "keyboard", "practice", "rocket", "planet",
    "learning", "challenge", "discover", "wonderful", "together", "important",
    "question", "mountain", "creative", "explore", "educrazy", "launch",
    "science", "reading", "typing", "school", "pencil", "teacher"
  ];

  function mountTyping(a) {
    const rockets = new Set();
    let combo = 0;

    a.stage.innerHTML = `
      <div class="rocket-layer" id="rocketLayer"></div>
      <form class="typing-bar" id="rocketForm" autocomplete="off">
        <input id="rocketInput" type="text" placeholder="Type a word and it launches..." autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Type a word" />
        <button class="btn btn-primary" type="submit">Launch</button>
      </form>`;

    a.setBanner(`
      <span class="banner-label">Type the falling words</span>
      <span class="banner-sub">Match a word exactly to launch it. Do not let them reach the ground!</span>`);

    const layer = $("#rocketLayer");
    const input = $("#rocketInput");

    const highlight = () => {
      const value = input.value.trim().toLowerCase();
      rockets.forEach((rocket) => {
        rocket.el.classList.toggle("is-typing", value.length > 0 && rocket.word.startsWith(value));
      });
    };

    const spawn = (stagger) => {
      if (a.ended) return;
      const active = new Set(Array.from(rockets).map((rocket) => rocket.word));
      const pool = TYPING_WORDS.filter((item) => !active.has(item));
      const word = pick(pool.length ? pool : TYPING_WORDS);
      const el = document.createElement("div");
      el.className = "rocket-word";
      el.innerHTML = `
        <svg class="rocket-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2c2.6 1.9 4 4.5 4 7.6 0 1.7-.5 3.2-1.3 4.5L12 17l-2.7-2.9c-.8-1.3-1.3-2.8-1.3-4.5C8 6.5 9.4 3.9 12 2Z"/>
          <circle cx="12" cy="8.5" r="1.5"/>
          <path d="M9.3 15.5 7 20l2.8-.8M14.7 15.5 17 20l-2.8-.8"/>
        </svg>
        <span class="rocket-label">${esc(word)}</span>`;
      const laneCount = Math.max(2, Math.floor(a.w / 190));
      const counts = Array.from({ length: laneCount }, () => 0);
      rockets.forEach((rocket) => {
        if (rocket.lane < laneCount) counts[rocket.lane] += 1;
      });
      let lane = 0;
      for (let index = 1; index < laneCount; index++) {
        if (counts[index] < counts[lane]) lane = index;
      }
      const laneWidth = (a.w - 20) / laneCount;
      const x = 10 + lane * laneWidth + rand(0, Math.max(0, laneWidth - 140));
      const y = -60 - counts[lane] * 84 - (stagger || 0);
      el.style.transform = `translate(${x}px, ${y}px)`;
      layer.appendChild(el);

      const rocket = { el, x, y, word, lane, vy: rand(30, 46) + Math.min(24, a.score * 0.05) };
      rockets.add(rocket);
    };

    const launch = (rocket) => {
      if (rocket.done) return;
      rocket.done = true;
      rockets.delete(rocket);
      combo += 1;
      const points = 10 + Math.min(20, (combo - 1) * 2);
      const rect = rocket.el.getBoundingClientRect();
      const stageRect = a.stage.getBoundingClientRect();
      const point = { x: rect.left - stageRect.left + rect.width / 2, y: rect.top - stageRect.top };
      a.addScore(points, point.x, point.y);
      sfx("launch");
      rocket.el.classList.add("is-launched");
      setTimeout(() => rocket.el.remove(), 420);
      input.value = "";
      highlight();
    };

    // While typing, only auto-launch on an exact match; a miss is judged on Enter.
    const submit = (fromTyping) => {
      const value = input.value.trim().toLowerCase();
      if (!value) return;
      const match = Array.from(rockets).find((rocket) => rocket.word.toLowerCase() === value);
      if (match) {
        launch(match);
      } else if (!fromTyping) {
        combo = 0;
        input.classList.remove("is-missing");
        void input.offsetWidth;
        input.classList.add("is-missing");
      }
    };

    $("#rocketForm").addEventListener("submit", (event) => {
      event.preventDefault();
      submit();
    });
    input.addEventListener("input", () => {
      highlight();
      submit(true);
    });

    for (let i = 0; i < 3; i++) {
      spawn(i * 90);
    }
    a.every(1900, spawn);
    setTimeout(() => input.focus(), 100);

    a.frameFn = (dt) => {
      const layerHeight = layer.clientHeight || a.h;
      rockets.forEach((rocket) => {
        rocket.y += (rocket.vy * dt) / 1000;
        rocket.el.style.transform = `translate(${rocket.x}px, ${rocket.y}px)`;
        if (rocket.y > layerHeight - 88) {
          rockets.delete(rocket);
          combo = 0;
          rocket.el.remove();
          a.floater(rocket.x + 40, layerHeight - 60, "Missed!", "bad");
          a.loseLife();
        }
      });
    };
  }

  /* ============================================================
     GAME 7 — Multiplication Meteor
     ============================================================ */

  function mountMeteor(a) {
    const meteors = [];
    const size = a.w < 480 ? 60 : 72;
    let factorA = 0;
    let factorB = 0;
    let answer = 0;
    let locked = false;

    const hit = (meteor, event) => {
      if (a.ended || locked || meteor.dead) return;
      const point = a.eventPoint(event);
      if (meteor.value === answer) {
        locked = true;
        sfx("good");
        a.addScore(20, point.x, point.y);
        a.setBanner(`
          <span class="banner-label">Direct hit!</span>
          <span class="banner-big">${factorA} &times; ${factorB} = ${answer}</span>
          <span class="banner-sub">Next equation incoming...</span>`);
        meteors.forEach((item) => {
          item.dead = true;
          item.el.disabled = true;
          item.el.classList.add("is-blast");
        });
        a.after(650, () => next());
      } else {
        sfx("bad");
        meteor.el.classList.add("is-wrong");
        meteor.el.disabled = true;
        a.loseLife();
        a.floater(point.x, point.y, "Try again", "bad");
        a.after(550, () => {
          if (!meteor.dead) {
            meteor.el.disabled = false;
            meteor.el.classList.remove("is-wrong");
          }
        });
      }
    };

    const spawn = (values) => {
      meteors.forEach((item) => item.el.remove());
      meteors.length = 0;
      const w = Math.max(300, a.w);
      const h = Math.max(320, a.h);
      values.forEach((value, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "meteor";
        el.textContent = value;
        el.style.width = size + "px";
        el.style.height = size + "px";
        const lane = (index + 0.5) / values.length;
        const baseX = Math.max(8, Math.min(w - size - 8, lane * (w - size) + rand(-12, 12)));
        const y = 40 + (index % 2) * (h * 0.32) + rand(0, 24);
        el.style.transform = `translate(${baseX}px, ${y}px)`;
        a.stage.appendChild(el);
        const meteor = { el, baseX, y, size, value, vy: rand(18, 30), phase: rand(0, 6.28), dead: false };
        el.addEventListener("click", (event) => hit(meteor, event));
        meteors.push(meteor);
      });
    };

    const next = () => {
      if (a.ended) return;
      locked = false;
      factorA = 2 + Math.floor(Math.random() * 9);
      factorB = 2 + Math.floor(Math.random() * 9);
      answer = factorA * factorB;
      const options = new Set([answer]);
      let guard = 0;
      while (options.size < 4 && guard++ < 60) {
        const delta = pick([factorA, factorB, factorA + factorB, factorA - 1, factorB - 1, 2, 3, 4]);
        const candidate = answer + (Math.random() < 0.5 ? -1 : 1) * delta;
        if (candidate > 0 && candidate !== answer) options.add(candidate);
      }
      while (options.size < 4) options.add(answer + options.size * 7);
      a.setBanner(`
        <span class="banner-label">Blast the product</span>
        <span class="banner-big">${factorA} &times; ${factorB}</span>
        <span class="banner-sub">Tap the meteor with the correct answer</span>`);
      spawn(shuffle(Array.from(options).slice(0, 4)));
    };

    next();

    a.frameFn = (dt) => {
      const w = Math.max(300, a.w);
      const h = Math.max(320, a.h);
      meteors.forEach((meteor) => {
        if (meteor.dead) return;
        meteor.phase += dt / 900;
        meteor.y += (meteor.vy * dt) / 1000;
        const sway = Math.sin(meteor.phase) * 9;
        const trailRot = -10 + (sway / 9) * 15;
        if (meteor.y > h + meteor.size) {
          meteor.y = -meteor.size - rand(0, 80);
          meteor.baseX = rand(8, Math.max(10, w - meteor.size - 8));
        }
        meteor.el.style.transform = `translate(${meteor.baseX + sway}px, ${meteor.y}px)`;
        meteor.el.style.setProperty("--trail-rot", trailRot + "deg");
      });
    };
  }

  /* ============================================================
     GAME 8 — Rhyme Time Train
     ============================================================ */

  function mountRhyme(a) {
    const FAMILIES = [
      { key: "at", words: ["cat", "hat", "bat", "mat"] },
      { key: "og", words: ["dog", "log", "fog", "frog"] },
      { key: "un", words: ["sun", "run", "fun", "bun"] },
      { key: "ake", words: ["cake", "lake", "rake", "snake"] },
      { key: "ar", words: ["star", "car", "jar", "far"] },
      { key: "ee", words: ["bee", "tree", "key", "see"] },
      { key: "oon", words: ["moon", "soon", "spoon", "balloon"] },
      { key: "ight", words: ["light", "night", "kite", "bite"] },
      { key: "ay", words: ["play", "day", "way", "hay"] },
      { key: "ook", words: ["book", "look", "cook", "hook"] }
    ];
    const trains = [];
    const compact = a.w < 480;
    const trainW = compact ? 124 : 150;
    const trainH = compact ? 54 : 62;
    let answer = "";
    let lastKey = "";
    let locked = false;

    const hit = (train, event) => {
      if (a.ended || locked || train.dead) return;
      const point = a.eventPoint(event);
      if (train.word === answer) {
        locked = true;
        sfx("good");
        a.addScore(20, point.x, point.y);
        train.el.classList.add("is-correct");
        trains.forEach((item) => {
          item.dead = true;
          item.el.disabled = true;
        });
        a.setBanner(`
          <span class="banner-label">You found the rhyme!</span>
          <span class="banner-big">${esc(train.word)}</span>
          <span class="banner-sub">Next word is pulling into the station...</span>`);
        a.after(550, () => next());
      } else {
        sfx("bad");
        a.loseLife();
        a.floater(point.x, point.y, "Not a rhyme", "bad");
        train.el.classList.add("is-wrong");
        train.el.disabled = true;
        a.after(600, () => {
          if (!train.dead) {
            train.el.disabled = false;
            train.el.classList.remove("is-wrong");
          }
        });
      }
    };

    const buildTrains = (words) => {
      trains.forEach((item) => item.el.remove());
      trains.length = 0;
      const stageW = Math.max(320, a.w);
      const stageH = Math.max(320, a.h);
      const gap = (stageH - 40 - trainH * 4) / 3;
      words.forEach((word, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "word-train";
        el.style.width = trainW + "px";
        el.style.height = trainH + "px";
        el.innerHTML =
          '<div class="loco-body"><span class="loco-word">' + esc(word) + '</span></div>' +
          '<div class="loco-cab"></div>' +
          '<div class="loco-stack"></div>' +
          '<div class="loco-cow"></div>' +
          '<div class="loco-wheels"></div>';
        const y = 22 + index * (trainH + gap);
        let x = (stageW / 4) * index - trainW / 2 + rand(-16, 16);
        el.style.transform = `translate(${x}px, ${y}px)`;
        a.stage.appendChild(el);
        const train = { el, x, y, w: trainW, word, speed: rand(34, 52), dead: false };
        el.addEventListener("click", (event) => hit(train, event));
        trains.push(train);
      });
    };

    const next = () => {
      if (a.ended) return;
      locked = false;
      let family = pick(FAMILIES);
      if (FAMILIES.length > 1 && family.key === lastKey) family = pick(FAMILIES.filter((item) => item.key !== lastKey));
      lastKey = family.key;
      const target = pick(family.words);
      const rhyme = pick(family.words.filter((word) => word !== target));
      answer = rhyme;
      const others = shuffle(FAMILIES.filter((item) => item.key !== family.key)).slice(0, 3);
      const words = shuffle([rhyme].concat(others.map((item) => pick(item.words))));
      a.setBanner(`
        <span class="banner-label">Which word rhymes?</span>
        <span class="banner-big">${esc(target)}</span>
        <span class="banner-sub">Tap the train carrying a word that rhymes with &ldquo;${esc(target)}&rdquo;</span>`);
      buildTrains(words);
    };

    next();

    a.frameFn = (dt) => {
      const stageW = Math.max(320, a.w);
      trains.forEach((train) => {
        if (train.dead) return;
        train.x -= (train.speed * dt) / 1000;
        if (train.x + train.w < -12) train.x = stageW + rand(0, 100);
        train.el.style.transform = `translate(${train.x}px, ${train.y}px)`;
      });
    };
  }

  /* ============================================================
     GAME 9 — Punctuation Parade
     ============================================================ */

  function mountPunctuation(a) {
    const PROMPTS = [
      { text: "Where is the school library _", answer: "?" },
      { text: "I love reading mystery books _", answer: "." },
      { text: "Watch out for that speeding car _", answer: "!" },
      { text: "She packed apples _ bananas and grapes", answer: "," },
      { text: "Can we go to the park after lunch _", answer: "?" },
      { text: "My favorite color is blue _", answer: "." },
      { text: "What a wonderful surprise _", answer: "!" },
      { text: "We need flour _ sugar and eggs", answer: "," },
      { text: "The bus arrives at eight _", answer: "." },
      { text: "Do you know the answer _", answer: "?" },
      { text: "Please close the door _", answer: "." },
      { text: "That was an amazing goal _", answer: "!" },
      { text: "Before bed _ I brush my teeth", answer: "," },
      { text: "We bought milk _ bread and cheese", answer: "," },
      { text: "How many stars are in the sky _", answer: "?" },
      { text: "Our class won the spelling bee _", answer: "!" },
      { text: "My brother plays the drums _ the guitar and the piano", answer: "," },
      { text: "Where did you put my backpack _", answer: "?" }
    ];
    const MARKS = [
      { mark: ".", name: "Period", tone: "period" },
      { mark: "?", name: "Question", tone: "question" },
      { mark: "!", name: "Exclamation", tone: "exclaim" },
      { mark: ",", name: "Comma", tone: "comma" }
    ];
    const bunting = document.createElement("div");
    bunting.className = "parade-bunting";
    bunting.innerHTML =
      "<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>";
    const ground = document.createElement("div");
    ground.className = "parade-ground";
    const board = document.createElement("div");
    board.className = "punct-board";
    board.innerHTML =
      '<span class="punct-board-tape left" aria-hidden="true"></span>' +
      '<span class="punct-board-tape right" aria-hidden="true"></span>' +
      '<span class="punct-kicker">Complete the sentence</span>' +
      '<p class="punct-sentence"></p>';
    const row = document.createElement("div");
    row.className = "punct-row";
    a.stage.append(bunting, ground, board, row);
    const sentenceEl = board.querySelector(".punct-sentence");
    let current = PROMPTS[0];
    let lastIndex = -1;
    let locked = false;

    const choose = (mark, el) => {
      if (a.ended || locked) return;
      if (mark === current.answer) {
        locked = true;
        sfx("good");
        el.classList.add("is-correct");
        const rect = el.getBoundingClientRect();
        const stageRect = a.stage.getBoundingClientRect();
        a.addScore(20, rect.left - stageRect.left + rect.width / 2, rect.top - stageRect.top + 20);
        sentenceEl.innerHTML = esc(current.text).replace(
          "_",
          '<span class="punct-blank is-filled" aria-hidden="true">' + esc(current.answer) + "</span>"
        );
        board.classList.add("is-correct");
        a.setBanner(`
          <span class="banner-label">Perfect punctuation!</span>
          <span class="banner-big">${esc(current.answer)}</span>
          <span class="banner-sub">Next sentence is marching in...</span>`);
        a.after(750, () => next());
      } else {
        sfx("bad");
        a.loseLife();
        el.classList.add("is-wrong");
        board.classList.remove("is-wrong");
        void board.offsetWidth;
        board.classList.add("is-wrong");
        a.floater(a.w / 2, a.h - 150, "Try another mark", "bad");
        a.after(450, () => {
          el.classList.remove("is-wrong");
          board.classList.remove("is-wrong");
        });
      }
    };

    MARKS.forEach(({ mark, name, tone }) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "punct-card is-" + tone;
      el.dataset.mark = mark;
      el.setAttribute("aria-label", name + " mark (" + mark + ")");
      el.innerHTML = `<span class="mark" aria-hidden="true">${mark}</span><span class="pname">${name}</span>`;
      el.addEventListener("click", () => choose(mark, el));
      row.appendChild(el);
    });

    const next = () => {
      if (a.ended) return;
      locked = false;
      let index = Math.floor(Math.random() * PROMPTS.length);
      if (PROMPTS.length > 1 && index === lastIndex) index = (index + 1) % PROMPTS.length;
      lastIndex = index;
      current = PROMPTS[index];
      row.querySelectorAll(".punct-card").forEach((el) => el.classList.remove("is-correct", "is-wrong"));
      board.classList.remove("is-correct", "is-wrong");
      sentenceEl.innerHTML = esc(current.text).replace("_", '<span class="punct-blank" aria-hidden="true"></span>');
      a.setBanner(`
        <span class="banner-label">Punctuation parade</span>
        <span class="banner-sub">Read the sentence, then tap the matching mark</span>`);
    };

    next();
  }

  /* ============================================================
     GAME 10 — Habitat Hop
     ============================================================ */

  function mountHabitat(a) {
    const HABITATS = [
      { key: "forest", label: "Forest", icon: "🌲" },
      { key: "ocean", label: "Ocean", icon: "🌊" },
      { key: "desert", label: "Desert", icon: "🌵" },
      { key: "savanna", label: "Savanna", icon: "🌾" },
      { key: "arctic", label: "Arctic", icon: "❄️" },
      { key: "pond", label: "Pond", icon: "🪷" }
    ];
    const ANIMALS = [
      { emoji: "🦁", name: "Lion", habitat: "savanna" },
      { emoji: "🐘", name: "Elephant", habitat: "savanna" },
      { emoji: "🦓", name: "Zebra", habitat: "savanna" },
      { emoji: "🐪", name: "Camel", habitat: "desert" },
      { emoji: "🦂", name: "Scorpion", habitat: "desert" },
      { emoji: "🐧", name: "Penguin", habitat: "arctic" },
      { emoji: "🐻‍❄️", name: "Polar bear", habitat: "arctic" },
      { emoji: "🐬", name: "Dolphin", habitat: "ocean" },
      { emoji: "🐙", name: "Octopus", habitat: "ocean" },
      { emoji: "🦈", name: "Shark", habitat: "ocean" },
      { emoji: "🐸", name: "Frog", habitat: "pond" },
      { emoji: "🦆", name: "Duck", habitat: "pond" },
      { emoji: "🐊", name: "Crocodile", habitat: "pond" },
      { emoji: "🦌", name: "Deer", habitat: "forest" },
      { emoji: "🐿️", name: "Squirrel", habitat: "forest" },
      { emoji: "🦉", name: "Owl", habitat: "forest" }
    ];
    const card = document.createElement("div");
    card.className = "habitat-animal";
    card.innerHTML = '<span class="animal-emoji" aria-hidden="true"></span><span class="animal-name"></span>';
    a.stage.appendChild(card);
    const row = document.createElement("div");
    row.className = "habitat-row";
    a.stage.appendChild(row);
    let current = null;
    let lastAnimal = "";
    let locked = false;

    const choose = (habitat, el) => {
      if (a.ended || locked) return;
      const rect = el.getBoundingClientRect();
      const stageRect = a.stage.getBoundingClientRect();
      if (habitat.key === current.key) {
        locked = true;
        sfx("good");
        el.classList.add("is-correct");
        card.classList.add("is-hop");
        a.addScore(20, rect.left - stageRect.left + rect.width / 2, rect.top - stageRect.top + 12);
        a.setBanner(`
          <span class="banner-label">Correct habitat!</span>
          <span class="banner-big">${esc(current.label)}</span>
          <span class="banner-sub">Next animal is on its way...</span>`);
        a.after(650, () => next());
      } else {
        sfx("bad");
        a.loseLife();
        el.classList.add("is-wrong");
        a.floater(rect.left - stageRect.left + rect.width / 2, rect.top - stageRect.top + 20, "Not quite", "bad");
        a.after(400, () => el.classList.remove("is-wrong"));
      }
    };

    const next = () => {
      if (a.ended) return;
      locked = false;
      let animal = pick(ANIMALS);
      if (ANIMALS.length > 1 && animal.name === lastAnimal) animal = pick(ANIMALS.filter((item) => item.name !== lastAnimal));
      lastAnimal = animal.name;
      current = HABITATS.find((item) => item.key === animal.habitat) || HABITATS[0];
      const others = shuffle(HABITATS.filter((item) => item.key !== current.key)).slice(0, 2);
      const choices = shuffle([current].concat(others));
      card.querySelector(".animal-emoji").textContent = animal.emoji;
      card.querySelector(".animal-name").textContent = animal.name;
      card.classList.remove("is-hop");
      row.innerHTML = "";
      choices.forEach((habitat) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "habitat-pad";
        el.dataset.key = habitat.key;
        el.dataset.habitat = habitat.key;
        el.innerHTML = `<span class="pad-icon" aria-hidden="true">${habitat.icon}</span><span class="pad-label">${esc(habitat.label)}</span>`;
        el.addEventListener("click", () => choose(habitat, el));
        row.appendChild(el);
      });
      a.setBanner(`
        <span class="banner-label">Habitat hop</span>
        <span class="banner-big">${animal.emoji} ${esc(animal.name)}</span>
        <span class="banner-sub">Where does this animal live?</span>`);
    };

    next();
  }

  /* ---------------- game registry ---------------- */

  const GAMES = {
    "alphabet-bubble-pop": {
      theme: "bubbles",
      genre: "Arcade",
      duration: 45,
      goal: 100,
      instructions: "Bubbles float up with letters inside. Pop only the bubbles that match the target letter. A wrong pop costs a life.",
      controlsTitle: "Controls:",
      controls: "Click or tap a bubble",
      mount: mountBubbles
    },
    "flipping-pancakes-fractions": {
      theme: "pancakes",
      genre: "Arcade",
      duration: 50,
      goal: 150,
      instructions: "Pancakes fall onto the griddle with fractions on them. Flip only the pancake that matches the order ticket. Wrong flips cost a life.",
      controlsTitle: "Controls:",
      controls: "Click or tap a pancake",
      mount: mountPancakes
    },
    "counting-coins-arcade": {
      theme: "coins",
      genre: "Puzzle",
      duration: 60,
      goal: 150,
      instructions: "An amount appears on the order screen. Tap coins to build exactly that amount before time runs out. Going over costs a life.",
      controlsTitle: "Controls:",
      controls: "Tap coins to add them to the tray",
      mount: mountCoins
    },
    "sight-word-safari": {
      theme: "safari",
      genre: "Arcade",
      duration: 50,
      goal: 150,
      instructions: "Animals run across the savanna carrying word signs. Tap the animal with the target sight word. Wrong animals cost a life.",
      controlsTitle: "Controls:",
      controls: "Click or tap an animal (speaker plays the word)",
      mount: mountSafari
    },
    "irregular-nouns-ski-race": {
      theme: "ski",
      genre: "Action",
      duration: 60,
      goal: 180,
      instructions: "Gates slide down the slope with two plural options. Steer your skier into the gate with the correct plural. Crashing costs a life.",
      controlsTitle: "Controls:",
      controls: "Arrow keys / A-D, tap the screen, or use the arrows",
      mount: mountSki
    },
    "typing-rockets": {
      theme: "typing",
      genre: "Typing",
      duration: 60,
      goal: 220,
      instructions: "Words fall toward the ground like rockets. Type a word exactly to launch it. Words that land cost a life.",
      controlsTitle: "Controls:",
      controls: "Type on your keyboard - no Enter needed",
      mount: mountTyping
    },
    "multiplication-meteor": {
      theme: "meteor",
      genre: "Arcade",
      duration: 60,
      goal: 200,
      instructions: "Meteors drift across space carrying possible answers. Blast the meteor with the correct product for the equation. A wrong blast costs a life.",
      controlsTitle: "Controls:",
      controls: "Click or tap the meteor with the right answer",
      mount: mountMeteor
    },
    "rhyme-time-train": {
      theme: "train",
      genre: "Word Play",
      duration: 50,
      goal: 160,
      instructions: "Word trains roll through the station. Tap the train carrying a word that rhymes with the target word. Wrong trains cost a life.",
      controlsTitle: "Controls:",
      controls: "Click or tap a train",
      mount: mountRhyme
    },
    "punctuation-parade": {
      theme: "parade",
      genre: "Puzzle",
      duration: 60,
      goal: 180,
      instructions: "A sentence floats by with a missing mark. Choose the period, question mark, exclamation mark, or comma that completes it. Wrong marks cost a life.",
      controlsTitle: "Controls:",
      controls: "Click or tap a punctuation card",
      mount: mountPunctuation
    },
    "habitat-hop": {
      theme: "habitat",
      genre: "Science",
      duration: 50,
      goal: 160,
      instructions: "An animal appears on the trail. Send it to the right habitat: forest, ocean, desert, savanna, arctic, or pond. A wrong habitat costs a life.",
      controlsTitle: "Controls:",
      controls: "Click or tap a habitat",
      mount: mountHabitat
    }
  };

  /* ---------------- runtime ---------------- */

  let resource = null;
  let user = null;

  async function fetchResources() {
    if (Educrazy.client) {
      const { data, error } = await Educrazy.client.from("resources").select("*");
      if (error) throw error;
      return data || [];
    }
    const response = await fetch("data/resources.json");
    if (!response.ok) throw new Error("Could not load the library.");
    return response.json();
  }

  function renderTags() {
    $("#gameTags").innerHTML = `
      <span class="pill">Grade ${esc(resource.grade)}</span>
      <span class="pill">${esc(resource.subject)}</span>
      <span class="pill ${resource.is_premium ? "gold" : "green"}">${resource.is_premium ? "Premium" : "Free"}</span>`;
    document.title = resource.title + " | Educrazy";
  }

  function renderLock() {
    $("#gameShell").innerHTML = `
      <div class="game-lock">
        <div class="lock-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        </div>
        <h2>${esc(resource.title)} is a premium game</h2>
        <p>Upgrade to unlock this game plus every premium worksheet, lesson plan, and activity in the library.</p>
        <div class="game-actions">
          <a class="btn btn-primary" href="pricing.html">See premium plans</a>
          <a class="btn btn-outline" href="resources.html?type=game">Browse free games</a>
        </div>
      </div>`;
  }

  function renderError(message) {
    $("#gameShell").innerHTML = `
      <div class="game-lock">
        <div class="lock-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
        </div>
        <h2>Game not found</h2>
        <p>${esc(message)}</p>
        <div class="game-actions">
          <a class="btn btn-primary" href="resources.html?type=game">Back to games</a>
        </div>
      </div>`;
  }

  function launch() {
    const session = new Arcade(resource, GAMES[resource.slug], launch);
    session.showStart();
  }

  async function init() {
    const id = Number(new URLSearchParams(window.location.search).get("id"));

    try {
      const all = await fetchResources();
      resource = all.find((item) => Number(item.id) === id && item.type === "game");
    } catch (error) {
      renderError("Serve the site over HTTP so the game data can load.");
      return;
    }

    if (!resource) {
      renderError("That game could not be found. Pick another one from the library.");
      return;
    }
    if (resource.slug === "ec-games-live") {
      window.location.replace(resource.url || "zep-game/index.html");
      return;
    }
    if (!GAMES[resource.slug]) {
      renderError("This game is not available yet.");
      return;
    }

    renderTags();
    user = await Educrazy.getUser();

    if (resource.is_premium && (!user || user.plan !== "premium")) {
      renderLock();
      return;
    }

    launch();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();

    document.addEventListener("click", (event) => {
      const speakButton = event.target.closest("[data-speak]");
      if (speakButton) speak(speakButton.dataset.speak);
    });
  });
})();

