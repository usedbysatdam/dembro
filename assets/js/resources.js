(function () {
  const $ = UI.$;
  const $$ = UI.$$;
  const toast = UI.toast;

  const ICONS = {
    worksheet:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg>',
    game:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h10a5 5 0 0 1 4.8 6.4l-.7 2.4A2.4 2.4 0 0 1 16.6 18l-1.4-1.5H8.8L7.4 18a2.4 2.4 0 0 1-4.5-1.2l-.7-2.4A5 5 0 0 1 7 8Z"/><path d="M7.5 12v2M6.5 13h2M15.5 12.5h.01M17.5 14h.01"/></svg>',
    lesson_plan:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v3H8z"/><path d="M6 5H4v16h16V5h-2"/><path d="M8 11h8M8 15h5"/></svg>',
    activity:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v5L5 18a2.5 2.5 0 0 0 2.3 3.5h9.4A2.5 2.5 0 0 0 19 18l-5-10V3"/><path d="M7.5 14h9"/></svg>',
    bookmark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>',
    lock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>',
    empty:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
  };

  const TYPE_LABELS = {
    worksheet: "Worksheet",
    game: "Game",
    lesson_plan: "Lesson plan",
    activity: "Activity"
  };

  const EXTERNAL_GAMES = {
    "ec-games-live": "zep-game/index.html"
  };

  const GRADE_ORDER = [
    "Pre-K",
    "Kindergarten",
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th"
  ];

  const state = {
    all: [],
    filtered: [],
    q: "",
    grades: [],
    subjects: [],
    types: [],
    premiumOnly: false,
    sort: "popular",
    limit: 12
  };

  let savedIds = [];
  let doneIds = [];
  let currentUser = null;
  let activeResourceId = null;

  const esc = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const isPremiumUser = () => Boolean(currentUser && currentUser.plan === "premium");
  const isLocked = (resource) => Boolean(resource.is_premium) && !isPremiumUser();
  const isSaved = (id) => savedIds.includes(Number(id));
  const isDone = (id) => doneIds.includes(Number(id));

  function formatDownloads(n) {
    const num = Number(n) || 0;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return String(num);
  }

  function accentStyle(accent) {
    return `--accent:${accent};--accent-soft:${accent}30`;
  }

  /* ---------------- data ---------------- */

  async function fetchResources() {
    if (Educrazy.client) {
      const { data, error } = await Educrazy.client
        .from("resources")
        .select("*")
        .order("downloads", { ascending: false });
      if (error) throw error;
      return data || [];
    }
    const response = await fetch("data/resources.json");
    if (!response.ok) throw new Error("Could not load the demo library.");
    return response.json();
  }

  /* ---------------- filters ---------------- */

  function countsFor(field, value) {
    return state.all.filter((r) => String(r[field]) === String(value)).length;
  }

  function filterOption(field, value, label) {
    const checked = state[field + "s"].includes(value);
    return `
      <label class="filter-option">
        <input type="checkbox" data-filter="${field}" value="${esc(value)}" ${checked ? "checked" : ""}>
        <span>${esc(label)}</span>
        <span class="count">${countsFor(field, value)}</span>
      </label>`;
  }

  function buildFilters() {
    const grades = Array.from(new Set(state.all.map((r) => r.grade))).sort(
      (a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b)
    );
    const subjects = Array.from(new Set(state.all.map((r) => r.subject))).sort();
    const types = Array.from(new Set(state.all.map((r) => r.type))).sort();

    $("#gradeFilters").innerHTML = grades
      .map((grade) => filterOption("grade", grade, grade))
      .join("");
    $("#subjectFilters").innerHTML = subjects
      .map((subject) => filterOption("subject", subject, subject))
      .join("");
    $("#typeFilters").innerHTML = types
      .map((type) => filterOption("type", type, TYPE_LABELS[type] || type))
      .join("");

    $("#filters").addEventListener("change", (event) => {
      const input = event.target.closest("input[data-filter]");
      if (!input) return;
      const field = input.dataset.filter;
      const list = field + "s";
      if (input.checked) {
        if (!state[list].includes(input.value)) state[list].push(input.value);
      } else {
        state[list] = state[list].filter((value) => value !== input.value);
      }
      state.limit = 12;
      apply();
      syncUrl();
    });

    $("#premiumOnly").addEventListener("change", (event) => {
      state.premiumOnly = event.target.checked;
      state.limit = 12;
      apply();
    });

    $("#resetFilters").addEventListener("click", () => {
      state.grades = [];
      state.subjects = [];
      state.types = [];
      state.premiumOnly = false;
      state.q = "";
      state.limit = 12;
      $("#searchInput").value = "";
      $("#premiumOnly").checked = false;
      $$('#filters input[type="checkbox"]').forEach((input) => {
        input.checked = false;
      });
      apply();
      syncUrl();
    });
  }

  /* ---------------- rendering ---------------- */

  function skeleton() {
    return '<div class="skeleton"></div>'.repeat(6);
  }

  function cardTemplate(resource) {
    const locked = isLocked(resource);
    const saved = isSaved(resource.id);
    return `
      <article class="resource-card" data-id="${resource.id}" tabindex="0" role="button" aria-label="Open ${esc(resource.title)}">
        <div class="resource-thumb" style="${accentStyle(resource.accent || "#0249E1")}">
          <span class="resource-badge">${esc(TYPE_LABELS[resource.type] || resource.type)}</span>
          ${resource.is_premium ? `<span class="resource-premium">${ICONS.lock}Premium</span>` : ""}
          ${ICONS[resource.type] || ICONS.worksheet}
        </div>
        <div class="resource-body">
          <h3>${esc(resource.title)}</h3>
          <div class="resource-meta">${esc(resource.grade)} &middot; ${esc(resource.subject)}${resource.standards ? " &middot; " + esc(resource.standards) : ""}</div>
          <p class="resource-desc">${esc(resource.description)}</p>
          <div class="resource-foot">
            <span class="resource-dl">${ICONS.download}${formatDownloads(resource.downloads)}</span>
            <button class="save-btn ${saved ? "is-saved" : ""}" data-save="${resource.id}" aria-label="${saved ? "Remove from" : "Save to"} collection" title="Save to collection">
              <svg viewBox="0 0 24 24" fill="${saved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>
            </button>
          </div>
        </div>
      </article>`;
  }

  function apply() {
    const q = state.q.trim().toLowerCase();
    let list = state.all.filter((resource) => {
      if (state.grades.length && !state.grades.includes(resource.grade)) return false;
      if (state.subjects.length && !state.subjects.includes(resource.subject)) return false;
      if (state.types.length && !state.types.includes(resource.type)) return false;
      if (state.premiumOnly && !resource.is_premium) return false;
      if (!q) return true;
      return [resource.title, resource.description, resource.subject, resource.grade, resource.standards]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    if (state.sort === "newest") {
      list = list.sort((a, b) => Number(b.id) - Number(a.id));
    } else if (state.sort === "az") {
      list = list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list = list.sort((a, b) => Number(b.downloads) - Number(a.downloads));
    }

    state.filtered = list;
    const visible = list.slice(0, state.limit);

    $("#resourceGrid").innerHTML = visible.length
      ? visible.map(cardTemplate).join("")
      : `<div class="empty-state" style="grid-column:1/-1">
           ${ICONS.empty}
           <h3>No resources match those filters</h3>
           <p>Try clearing a filter or searching for a broader skill.</p>
           <button class="btn btn-outline btn-sm" type="button" onclick="document.getElementById('resetFilters').click()">Reset filters</button>
         </div>`;

    $("#resultsCount").textContent = `${list.length} resource${list.length === 1 ? "" : "s"}`;
    $("#loadMoreWrap").classList.toggle("hidden", visible.length >= list.length);
    $("#resultsTitle").textContent = titleForFilters(list.length);
  }

  function titleForFilters(total) {
    if (state.q) return `Results for "${state.q}"`;
    if (state.types.length === 1) return (TYPE_LABELS[state.types[0]] || "Resource") + "s";
    if (state.grades.length === 1) return `Grade ${state.grades[0]} resources`;
    if (state.subjects.length === 1) return `${state.subjects[0]} resources`;
    if (total === 0) return "No resources found";
    return "All resources";
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    state.grades.forEach((grade) => params.append("grade", grade));
    state.subjects.forEach((subject) => params.append("subject", subject));
    state.types.forEach((type) => params.append("type", type));
    if (state.premiumOnly) params.set("premium", "1");
    const query = params.toString();
    history.replaceState(null, "", "resources.html" + (query ? "?" + query : ""));
  }

  /* ---------------- save & progress ---------------- */

  async function toggleSave(id) {
    if (!currentUser) {
      toast("Create a free account to save resources.", "error");
      const next = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
      setTimeout(() => (window.location.href = "login.html?next=" + next), 700);
      return;
    }
    const numeric = Number(id);
    if (isSaved(numeric)) {
      const { error } = await Educrazy.unsaveResource(numeric);
      if (error) return toast("Could not remove this resource.", "error");
      savedIds = savedIds.filter((item) => item !== numeric);
      toast("Removed from your collection.");
    } else {
      const { error } = await Educrazy.saveResource(numeric);
      if (error) return toast("Could not save this resource.", "error");
      savedIds.push(numeric);
      toast("Saved to your collection.");
    }
    refreshSaveButtons();
    if (activeResourceId === numeric) renderModalMeta();
  }

  function refreshSaveButtons() {
    $$("[data-save]").forEach((button) => {
      const saved = isSaved(button.dataset.save);
      button.classList.toggle("is-saved", saved);
      button.setAttribute("aria-label", (saved ? "Remove from" : "Save to") + " collection");
      const svg = button.querySelector("svg");
      if (svg) svg.setAttribute("fill", saved ? "currentColor" : "none");
    });
  }

  /* ---------------- modal ---------------- */

  function openModal(id) {
    const resource = state.all.find((item) => Number(item.id) === Number(id));
    if (!resource) return;
    activeResourceId = Number(id);
    const modal = $("#resourceModal");
    const hero = $("#modalHero");
    hero.style.cssText = accentStyle(resource.accent || "#0249E1");
    hero.innerHTML = ICONS[resource.type] || ICONS.worksheet;
    $("#modalTitle").textContent = resource.title;
    $("#modalDesc").textContent = resource.description;
    renderModalMeta();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#modalClose").focus();
  }

  function renderModalMeta() {
    const resource = state.all.find((item) => Number(item.id) === activeResourceId);
    if (!resource) return;
    const locked = isLocked(resource);
    const saved = isSaved(resource.id);
    const done = isDone(resource.id);

    $("#modalMeta").innerHTML = `
      <span class="pill">${esc(TYPE_LABELS[resource.type] || resource.type)}</span>
      <span class="pill">Grade ${esc(resource.grade)}</span>
      <span class="pill">${esc(resource.subject)}</span>
      ${resource.standards ? `<span class="pill">${esc(resource.standards)}</span>` : ""}
      <span class="pill ${resource.is_premium ? "gold" : "green"}">${resource.is_premium ? "Premium" : "Free"}</span>
      <span class="pill">${ICONS.download}${formatDownloads(resource.downloads)}</span>`;

    $("#modalLock").innerHTML = locked
      ? `<div class="premium-lock">
           ${ICONS.lock}
           <div>
             <strong>This is a premium resource</strong>
             <p>Start a premium membership to unlock unlimited downloads, games, and guided lessons.</p>
           </div>
         </div>`
      : "";

    $("#modalActions").innerHTML = `
      ${
        locked
          ? `<a class="btn btn-primary" href="pricing.html">Upgrade to unlock</a>`
          : `<button class="btn btn-primary" data-action="open">${
              resource.type === "game" ? "Play game" : resource.type === "lesson_plan" ? "View lesson plan" : "Download resource"
            }</button>`
      }
      <button class="btn ${saved ? "btn-soft" : "btn-outline"} btn-save-modal" data-action="save">
        ${saved ? "Saved" : "Save to collection"}
      </button>
      ${
        currentUser && !locked
          ? `<button class="btn btn-ghost" data-action="complete" ${done ? "disabled" : ""}>${done ? "Completed" : "Mark as complete"}</button>`
          : ""
      }`;
  }

  function closeModal() {
    const modal = $("#resourceModal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeResourceId = null;
  }

  async function modalAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const resource = state.all.find((item) => Number(item.id) === activeResourceId);
    if (!resource) return;

    if (action === "save") {
      await toggleSave(resource.id);
      return;
    }

    if (action === "open" && resource.type === "game") {
      window.location.href =
        resource.url || EXTERNAL_GAMES[resource.slug] || "game.html?id=" + resource.id;
      return;
    }

    if (!currentUser) {
      toast("Log in to continue with this resource.", "error");
      const next = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
      setTimeout(() => (window.location.href = "login.html?next=" + next), 700);
      return;
    }

    if (action === "complete") {
      const { error } = await Educrazy.markComplete(resource.id);
      if (error) return toast("Could not update progress.", "error");
      if (!doneIds.includes(Number(resource.id))) doneIds.push(Number(resource.id));
      toast("Nice work! Marked as complete.");
      renderModalMeta();
      return;
    }

    if (action === "open") {
      toast("Demo mode: this is where the " + (TYPE_LABELS[resource.type] || "resource").toLowerCase() + " would open.");
    }
  }

  /* ---------------- init ---------------- */

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.q = params.get("q") || "";
    state.grades = params.getAll("grade");
    state.subjects = params.getAll("subject");
    state.types = params.getAll("type").filter((type) => TYPE_LABELS[type]);
    state.premiumOnly = params.get("premium") === "1";

    $("#searchInput").value = state.q;
    $("#premiumOnly").checked = state.premiumOnly;

    $("#resourceGrid").innerHTML = skeleton();

    try {
      state.all = await fetchResources();
    } catch (error) {
      $("#resourceGrid").innerHTML = `<div class="empty-state" style="grid-column:1/-1">
          ${ICONS.empty}
          <h3>Library could not load</h3>
          <p>Serve this folder over HTTP (for example <code>npx serve .</code>) so the demo data can load.</p>
        </div>`;
      $("#resultsCount").textContent = "0 resources";
      return;
    }

    buildFilters();
    apply();

    let timer;
    $("#searchInput").addEventListener("input", (event) => {
      clearTimeout(timer);
      const value = event.target.value;
      timer = setTimeout(() => {
        state.q = value;
        state.limit = 12;
        apply();
        syncUrl();
      }, 200);
    });

    $("#librarySearchForm").addEventListener("submit", (event) => event.preventDefault());

    $("#sortSelect").addEventListener("change", (event) => {
      state.sort = event.target.value;
      apply();
    });

    $("#loadMoreBtn").addEventListener("click", () => {
      state.limit += 9;
      apply();
    });

    $("#filtersToggle").addEventListener("click", () => {
      $("#filters").classList.toggle("is-open");
    });

    $("#resourceGrid").addEventListener("click", (event) => {
      const saveButton = event.target.closest("[data-save]");
      if (saveButton) {
        event.stopPropagation();
        toggleSave(saveButton.dataset.save);
        return;
      }
      const card = event.target.closest(".resource-card");
      if (card) openModal(card.dataset.id);
    });

    $("#resourceGrid").addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest(".resource-card");
      if (card) {
        event.preventDefault();
        openModal(card.dataset.id);
      }
    });

    $("#modalActions").addEventListener("click", modalAction);
    $("#modalClose").addEventListener("click", closeModal);
    $("#resourceModal").addEventListener("click", (event) => {
      if (event.target === $("#resourceModal")) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });

    currentUser = await Educrazy.getUser();
    if (currentUser) {
      savedIds = (await Educrazy.getSavedIds()).map(Number);
      doneIds = (await Educrazy.getDoneIds()).map(Number);
      refreshSaveButtons();
    }

    document.addEventListener("educrazy:user", async (event) => {
      currentUser = event.detail;
      if (currentUser) {
        savedIds = (await Educrazy.getSavedIds()).map(Number);
        doneIds = (await Educrazy.getDoneIds()).map(Number);
        refreshSaveButtons();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
