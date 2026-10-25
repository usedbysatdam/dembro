(function () {
  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

  function toast(message, tone) {
    let wrap = $(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    const el = document.createElement("div");
    el.className = "toast toast-" + (tone || "info");
    el.textContent = message;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    setTimeout(() => {
      el.classList.remove("is-visible");
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function getQuery() {
    return new URLSearchParams(window.location.search);
  }

  function setupNav() {
    const toggle = $("#navToggle");
    const nav = $("#mainNav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }
    const header = $(".site-header");
    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    $$("[data-site-search]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const params = new URLSearchParams();
        const q = String(data.get("q") || "").trim();
        const grade = String(data.get("grade") || "");
        if (q) params.set("q", q);
        if (grade) params.set("grade", grade);
        window.location.href = "resources.html" + (params.toString() ? "?" + params : "");
      });
    });
  }

  async function refreshHeader() {
    if (!window.Educrazy) return;
    const user = await Educrazy.getUser();
    document.body.classList.toggle("is-authed", Boolean(user));
    $$("[data-user-name]").forEach((el) => {
      el.textContent = user ? user.name || user.email : "";
    });
    $$("[data-user-plan]").forEach((el) => {
      el.textContent = user && user.plan === "premium" ? "Premium" : "Free";
    });
    document.dispatchEvent(new CustomEvent("educrazy:user", { detail: user }));
    return user;
  }

  function requireAuth(nextUrl) {
    const next = encodeURIComponent(nextUrl || window.location.pathname.split("/").pop());
    window.location.href = "login.html?next=" + next;
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupNav();
    refreshHeader();
    if (window.Educrazy) Educrazy.onChange(refreshHeader);
    $$("[data-current-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  });

  window.UI = { toast, getQuery, refreshHeader, requireAuth, $, $$ };
})();
