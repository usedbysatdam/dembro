(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupBanner() {
    var banner = document.getElementById("gfeBanner");
    if (!banner) return;
    var close = banner.querySelector("[data-banner-close]");
    var key = "educrazy_banner_dismissed";
    var hidden = false;
    try {
      hidden = localStorage.getItem(key) === "1";
    } catch (error) {
      hidden = false;
    }
    if (hidden) {
      banner.remove();
      return;
    }
    if (!close) return;
    close.addEventListener("click", function () {
      banner.classList.add("is-hidden");
      try {
        localStorage.setItem(key, "1");
      } catch (error) {}
      window.setTimeout(function () {
        banner.remove();
      }, 260);
    });
  }

  function revealTargets() {
    var groups = [
      [".gfe-hero-head", 0, "up"],
      [".gfe-statement p", 90, "up"],
      [".gfe-dark-panel", 0, "scale"],
      [".gfe-audience h2", 0, "up"],
      [".gfe-audience-links", 90, "up"],
      [".gfe-audience-grid", 150, "up"],
      [".gfe-solutions-panel", 0, "scale"],
      [".gfe-newsletter-inner", 0, "up"],
      [".gfe-social", 90, "up"]
    ];

    groups.forEach(function (item) {
      var el = document.querySelector(item[0]);
      if (!el) return;
      el.setAttribute("data-reveal", item[2]);
      el.style.setProperty("--reveal-delay", item[1] + "ms");
    });

    Array.prototype.forEach.call(document.querySelectorAll(".gfe-card"), function (card, index) {
      card.setAttribute("data-reveal", "up");
      card.style.setProperty("--reveal-delay", index * 90 + "ms");
    });

    Array.prototype.forEach.call(document.querySelectorAll(".gfe-faq-item"), function (item, index) {
      item.setAttribute("data-reveal", "up");
      item.style.setProperty("--reveal-delay", index * 70 + "ms");
    });
  }

  function setupStatementWords() {
    var head = document.querySelector(".gfe-statement h2");
    if (!head || head.getAttribute("data-split") === "1") return;

    var words = head.textContent.trim().split(/\s+/);
    head.textContent = "";
    words.forEach(function (word, index) {
      var span = document.createElement("span");
      span.className = "gfe-word";
      span.style.setProperty("--i", index);
      span.textContent = word;
      head.appendChild(span);
      head.appendChild(document.createTextNode(" "));
    });
    head.setAttribute("data-split", "1");

    if (reduceMotion || !("IntersectionObserver" in window)) {
      head.classList.add("is-in");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        head.classList.add("is-in");
        observer.disconnect();
      },
      { threshold: 0.35 }
    );
    observer.observe(head);
  }

  function setupReveal() {
    document.body.classList.add("gfe-js");
    revealTargets();

    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!nodes.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (el) {
        el.classList.add("is-in");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    nodes.forEach(function (el) {
      observer.observe(el);
    });
  }

  function setupParallax() {
    if (reduceMotion) return;
    var layers = [
      { el: document.querySelector(".gfe-dark-result-image"), speed: 0.06, scale: 1 }
    ].filter(function (layer) {
      return layer.el;
    });
    if (!layers.length) return;

    var ticking = false;

    function frame() {
      ticking = false;
      var viewport = window.innerHeight || 800;
      layers.forEach(function (layer) {
        var rect = layer.el.getBoundingClientRect();
        var offset = rect.top + rect.height / 2 - viewport / 2;
        var shift = Math.max(-60, Math.min(60, offset * layer.speed));
        layer.el.style.transform =
          "translate3d(0, " + shift.toFixed(2) + "px, 0) scale(" + layer.scale + ")";
      });
    }

    function request() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    }

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    request();
  }

  function setupHeaderOffset() {
    var header = document.querySelector(".gfe-header");
    if (!header) return;

    function apply() {
      var height = Math.round(header.getBoundingClientRect().height);
      if (height > 0) {
        document.documentElement.style.setProperty("--gfe-head", height + "px");
      }
    }

    apply();
    window.addEventListener("resize", apply);
    if ("ResizeObserver" in window) {
      new ResizeObserver(apply).observe(header);
    }
  }

  function setupDemoPin() {
    var stage = document.querySelector("[data-stage]");
    if (!stage) return;
    var scenes = Array.prototype.slice.call(stage.querySelectorAll(".gfe-scene"));
    var captions = Array.prototype.slice.call(stage.querySelectorAll(".gfe-caption"));
    var dots = Array.prototype.slice.call(stage.querySelectorAll(".gfe-scene-dots i"));
    var bgLayers = Array.prototype.slice.call(stage.querySelectorAll(".gfe-bg-layer"));
    if (!scenes.length) return;

    if (reduceMotion) {
      stage.classList.add("is-static");
      return;
    }

    var promptEl = stage.querySelector("[data-typed]");
    var promptText = promptEl ? promptEl.textContent.trim() : "";
    if (promptEl) promptEl.textContent = "";
    var typed = false;

    var smooth = 0;
    var started = false;
    var snap = true;
    var raf = 0;
    var lastActive = -1;

    function clamp(value, min, max) {
      return value < min ? min : value > max ? max : value;
    }

    function smoothstep(from, to, value) {
      var t = clamp((value - from) / (to - from), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function typePrompt() {
      if (typed || !promptEl || !promptText) return;
      typed = true;
      var i = 0;
      (function tick() {
        i += 1;
        promptEl.textContent = promptText.slice(0, i);
        if (i < promptText.length) setTimeout(tick, 28);
      })();
    }

    var lastP = -1;
    var lastGen = -1;
    var lastGrow = -1;
    var lastO = [-1, -1, -1];
    var lastOut = [-1, -1, -1];
    var lastSp = [-1, -1, -1];
    var lastCapIn = [-1, -1, -1];
    var lastCapOut = [-1, -1, -1];
    var lastBg = [-1, -1, -1];
    var expanded = false;
    var lastTs = 0;
    // Scene windows: [start, end] of each crossfade, wide enough to read as motion.
    var FADE_01 = [0.26, 0.4];
    var FADE_12 = [0.56, 0.7];

    function frame(ts) {
      raf = 0;
      var rect = stage.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var target = total > 0 ? clamp(-rect.top / total, 0, 1) : 1;

      // Frame-rate independent easing so 60Hz and 120Hz screens feel the same.
      var dt = lastTs ? Math.min(64, ts - lastTs) : 16;
      lastTs = ts;
      if (snap) {
        smooth = target;
        snap = false;
      } else {
        smooth += (target - smooth) * (1 - Math.exp(-dt / 110));
        if (Math.abs(target - smooth) < 0.0006) smooth = target;
      }

      if (Math.abs(smooth - lastP) > 0.0008) {
        stage.style.setProperty("--p", smooth.toFixed(4));
        lastP = smooth;
      }

      var shouldExpand = expanded ? smooth > 0.012 : smooth > 0.02;
      if (shouldExpand !== expanded) {
        expanded = shouldExpand;
        stage.classList.toggle("is-expanded", expanded);
      }

      var grow = smoothstep(0, 0.2, smooth);
      if (Math.abs(grow - lastGrow) > 0.002) {
        stage.style.setProperty("--grow", grow.toFixed(4));
        lastGrow = grow;
      }

      var s01 = smoothstep(FADE_01[0], FADE_01[1], smooth);
      var s12 = smoothstep(FADE_12[0], FADE_12[1], smooth);
      var o0 = 1 - s01;
      var o1 = s01 * (1 - s12);
      var o2 = s12;
      var active = o2 >= o1 && o2 >= o0 ? 2 : o1 >= o0 ? 1 : 0;

      // Incoming scene fades in while settling from a slight zoom; the scene
      // underneath eases back and dims, so the swap reads as one motion.
      var reveal = [1, s01, s12];
      var covered = [s01, s12, 0];
      // Slow drift inside each scene across its whole visible range.
      var span = [
        clamp(smooth / FADE_01[1], 0, 1),
        clamp((smooth - FADE_01[0]) / (FADE_12[1] - FADE_01[0]), 0, 1),
        clamp((smooth - FADE_12[0]) / (1 - FADE_12[0]), 0, 1)
      ];
      scenes.forEach(function (scene, i) {
        var r = reveal[i];
        var c = covered[i];
        var sp = span[i];
        if (Math.abs(r - lastO[i]) > 0.001) {
          scene.style.opacity = r.toFixed(3);
          scene.style.visibility = r < 0.002 ? "hidden" : "visible";
          scene.style.setProperty("--in", r.toFixed(4));
          lastO[i] = r;
        }
        if (Math.abs(c - lastOut[i]) > 0.001) {
          scene.style.setProperty("--out", c.toFixed(4));
          lastOut[i] = c;
        }
        if (Math.abs(sp - lastSp[i]) > 0.001) {
          scene.style.setProperty("--drift", sp.toFixed(4));
          lastSp[i] = sp;
        }
      });

      captions.forEach(function (cap) {
        var i = Number(cap.getAttribute("data-cap"));
        if (!i) return;
        var r = reveal[i];
        var c = covered[i];
        if (Math.abs(r - lastCapIn[i]) > 0.001) {
          cap.style.setProperty("--in", r.toFixed(4));
          lastCapIn[i] = r;
        }
        if (Math.abs(c - lastCapOut[i]) > 0.001) {
          cap.style.setProperty("--out", c.toFixed(4));
          lastCapOut[i] = c;
        }
      });

      bgLayers.forEach(function (layer, i) {
        var opacity = i === 0 ? 1 : i === 1 ? s01 : s12;
        if (Math.abs(opacity - lastBg[i]) > 0.002) {
          layer.style.opacity = opacity.toFixed(3);
          lastBg[i] = opacity;
        }
      });

      if (active !== lastActive) {
        lastActive = active;
        stage.dataset.scene = String(active);
        scenes.forEach(function (scene, i) {
          scene.classList.toggle("is-active", i === active);
        });
        dots.forEach(function (dot, i) {
          dot.classList.toggle("is-active", i === active);
        });
      }

      var gen = smoothstep(0.66, 0.92, smooth);
      if (Math.abs(gen - lastGen) > 0.002) {
        stage.style.setProperty("--gen", gen.toFixed(4));
        lastGen = gen;
      }
      if (o2 > 0.08) typePrompt();

      if (started && smooth !== target) {
        raf = window.requestAnimationFrame(frame);
      } else {
        lastTs = 0; // loop is idle; next wake starts with a fresh dt
      }
    }

    function wake() {
      if (!started || raf) return;
      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (started) return;
      started = true;
      snap = true;
      stage.classList.add("is-live");
      raf = window.requestAnimationFrame(frame);
    }

    function stop() {
      started = false;
      stage.classList.remove("is-live");
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    }

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          if (entries[0].isIntersecting) start();
          else stop();
        },
        { rootMargin: "240px 0px" }
      );
      observer.observe(stage);
    } else {
      start();
    }

    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
  }

  function init() {
    setupBanner();
    setupHeaderOffset();
    setupStatementWords();
    setupReveal();
    setupParallax();
    setupDemoPin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
