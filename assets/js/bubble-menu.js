(function () {
  const ITEMS = [
    {
      key: "home",
      label: "Home",
      href: "index.html",
      ariaLabel: "Home",
      rotation: -7,
      hoverBg: "#0249E1",
      hoverColor: "#ffffff"
    },
    {
      key: "library",
      label: "Learning Library",
      href: "resources.html",
      ariaLabel: "Learning Library",
      rotation: 6,
      hoverBg: "#EE3D5A",
      hoverColor: "#ffffff"
    },
    {
      key: "worksheets",
      label: "Worksheets",
      href: "resources.html?type=worksheet",
      ariaLabel: "Worksheets",
      rotation: -5,
      hoverBg: "#80B0EC",
      hoverColor: "#111111"
    },
    {
      key: "games",
      label: "Games",
      href: "resources.html?type=game",
      ariaLabel: "Games",
      rotation: 5,
      hoverBg: "#0249E1",
      hoverColor: "#ffffff"
    },
    {
      key: "lesson-plans",
      label: "Lesson Plans",
      href: "resources.html?type=lesson_plan",
      ariaLabel: "Lesson Plans",
      rotation: -4,
      hoverBg: "#DAFB71",
      hoverColor: "#111111"
    },
    {
      key: "pricing",
      label: "Pricing",
      href: "pricing.html",
      ariaLabel: "Pricing",
      rotation: 4,
      hoverBg: "#EE3D5A",
      hoverColor: "#ffffff"
    },
    {
      key: "schools",
      label: "For Schools",
      href: "pricing.html#schools",
      ariaLabel: "For Schools",
      rotation: -3,
      hoverBg: "#0249E1",
      hoverColor: "#ffffff"
    }
  ];

  function activeKey() {
    const page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    const params = new URLSearchParams(window.location.search);

    if (window.location.hash === "#schools") return "schools";
    if (page === "index.html" || page === "") return "home";
    if (page === "pricing.html") return "pricing";
    if (page === "game.html") return "games";
    if (page === "resources.html") {
      const type = params.get("type");
      if (type === "worksheet") return "worksheets";
      if (type === "game") return "games";
      if (type === "lesson_plan") return "lesson-plans";
      return "library";
    }
    return "";
  }

  function init() {
    const header = document.querySelector(".site-header");
    const inner =
      header &&
      (header.querySelector(".header-inner") || header.querySelector(".gfe-header-inner"));
    const brand =
      inner && (inner.querySelector(".brand") || inner.querySelector(".gfe-brand"));
    const nav = inner && inner.querySelector(".main-nav");
    const actions =
      inner &&
      (inner.querySelector(".header-actions") || inner.querySelector(".gfe-header-actions"));
    const oldToggle = inner && inner.querySelector(".nav-toggle");

    if (!header || !inner || !brand || !actions) return;

    const gsap = window.gsap;
    const current = activeKey();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const legacy = inner.classList.contains("header-inner");

    document.body.classList.add("bubble-menu-ready");
    header.classList.add("bubble-header");
    if (legacy) {
      inner.classList.add("bubble-header-inner");
      brand.classList.add("bubble-logo");
    }

    if (nav && nav.parentNode) nav.parentNode.removeChild(nav);
    if (oldToggle && oldToggle.parentNode) oldToggle.parentNode.removeChild(oldToggle);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "bubble-toggle";
    toggle.id = "bubbleMenuToggle";
    toggle.setAttribute("aria-label", "Toggle navigation");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "bubbleMenuOverlay");
    toggle.innerHTML =
      '<span class="bubble-menu-line"></span><span class="bubble-menu-line short"></span>';
    actions.appendChild(toggle);

    const overlay = document.createElement("div");
    overlay.className = "bubble-menu-overlay";
    overlay.id = "bubbleMenuOverlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML =
      '<nav class="bubble-menu-nav" aria-label="Main navigation"><ul class="pill-list"></ul></nav>';

    const list = overlay.querySelector(".pill-list");

    ITEMS.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "pill-col";
      li.style.setProperty("--col-index", String(index));

      const link = document.createElement("a");
      link.className = "pill-link";
      link.href = item.href;
      link.setAttribute("aria-label", item.ariaLabel);
      link.style.setProperty("--item-rot", item.rotation + "deg");
      link.style.setProperty("--hover-bg", item.hoverBg);
      link.style.setProperty("--hover-color", item.hoverColor);
      if (item.key === current) {
        link.classList.add("is-current");
        link.setAttribute("aria-current", "page");
      }

      const label = document.createElement("span");
      label.className = "pill-label";
      label.textContent = item.label;

      link.appendChild(label);
      li.appendChild(link);
      list.appendChild(li);
    });

    document.body.appendChild(overlay);

    const bubbles = Array.from(overlay.querySelectorAll(".pill-link"));
    const labels = Array.from(overlay.querySelectorAll(".pill-label"));
    let isOpen = false;
    let returnFocus = true;

    function applyRotations() {
      if (!gsap) return;
      const desktop = window.innerWidth >= 900;
      bubbles.forEach((bubble, index) => {
        const rotation = desktop ? ITEMS[index].rotation : 0;
        gsap.set(bubble, { rotation: rotation });
      });
    }

    function finishClose() {
      overlay.classList.remove("is-open", "is-closing");
      overlay.style.display = "none";
      if (gsap) gsap.set(overlay, { clearProps: "opacity,visibility" });
      document.body.classList.remove("bubble-menu-open");
      if (returnFocus) toggle.focus({ preventScroll: true });
    }

    function openMenu() {
      if (isOpen) return;
      isOpen = true;
      returnFocus = true;
      overlay.classList.add("is-open");
      overlay.classList.remove("is-closing");
      overlay.setAttribute("aria-hidden", "false");
      toggle.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("bubble-menu-open");

      if (gsap && !reduceMotion) {
        gsap.killTweensOf([overlay].concat(bubbles, labels));
        gsap.set(overlay, { display: "flex", autoAlpha: 0 });
        gsap.to(overlay, { autoAlpha: 1, duration: 0.24, ease: "power2.out" });
        gsap.set(bubbles, { scale: 0, transformOrigin: "50% 50%" });
        gsap.set(labels, { y: 24, autoAlpha: 0 });
        applyRotations();

        bubbles.forEach((bubble, index) => {
          const delay = index * 0.09 + gsap.utils.random(-0.035, 0.035);
          const tl = gsap.timeline({ delay: Math.max(0, delay) });
          tl.to(bubble, {
            scale: 1,
            duration: 0.5,
            ease: "back.out(1.5)"
          });
          if (labels[index]) {
            tl.to(
              labels[index],
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.45,
                ease: "power3.out"
              },
              "-=0.42"
            );
          }
        });
      } else {
        applyRotations();
      }

      window.setTimeout(function () {
        const first = bubbles[0];
        if (first) first.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 160);

      document.dispatchEvent(new CustomEvent("educrazy:menu", { detail: { open: true } }));
    }

    function closeMenu(shouldReturnFocus) {
      if (!isOpen) return;
      isOpen = false;
      returnFocus = shouldReturnFocus !== false;
      overlay.setAttribute("aria-hidden", "true");
      overlay.classList.add("is-closing");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");

      if (gsap && !reduceMotion) {
        gsap.killTweensOf([overlay].concat(bubbles, labels));
        const tl = gsap.timeline({ onComplete: finishClose });
        tl.to(labels, { y: 20, autoAlpha: 0, duration: 0.18, ease: "power3.in" }, 0);
        tl.to(
          bubbles,
          { scale: 0, duration: 0.2, ease: "power3.in" },
          0
        );
        tl.to(overlay, { autoAlpha: 0, duration: 0.24, ease: "power2.in" }, 0.04);
      } else {
        finishClose();
      }

      document.dispatchEvent(new CustomEvent("educrazy:menu", { detail: { open: false } }));
    }

    toggle.addEventListener("click", function () {
      if (isOpen) closeMenu(true);
      else openMenu();
    });

    overlay.addEventListener("click", function (event) {
      if (!event.target.closest(".pill-link")) closeMenu(true);
    });

    bubbles.forEach((bubble) => {
      bubble.addEventListener("click", function () {
        closeMenu(false);
      });
    });

    overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = bubbles.filter((bubble) => bubble.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (isOpen && !reduceMotion) applyRotations();
    });

    document.addEventListener("educrazy:user", function () {
      bubbles.forEach(function (bubble) {
        bubble.classList.remove("is-current");
        bubble.removeAttribute("aria-current");
      });
      const target = bubbles.find(function (bubble) {
        return bubble.getAttribute("href") === ITEMS.find((item) => item.key === activeKey())?.href;
      });
      if (target) {
        target.classList.add("is-current");
        target.setAttribute("aria-current", "page");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
