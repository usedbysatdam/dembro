(function () {
  const $ = UI.$;
  const toast = UI.toast;

  const ICONS = {
    worksheet:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg>',
    game:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h10a5 5 0 0 1 4.8 6.4l-.7 2.4A2.4 2.4 0 0 1 16.6 18l-1.4-1.5H8.8L7.4 18a2.4 2.4 0 0 1-4.5-1.2l-.7-2.4A5 5 0 0 1 7 8Z"/><path d="M7.5 12v2M6.5 13h2M15.5 12.5h.01M17.5 14h.01"/></svg>',
    lesson_plan:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v3H8z"/><path d="M6 5H4v16h16V5h-2"/><path d="M8 11h8M8 15h5"/></svg>',
    activity:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v5L5 18a2.5 2.5 0 0 0 2.3 3.5h9.4A2.5 2.5 0 0 0 19 18l-5-10V3"/><path d="M7.5 14h9"/></svg>'
  };

  const TYPE_LABELS = {
    worksheet: "Lembar kerja",
    game: "Game",
    lesson_plan: "Rencana pelajaran",
    activity: "Aktivitas"
  };

  const SUBJECTS = [
    { id: "math", label: "Matematika", icon: "∑" },
    { id: "reading", label: "Membaca", icon: "📖" },
    { id: "science", label: "IPA", icon: "🔬" },
    { id: "writing", label: "Menulis", icon: "✍️" },
    { id: "social", label: "IPS", icon: "🌍" }
  ];

  const METHODS = [
    { id: "game", label: "Kuis Game" },
    { id: "worksheet", label: "Lembar kerja" },
    { id: "lesson_plan", label: "Rencana pelajaran" },
    { id: "activity", label: "Aktivitas" }
  ];

  const GOALS = [
    { id: "exam", label: "Persiapan Ujian" },
    { id: "remedial", label: "Remedial" },
    { id: "enrichment", label: "Pengayaan" },
    { id: "habit", label: "Kebiasaan Belajar" }
  ];

  const SUBJECT_LABELS = {
    Math: "Matematika",
    Reading: "Membaca",
    Science: "IPA",
    Writing: "Menulis",
    "Social Studies": "IPS",
    Typing: "Menulis"
  };

  const esc = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  let user = null;
  let allResources = [];
  let savedIds = [];
  let doneIds = [];
  let savedResources = [];
  let learnHubData = null;
  let currentCalendarDate = new Date();
  let selectedSubjects = [];
  let selectedMethods = [];
  let selectedGoals = [];
  let currentEdumateFilter = "all";
  let calendarInitialised = false;

  // ==================== Modal helpers ====================
  function openModal(selector) {
    const modal = $(selector);
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
  }

  function closeModal(selector) {
    const modal = typeof selector === "string" ? $(selector) : selector;
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
    if (!document.querySelector(".modal-backdrop.is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  // ==================== Date helpers ====================
  function toLocalISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseLocalDate(value) {
    const [y, m, d] = String(value).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  // ==================== Data Fetching ====================
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
    if (!response.ok) throw new Error("Could not load resources.");
    return response.json();
  }

  async function fetchLearnHubData() {
    try {
      const response = await fetch("data/learn-hub.json");
      if (!response.ok) throw new Error("Could not load learn hub data.");
      return await response.json();
    } catch (e) {
      console.warn("Learn hub data not available:", e);
      return { mentors: [], sessions: [], posts: [], contests: [] };
    }
  }

  // ==================== Preferences (localStorage) ====================
  const PREFS_KEY = "educrazy_learn_prefs";
  const PREFS_SEEN_KEY = "educrazy_prefs_seen";
  const DEMO_SESSIONS_KEY = "educrazy_demo_sessions";
  const USER_ADDRESS_KEY = "edumate_user_address";

  function readDemoSessions() {
    try {
      const list = JSON.parse(localStorage.getItem(DEMO_SESSIONS_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function loadUserAddress() {
    try {
      return JSON.parse(localStorage.getItem(USER_ADDRESS_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function formatUserAddress() {
    const addr = loadUserAddress();
    if (!addr || !addr.street || !addr.city) return "";
    return `${addr.street}, ${addr.city}${addr.notes ? ", " + addr.notes : ""}`;
  }

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (saved) {
        selectedSubjects = saved.subjects || [];
        selectedMethods = saved.methods || [];
        selectedGoals = saved.goals || [];
      }
    } catch (e) {
      selectedSubjects = [];
      selectedMethods = [];
      selectedGoals = [];
    }
  }

  function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      subjects: selectedSubjects,
      methods: selectedMethods,
      goals: selectedGoals
    }));
  }

  function prefsSeen() {
    return localStorage.getItem(PREFS_SEEN_KEY) === "true";
  }

  function markPrefsSeen() {
    localStorage.setItem(PREFS_SEEN_KEY, "true");
  }

  function hasPrefs() {
    return selectedSubjects.length > 0 || selectedMethods.length > 0 || selectedGoals.length > 0;
  }

  // ==================== Rendering Helpers ====================
  function thumb(resource) {
    const accent = resource.accent || "#0249E1";
    return `<span class="saved-thumb" style="--accent:${accent};--accent-soft:${accent}30">${
      ICONS[resource.type] || ICONS.worksheet
    }</span>`;
  }

  function itemTemplate(resource, removable) {
    return `
      <div class="saved-item" data-open="${resource.id}">
        ${thumb(resource)}
        <div class="saved-info">
          <strong>${esc(resource.title)}</strong>
          <small>Grade ${esc(resource.grade)} &middot; ${esc(resource.subject)} &middot; ${esc(
      TYPE_LABELS[resource.type] || resource.type
    )}</small>
        </div>
        ${
          removable
            ? `<button class="save-btn" data-remove="${resource.id}" aria-label="Remove from collection">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
               </button>`
            : ""
        }
      </div>`;
  }

  function renderSaved() {
    const list = $("#savedList");
    if (!savedResources.length) {
      list.innerHTML = `
        <div class="dash-empty">
          <p>You have not saved anything yet. Browse the library and tap the bookmark icon to build a collection.</p>
          <a class="btn btn-outline btn-sm" href="resources.html">Explore resources</a>
        </div>`;
      return;
    }
    list.innerHTML = savedResources.map((resource) => itemTemplate(resource, true)).join("");
  }

  function getRecommendationScore(resource) {
    let score = 0;
    const mappedSubject = SUBJECT_LABELS[resource.subject] || resource.subject;
    if (selectedSubjects.includes(mappedSubject)) score += 100;
    if (selectedMethods.includes(resource.type)) score += 50;
    if (user && user.grade && resource.grade === user.grade) score += 20;
    score += Math.min(Number(resource.downloads || 0) / 10000, 10);
    return score;
  }

  function renderRecommended() {
    const list = $("#recommendedList");
    const pool = allResources
      .filter((resource) => !savedIds.includes(Number(resource.id)))
      .map((resource) => ({ resource, score: getRecommendationScore(resource) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.resource);

    list.innerHTML = pool.length
      ? pool.map((resource) => itemTemplate(resource, false)).join("")
      : `<div class="dash-empty"><p>You have saved everything we would recommend. Nice work!</p></div>`;

    // Show edit prefs button if prefs exist
    const editBtn = $("#editPrefsBtn");
    if (editBtn) editBtn.style.display = hasPrefs() ? "inline-flex" : "none";
  }

  function renderCounts() {
    const saved = savedIds.length;
    const done = doneIds.length;
    $("#savedCount").textContent = saved;
    $("#doneCount").textContent = done;

    const pct = saved ? Math.min(100, Math.round((done / saved) * 100)) : 0;
    $("#planProgress").style.width = pct + "%";
    $("#planProgressPct").textContent = pct + "%";
    $("#planProgressLabel").textContent = saved
      ? `Completed ${Math.min(done, saved)} of ${saved} saved`
      : "No saved resources yet";
  }

  function renderPlan() {
    const premium = user.plan === "premium";
    $("#planName").textContent = premium ? "Premium" : "Free";
    $("#planBadge").textContent = premium ? "Premium member" : "Free plan";
    $("#planTitle").textContent = premium
      ? "You have unlimited access"
      : "You are on the free plan";
    $("#planDesc").textContent = premium
      ? "Every worksheet, game, lesson plan, and guided lesson is unlocked for this account."
      : "Unlock unlimited downloads, guided lessons, and progress insights with premium.";
    const cta = $("#planCta");
    cta.textContent = premium ? "Manage membership" : "Upgrade to premium";
    cta.className = premium ? "btn btn-soft" : "btn btn-primary";
  }

  async function removeSaved(id) {
    const { error } = await Educrazy.unsaveResource(id);
    if (error) return toast("Could not remove this resource.", "error");
    savedIds = savedIds.filter((item) => item !== Number(id));
    savedResources = savedResources.filter((resource) => Number(resource.id) !== Number(id));
    renderSaved();
    renderCounts();
    toast("Removed from your collection.");
  }

  // ==================== Tab Switching ====================
  const PANEL_RENDERERS = {
    progress: () => renderProgress(),
    calendar: () => {
      if (!calendarInitialised) {
        focusCalendarOnNextSession();
        calendarInitialised = true;
      }
      renderCalendar();
      renderAgenda();
    },
    community: () => {
      if (communityLoaded) renderCommunity();
      else loadCommunity();
    },
    contests: () => renderContests(),
    edumate: () => renderEdumate()
  };

  function focusCalendarOnNextSession() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = (learnHubData.sessions || [])
      .filter((s) => parseLocalDate(s.date) >= today)
      .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date))[0];
    if (upcoming) currentCalendarDate = parseLocalDate(upcoming.date);
  }

  function switchTab(tabName) {
    document.querySelectorAll(".hub-tab").forEach((btn) => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });
    document.querySelectorAll(".hub-panel").forEach((panel) => {
      const isActive = panel.id === "panel-" + tabName;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });

    const render = PANEL_RENDERERS[tabName];
    if (render) render();

    scrollToPanel(tabName);
  }

  // Bring the chosen panel into view instead of leaving the user at the top of
  // the page, offset by the sticky header (and the desktop tab strip).
  function scrollToPanel(tabName) {
    const panel = $("#panel-" + tabName);
    if (!panel) return;

    const header = document.querySelector(".site-header");
    const tabs = document.querySelector(".hub-tabs");
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const tabsVisible = tabs && tabs.getBoundingClientRect().height > 0;
    const offset = headerH + (tabsVisible ? tabs.getBoundingClientRect().height + 20 : 12);

    requestAnimationFrame(() => {
      const top = panel.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
  }

  // ==================== Progress Panel ====================
  function renderProgress() {
    const saved = savedIds.length;
    const done = doneIds.length;
    const pct = saved ? Math.min(100, Math.round((done / saved) * 100)) : 0;

    const subjectStats = {};
    allResources.forEach((r) => {
      const isSaved = savedIds.includes(Number(r.id));
      const isDone = doneIds.includes(Number(r.id));
      if (!isSaved && !isDone) return;
      const label = SUBJECT_LABELS[r.subject] || r.subject;
      if (!subjectStats[label]) subjectStats[label] = { saved: 0, done: 0 };
      if (isSaved) subjectStats[label].saved++;
      if (isDone) subjectStats[label].done++;
    });

    const circumference = 2 * Math.PI * 54;
    const html = `
      <div class="progress-summary">
        <div class="progress-ring-wrap">
          <svg class="progress-ring" viewBox="0 0 120 120">
            <circle class="progress-ring-bg" cx="60" cy="60" r="54" fill="none" stroke="var(--line)" stroke-width="8"/>
            <circle class="progress-ring-fg" cx="60" cy="60" r="54" fill="none" stroke="var(--green-600)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${(circumference - (circumference * pct) / 100).toFixed(1)}" transform="rotate(-90 60 60)"/>
          </svg>
          <div class="progress-ring-label">
            <strong>${pct}%</strong>
            <span>Completion</span>
          </div>
        </div>
        <div class="progress-stats">
          <div class="progress-stat"><strong>${saved}</strong><span>Saved</span></div>
          <div class="progress-stat"><strong>${done}</strong><span>Completed</span></div>
          <div class="progress-stat"><strong>${Math.max(0, saved - done)}</strong><span>In Progress</span></div>
        </div>
      </div>
    `;

    $("#progressOverview").innerHTML = html;
    renderSubjectBars(subjectStats);
    renderActivityHeatmap();
  }

  function renderSubjectBars(subjectStats) {
    const container = $("#subjectBars");
    const subjects = Object.keys(subjectStats).sort((a, b) => subjectStats[b].saved - subjectStats[a].saved);
    if (!subjects.length) {
      container.innerHTML = '<div class="dash-empty"><p>Belum ada data mapel. Simpan beberapa materi untuk melihat progres per mapel.</p></div>';
      return;
    }
    container.innerHTML = subjects.map((subject) => {
      const stats = subjectStats[subject];
      const total = Math.max(stats.saved, stats.done);
      const pct = total ? Math.round((stats.done / total) * 100) : 0;
      return `
        <div class="subject-bar">
          <div class="subject-bar-head">
            <span class="subject-name">${esc(subject)}</span>
            <span class="subject-pct">${pct}%</span>
          </div>
          <div class="progress-track"><i style="width:${pct}%"></i></div>
          <div class="subject-bar-foot">
            <span>${stats.done}/${total} selesai</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderActivityHeatmap() {
    const container = $("#activityHeatmap");
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    // Deterministic demo activity derived from completed resource ids
    const counts = new Array(7).fill(0);
    doneIds.forEach((id, idx) => {
      counts[(Number(id) + idx) % 7] += 1;
    });

    container.innerHTML = `
      <div class="heatmap-grid">
        ${days.map((date, idx) => {
          const count = counts[idx];
          const level = count === 0 ? 0 : count === 1 ? 1 : 2;
          const label = date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
          return `
            <div class="heatmap-col">
              <div class="heatmap-cell ${count ? "active" : ""} level-${level}" title="${esc(label)} — ${count} aktivitas"></div>
              <span class="heatmap-label">${DAY_NAMES[date.getDay()]}<small>${date.getDate()}</small></span>
            </div>
          `;
        }).join("")}
      </div>
      <div class="heatmap-legend">
        <span>Sedikit</span>
        <div class="heatmap-legend-colors">
          <span class="level-0"></span>
          <span class="level-1"></span>
          <span class="level-2"></span>
        </div>
        <span>Banyak</span>
      </div>
    `;
  }

  // ==================== Calendar Panel ====================
  const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  function renderCalendar() {
    const wrap = $("#calendarWrap");
    if (!wrap) return;
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessionsByDay = {};
    learnHubData.sessions.forEach((s) => {
      const d = parseLocalDate(s.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const day = d.getDate();
      if (!sessionsByDay[day]) sessionsByDay[day] = [];
      sessionsByDay[day].push(s);
    });

    let html = `
      <div class="calendar-header">
        <button class="calendar-nav" type="button" data-cal-nav="prev" aria-label="Bulan sebelumnya">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h3 class="calendar-title">${MONTH_NAMES[month]} ${year}</h3>
        <button class="calendar-nav" type="button" data-cal-nav="next" aria-label="Bulan berikutnya">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div class="calendar-grid">
        <div class="calendar-day-names">${DAY_NAMES.map((d) => `<div>${d}</div>`).join("")}</div>
        <div class="calendar-days">
    `;

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day other-month" aria-hidden="true"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const isToday = dayDate.getTime() === today.getTime();
      const daySessions = sessionsByDay[day] || [];
      const hasSessions = daySessions.length > 0;

      html += `
        <button class="calendar-day ${isToday ? "today" : ""} ${hasSessions ? "has-sessions" : ""}" type="button" data-day="${day}">
          <span class="calendar-day-number">${day}</span>
          ${
            hasSessions
              ? `<div class="calendar-day-dots">${daySessions.slice(0, 3).map(() => "<span></span>").join("")}${
                  daySessions.length > 3 ? `<span class="more">+${daySessions.length - 3}</span>` : ""
                }</div>`
              : ""
          }
        </button>
      `;
    }

    html += `</div></div>`;
    wrap.innerHTML = html;

    wrap.querySelectorAll(".calendar-day[data-day]").forEach((cell) => {
      cell.addEventListener("click", () => {
        wrap.querySelectorAll(".calendar-day.is-selected").forEach((c) => c.classList.remove("is-selected"));
        cell.classList.add("is-selected");
        showDaySessions(Number(cell.dataset.day), year, month);
      });
    });

    wrap.querySelectorAll("[data-cal-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const step = btn.dataset.calNav === "prev" ? -1 : 1;
        currentCalendarDate = new Date(year, month + step, 1);
        renderCalendar();
        renderAgenda();
      });
    });
  }

  const STATUS_LABELS = {
    scheduled: "Terjadwal",
    completed: "Selesai",
    cancelled: "Dibatalkan"
  };

  const TYPE_TEXT = {
    online: "Online",
    offline: "Offline",
    offline_privat: "Offline Privat"
  };

  function showDaySessions(day, year, month) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const sessions = learnHubData.sessions
      .filter((s) => s.date === dateStr)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const mentorMap = Object.fromEntries(learnHubData.mentors.map((m) => [m.id, m]));
    const heading = parseLocalDate(dateStr).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const html = `
      <div class="day-sessions">
        <h4>${esc(heading)}</h4>
        ${
          sessions.length === 0
            ? `<div class="dash-empty"><p>Tidak ada jadwal di tanggal ini.</p></div>`
            : sessions
                .map((s) => {
                  const mentor = mentorMap[s.mentorId];
                  const location =
                    s.type === "offline" && s.address
                      ? esc(s.address)
                      : s.type === "offline_privat" && s.userAddress
                      ? esc(s.userAddress)
                      : "";
                  return `
            <div class="session-card" data-session-id="${esc(s.id)}">
              <div class="session-info">
                <strong>${esc(s.title)}</strong>
                <small>${esc(s.time)} &middot; ${s.duration} menit &middot; ${esc(TYPE_TEXT[s.type] || s.type)}</small>
                ${mentor ? `<small>Dengan ${esc(mentor.name)}</small>` : ""}
                ${location ? `<small>${location}</small>` : ""}
                ${s.type === "online" && s.zoomLink ? `<a href="${esc(s.zoomLink)}" target="_blank" rel="noopener">Buka link kelas</a>` : ""}
              </div>
              <span class="session-status ${esc(s.status)}">${esc(STATUS_LABELS[s.status] || s.status)}</span>
            </div>
          `;
                })
                .join("")
        }
      </div>
    `;
    $("#agendaList").innerHTML = html;
  }

  function renderAgenda() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = learnHubData.sessions
      .filter((s) => parseLocalDate(s.date) >= today && s.status === "scheduled")
      .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date) || String(a.time).localeCompare(String(b.time)))
      .slice(0, 6);

    const mentorMap = Object.fromEntries(learnHubData.mentors.map((m) => [m.id, m]));

    if (!upcoming.length) {
      $("#agendaList").innerHTML =
        '<div class="dash-empty"><p>Tidak ada jadwal mendatang. Buka tab Edumate untuk membuat jadwal baru.</p></div>';
      return;
    }

    $("#agendaList").innerHTML = upcoming
      .map((s) => {
        const mentor = mentorMap[s.mentorId];
        const date = parseLocalDate(s.date);
        return `
        <div class="agenda-item" data-session-id="${esc(s.id)}">
          <div class="agenda-date">
            <strong>${date.getDate()}</strong>
            <span>${MONTH_NAMES[date.getMonth()].slice(0, 3)}</span>
          </div>
          <div class="agenda-info">
            <strong>${esc(s.title)}</strong>
            <small>${esc(s.time)} &middot; ${s.duration} menit &middot; ${esc(TYPE_TEXT[s.type] || s.type)}</small>
            <small>${mentor ? esc(mentor.name) : "Tentor demo"}</small>
          </div>
          ${
            s.type === "online" && s.zoomLink
              ? `<a class="btn btn-ghost btn-sm" href="${esc(s.zoomLink)}" target="_blank" rel="noopener">Join</a>`
              : ""
          }
        </div>
      `;
      })
      .join("");
  }

  // ==================== Community Panel (Threads-style feed) ====================
  // Open sharing space between members and Edumates. Not a classroom:
  // posts are free-form, replies thread inline, and nothing is graded.
  const COMMUNITY_TOPICS = ["Umum", "Curhat", "Tanya", "Tips", "Pencapaian", "Rekomendasi"];
  const COMMUNITY_IMAGES = {
    "trophy-star": { emoji: "🏆", label: "Pencapaian" },
    "lightbulb-idea": { emoji: "💡", label: "Ide" },
    "book-stack": { emoji: "📚", label: "Bacaan" },
    "coffee-focus": { emoji: "☕", label: "Fokus" },
    "chart-growth": { emoji: "📈", label: "Progress" },
    "heart-support": { emoji: "💬", label: "Dukungan" }
  };

  const MAX_REPLY_DEPTH = 4;

  let communityFeed = [];
  let communityTopicFilter = "all";
  let communityFeedTab = "foryou";
  let communityLoading = false;
  let communityLoaded = false;
  const expandedThreads = new Set();

  function relativeTime(value) {
    const then = new Date(value);
    if (Number.isNaN(then.getTime())) return "";
    const diff = Date.now() - then.getTime();
    if (diff < 0) return "baru";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "baru";
    if (mins < 60) return mins + "m";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "j";
    const days = Math.floor(hours / 24);
    if (days < 7) return days + "h";
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks + "mg";
    return then.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }

  function absoluteTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function countThread(replies) {
    let total = 0;
    (replies || []).forEach((reply) => {
      total += 1 + countThread(reply.replies);
    });
    return total;
  }

  function communityImageHtml(imageKey) {
    const img = COMMUNITY_IMAGES[imageKey];
    if (!img) return "";
    return `<div class="thread-image" role="img" aria-label="${esc(img.label)}"><span aria-hidden="true">${img.emoji}</span></div>`;
  }

  function verifiedBadge(role) {
    if (role !== "edumate") return "";
    return `<span class="thread-verified" title="Edumate terverifikasi" aria-label="Edumate terverifikasi"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.6 14.6 4l3.5-.3.9 3.4 3 1.9-1.4 3.2 1.4 3.2-3 1.9-.9 3.4-3.5-.3L12 22.4 9.4 20l-3.5.3-.9-3.4-3-1.9L3.4 12 2 8.8l3-1.9.9-3.4L9.4 4 12 1.6Zm-1 13.9 5.3-5.3-1.5-1.5-3.8 3.8-1.9-1.9-1.5 1.5 3.4 3.4Z"/></svg></span>`;
  }

  function avatarHtml(node, size) {
    const cls = size === "sm" ? "thread-avatar thread-avatar-sm" : "thread-avatar";
    return `<div class="${cls}" style="background:${esc(node.authorAvatarColor)}" aria-hidden="true">${esc(node.authorInitials)}</div>`;
  }

  function actionBarHtml(node) {
    const replyCount = countThread(node.replies);
    return `
      <div class="thread-actions">
        <button class="thread-action ${node.liked ? "is-on is-like" : ""}" type="button" data-action="like" data-post="${esc(node.id)}" aria-pressed="${node.liked}" aria-label="Suka">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></svg>
          <span data-like-count>${node.likes || ""}</span>
        </button>
        <button class="thread-action" type="button" data-action="reply" data-post="${esc(node.id)}" aria-label="Balas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-2.8-.4L4 21l1.4-4.1A8.1 8.1 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/></svg>
          <span>${replyCount || ""}</span>
        </button>
        <button class="thread-action ${node.reposted ? "is-on is-repost" : ""}" type="button" data-action="repost" data-post="${esc(node.id)}" aria-pressed="${node.reposted}" aria-label="Bagikan ulang">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M21 6H9a4 4 0 0 0-4 4v1"/><path d="M7 22l-4-4 4-4"/><path d="M3 18h12a4 4 0 0 0 4-4v-1"/></svg>
          <span data-repost-count>${node.reposts || ""}</span>
        </button>
        <button class="thread-action" type="button" data-action="share" data-post="${esc(node.id)}" aria-label="Salin tautan">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 16V3"/><path d="M8 7l4-4 4 4"/></svg>
        </button>
        ${node.isMine ? `<button class="thread-action thread-action-delete" type="button" data-action="delete" data-post="${esc(node.id)}" aria-label="Hapus postingan">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        </button>` : ""}
      </div>
    `;
  }

  function replyHtml(node, depth) {
    // Indentation stops at MAX_REPLY_DEPTH: deeper replies are rendered as
    // siblings at the last level so nothing is dropped and nothing runs
    // off the right edge on narrow screens.
    const children = node.replies || [];
    const atCap = depth >= MAX_REPLY_DEPTH;
    const nested = children.length && !atCap
      ? `<div class="thread-replies">${children.map((child) => replyHtml(child, depth + 1)).join("")}</div>`
      : "";
    const overflow = children.length && atCap
      ? children.map((child) => replyHtml(child, depth)).join("")
      : "";
    return `
      <article class="thread-reply" data-post-id="${esc(node.id)}" data-depth="${depth}">
        <div class="thread-rail">
          ${avatarHtml(node, "sm")}
          <span class="thread-line" aria-hidden="true"></span>
        </div>
        <div class="thread-body">
          <div class="thread-identity">
            <strong>${esc(node.authorName)}</strong>
            ${verifiedBadge(node.authorRole)}
            <span class="thread-handle">@${esc(node.authorHandle)}</span>
            <time class="thread-time" datetime="${esc(node.createdAt)}" title="${esc(absoluteTime(node.createdAt))}">${esc(relativeTime(node.createdAt))}</time>
            ${node.isMine ? '<span class="thread-you">Kamu</span>' : ""}
          </div>
          <p class="thread-text">${esc(node.content)}</p>
          ${communityImageHtml(node.imageKey)}
          ${actionBarHtml(node)}
          ${nested}
        </div>
      </article>
      ${overflow}
    `;
  }

  function postHtml(node) {
    const replies = node.replies || [];
    const replyCount = countThread(replies);
    const open = expandedThreads.has(node.id);
    const visible = open ? replies : replies.slice(0, 1);
    const hiddenCount = open ? 0 : Math.max(0, replyCount - countThread(visible));
    const canFollow = !node.isMine;

    return `
      <article class="thread-post ${node.isMine ? "is-mine" : ""}" data-post-id="${esc(node.id)}">
        <div class="thread-rail">
          ${avatarHtml(node)}
          ${replies.length ? '<span class="thread-line" aria-hidden="true"></span>' : ""}
        </div>
        <div class="thread-body">
          <div class="thread-identity">
            <strong>${esc(node.authorName)}</strong>
            ${verifiedBadge(node.authorRole)}
            <span class="thread-handle">@${esc(node.authorHandle)}</span>
            <time class="thread-time" datetime="${esc(node.createdAt)}" title="${esc(absoluteTime(node.createdAt))}">${esc(relativeTime(node.createdAt))}</time>
            ${node.topic ? `<span class="thread-topic">${esc(node.topic)}</span>` : ""}
            ${node.isMine ? '<span class="thread-you">Kamu</span>' : ""}
            ${canFollow ? `<button class="thread-follow ${node.following ? "is-following" : ""}" type="button" data-action="follow" data-author="${esc(node.authorId)}" aria-pressed="${node.following}">${node.following ? "Mengikuti" : "Ikuti"}</button>` : ""}
          </div>
          <p class="thread-text">${esc(node.content)}</p>
          ${communityImageHtml(node.imageKey)}
          ${actionBarHtml(node)}
          ${visible.length ? `<div class="thread-replies">${visible.map((child) => replyHtml(child, 1)).join("")}</div>` : ""}
          ${hiddenCount ? `<button class="thread-more" type="button" data-action="expand" data-post="${esc(node.id)}">Lihat ${hiddenCount} balasan lainnya</button>` : ""}
          ${open && replyCount > 1 ? `<button class="thread-more" type="button" data-action="collapse" data-post="${esc(node.id)}">Sembunyikan balasan</button>` : ""}
        </div>
      </article>
    `;
  }

  function visibleCommunityPosts() {
    return communityFeed.filter((post) => {
      if (communityFeedTab === "following" && !post.following && !post.isMine) return false;
      if (communityFeedTab === "edumate" && post.authorRole !== "edumate") return false;
      if (communityTopicFilter !== "all" && post.topic !== communityTopicFilter) return false;
      return true;
    });
  }

  function renderCommunityFilter() {
    const box = $("#communityFilter");
    if (!box) return;
    const counts = {};
    communityFeed.forEach((post) => {
      if (post.topic) counts[post.topic] = (counts[post.topic] || 0) + 1;
    });
    const chip = (value, label, count) =>
      `<button class="threads-filter-btn ${communityTopicFilter === value ? "is-active" : ""}" type="button" data-topic="${esc(value)}" aria-pressed="${communityTopicFilter === value}">${esc(label)}${count ? `<span>${count}</span>` : ""}</button>`;
    box.innerHTML =
      chip("all", "Semua", communityFeed.length) +
      COMMUNITY_TOPICS.map((topic) => chip(topic, topic, counts[topic] || 0)).join("");
  }

  function renderCommunity() {
    const feed = $("#communityFeed");
    if (!feed) return;

    document.querySelectorAll(".threads-feedtab").forEach((btn) => {
      const active = btn.dataset.feed === communityFeedTab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    renderCommunityFilter();

    if (communityLoading) {
      feed.innerHTML = '<div class="dash-empty"><p>Memuat komunitas...</p></div>';
      return;
    }

    const posts = visibleCommunityPosts();
    if (!posts.length) {
      const message =
        communityFeedTab === "following"
          ? "Belum mengikuti siapa pun. Tekan <strong>Ikuti</strong> di tab Untuk Kamu untuk mengisi feed ini."
          : communityFeedTab === "edumate"
            ? "Belum ada postingan Edumate di topik ini."
            : "Belum ada postingan di topik ini. Jadi yang pertama berbagi!";
      feed.innerHTML = `<div class="dash-empty"><p>${message}</p></div>`;
      return;
    }

    feed.innerHTML = posts.map(postHtml).join("");
  }

  function findCommunityNode(postId, list) {
    const nodes = list || communityFeed;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === postId) return nodes[i];
      const found = findCommunityNode(postId, nodes[i].replies || []);
      if (found) return found;
    }
    return null;
  }

  // Replies can be nested, but only root posts collapse. Walk up to the root
  // so a new nested reply is not hidden behind "Lihat N balasan lainnya".
  function findRootPostId(postId) {
    const walk = (node) => {
      if (node.id === postId) return true;
      return (node.replies || []).some(walk);
    };
    const root = communityFeed.find(walk);
    return root ? root.id : postId;
  }

  async function loadCommunity(options) {
    const quiet = options && options.quiet;
    if (!quiet) {
      communityLoading = true;
      renderCommunity();
    }
    try {
      communityFeed = await Educrazy.community.getFeed();
    } catch (error) {
      console.warn("Community feed unavailable:", error);
      communityFeed = [];
      toast("Gagal memuat komunitas.", "error");
    } finally {
      communityLoading = false;
      communityLoaded = true;
      renderCommunity();
    }
  }

  function updateComposeState() {
    const textEl = $("#communityComposeText");
    const countEl = $("#communityComposeCount");
    const submitEl = $("#communityComposeSubmit");
    if (!textEl) return;
    const length = textEl.value.trim().length;
    if (countEl) {
      countEl.textContent = `${textEl.value.length}/500`;
      countEl.classList.toggle("is-near", textEl.value.length > 440);
    }
    if (submitEl) submitEl.disabled = length === 0;
  }

  function setupCommunityHandlers() {
    const feed = $("#communityFeed");
    const filterBox = $("#communityFilter");
    const composeForm = $("#communityCompose");
    const composeGallery = $("#communityComposeGallery");
    const topicSelect = $("#communityComposeTopic");
    const textEl = $("#communityComposeText");
    if (!feed) return;

    if (topicSelect) {
      topicSelect.innerHTML = COMMUNITY_TOPICS.map(
        (topic) => `<option value="${esc(topic)}">${esc(topic)}</option>`
      ).join("");
    }

    const avatarEl = $("#composeAvatar");
    const handleEl = $("#composeHandle");
    const myName = (user && (user.name || user.email)) || "Kamu";
    if (avatarEl) {
      avatarEl.textContent =
        myName
          .trim()
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "EC";
    }
    if (handleEl) {
      handleEl.textContent =
        "@" + (myName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18) || "kamu");
    }

    if (composeGallery) {
      composeGallery.innerHTML =
        `<button type="button" class="threads-image-pick is-active" data-image-key="" aria-pressed="true" title="Tanpa gambar">Tanpa gambar</button>` +
        Object.entries(COMMUNITY_IMAGES)
          .map(
            ([key, img]) =>
              `<button type="button" class="threads-image-pick" data-image-key="${esc(key)}" aria-pressed="false" title="${esc(img.label)}" aria-label="${esc(img.label)}"><span aria-hidden="true">${img.emoji}</span></button>`
          )
          .join("");

      composeGallery.addEventListener("click", (event) => {
        const btn = event.target.closest(".threads-image-pick");
        if (!btn) return;
        composeGallery.querySelectorAll(".threads-image-pick").forEach((other) => {
          const on = other === btn;
          other.classList.toggle("is-active", on);
          other.setAttribute("aria-pressed", String(on));
        });
      });
    }

    if (textEl) {
      textEl.addEventListener("input", () => {
        updateComposeState();
        textEl.style.height = "auto";
        textEl.style.height = Math.min(textEl.scrollHeight, 220) + "px";
      });
      updateComposeState();
    }

    const newBtn = $("#communityNewBtn");
    if (newBtn) {
      newBtn.addEventListener("click", () => {
        openModal("#communityComposeModal");
        if (textEl) {
          textEl.focus();
          textEl.style.height = "auto";
        }
      });
    }

    const composeClose = $("#communityComposeClose");
    if (composeClose) {
      composeClose.addEventListener("click", () => closeModal("#communityComposeModal"));
    }

    document.querySelectorAll(".threads-feedtab").forEach((btn) => {
      btn.addEventListener("click", () => {
        communityFeedTab = btn.dataset.feed;
        renderCommunity();
      });
    });

    if (filterBox) {
      filterBox.addEventListener("click", (event) => {
        const btn = event.target.closest(".threads-filter-btn");
        if (!btn) return;
        communityTopicFilter = btn.dataset.topic;
        renderCommunity();
      });
    }

    if (composeForm) {
      composeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const text = textEl.value.trim();
        if (!text) return;

        const picked = composeGallery
          ? composeGallery.querySelector(".threads-image-pick.is-active")
          : null;

        const submitEl = $("#communityComposeSubmit");
        if (submitEl) submitEl.disabled = true;

        const { error } = await Educrazy.community.createPost({
          content: text,
          topic: topicSelect ? topicSelect.value : "Umum",
          imageKey: picked ? picked.dataset.imageKey : ""
        });

        if (error) {
          toast(error.message || "Gagal memposting.", "error");
          updateComposeState();
          return;
        }

        composeForm.reset();
        textEl.style.height = "auto";
        if (composeGallery) {
          composeGallery.querySelectorAll(".threads-image-pick").forEach((btn, i) => {
            btn.classList.toggle("is-active", i === 0);
            btn.setAttribute("aria-pressed", String(i === 0));
          });
        }
        updateComposeState();
        communityTopicFilter = "all";
        communityFeedTab = "foryou";
        closeModal("#communityComposeModal");
        await loadCommunity({ quiet: true });
        toast("Postingan terkirim ke komunitas.");
      });
    }

    feed.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const postId = button.dataset.post;
      const node = postId ? findCommunityNode(postId) : null;

      if (action === "expand") {
        expandedThreads.add(postId);
        renderCommunity();
        return;
      }

      if (action === "collapse") {
        expandedThreads.delete(postId);
        renderCommunity();
        return;
      }

      if (action === "like" && node) {
        const next = !node.liked;
        node.liked = next;
        node.likes = Math.max(0, (node.likes || 0) + (next ? 1 : -1));
        button.classList.toggle("is-on", next);
        button.classList.toggle("is-like", next);
        button.setAttribute("aria-pressed", String(next));
        button.querySelector("[data-like-count]").textContent = node.likes || "";
        const { error } = await Educrazy.community.toggleLike(postId, next);
        if (error) {
          toast(error.message || "Gagal menyimpan suka.", "error");
          await loadCommunity({ quiet: true });
        }
        return;
      }

      if (action === "repost" && node) {
        const next = !node.reposted;
        node.reposted = next;
        node.reposts = Math.max(0, (node.reposts || 0) + (next ? 1 : -1));
        button.classList.toggle("is-on", next);
        button.classList.toggle("is-repost", next);
        button.setAttribute("aria-pressed", String(next));
        button.querySelector("[data-repost-count]").textContent = node.reposts || "";
        const { error } = await Educrazy.community.toggleRepost(postId, next);
        if (error) {
          toast(error.message || "Gagal membagikan ulang.", "error");
          await loadCommunity({ quiet: true });
          return;
        }
        toast(next ? "Dibagikan ulang." : "Bagikan ulang dibatalkan.", "info");
        return;
      }

      if (action === "follow") {
        const authorId = button.dataset.author;
        const next = !button.classList.contains("is-following");
        const { error, on } = await Educrazy.community.toggleFollow(authorId, next);
        if (error) {
          toast(error.message || "Gagal memperbarui status mengikuti.", "error");
          return;
        }
        communityFeed.forEach((post) => {
          if (post.authorId === authorId) post.following = on;
        });
        renderCommunity();
        toast(on ? "Mulai mengikuti." : "Berhenti mengikuti.", "info");
        return;
      }

      if (action === "share") {
        const link = `${window.location.origin}${window.location.pathname}#post-${postId}`;
        try {
          await navigator.clipboard.writeText(link);
          toast("Tautan postingan disalin.");
        } catch (error) {
          toast("Tidak bisa menyalin tautan di browser ini.", "error");
        }
        return;
      }

      if (action === "delete") {
        if (!window.confirm("Hapus postingan ini?")) return;
        const { error } = await Educrazy.community.deletePost(postId);
        if (error) {
          toast(error.message || "Gagal menghapus.", "error");
          return;
        }
        await loadCommunity({ quiet: true });
        toast("Postingan dihapus.");
        return;
      }

      if (action === "reply" && node) {
        const body = button.closest(".thread-body");
        const existing = body.querySelector(":scope > .thread-reply-form");
        if (existing) {
          existing.remove();
          return;
        }
        feed.querySelectorAll(".thread-reply-form").forEach((form) => form.remove());

        const form = document.createElement("form");
        form.className = "thread-reply-form";
        form.dataset.post = postId;
        form.innerHTML = `
          <input type="text" placeholder="Balas @${esc(node.authorHandle)}..." maxlength="500" required aria-label="Balas ${esc(node.authorName)}">
          <button type="submit" class="btn btn-primary btn-sm">Balas</button>
        `;
        button.closest(".thread-actions").insertAdjacentElement("afterend", form);
        form.querySelector("input").focus();
      }
    });

    feed.addEventListener("submit", async (event) => {
      const form = event.target.closest(".thread-reply-form");
      if (!form) return;
      event.preventDefault();
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (!text) return;

      const postId = form.dataset.post;
      const rootId = findRootPostId(postId);
      input.disabled = true;
      const { error } = await Educrazy.community.createPost({
        content: text,
        parentId: postId
      });
      if (error) {
        input.disabled = false;
        toast(error.message || "Gagal mengirim balasan.", "error");
        return;
      }

      expandedThreads.add(rootId);
      await loadCommunity({ quiet: true });
      toast("Balasan terkirim.");
    });
  }

  // ==================== Contests Panel ====================
  function contestStatus(c) {
    const now = new Date();
    const regOpen = parseLocalDate(c.registrationOpen);
    const regClose = parseLocalDate(c.registrationClose);
    regClose.setHours(23, 59, 59, 999);

    if (c.status === "closed" || now > regClose) {
      return { cls: "closed", text: "Ditutup", canRegister: false };
    }
    if (now < regOpen) {
      return { cls: "upcoming", text: "Akan Datang", canRegister: false };
    }
    return { cls: "open", text: "Buka Pendaftaran", canRegister: true };
  }

  function renderContests() {
    const grid = $("#contestsGrid");
    const contests = learnHubData.contests || [];

    if (!contests.length) {
      grid.innerHTML = '<div class="dash-empty"><p>Belum ada info lomba.</p></div>';
      return;
    }

    grid.innerHTML = contests
      .map((c) => {
        const status = contestStatus(c);
        const regOpen = parseLocalDate(c.registrationOpen);
        const regClose = parseLocalDate(c.registrationClose);
        const eventDate = parseLocalDate(c.eventDate);
        return `
        <article class="contest-card" data-contest-card="${esc(c.id)}">
          <div class="contest-header">
            <span class="contest-subject">${esc(c.subject)}</span>
            <span class="contest-status ${status.cls}">${esc(status.text)}</span>
          </div>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.description)}</p>
          <div class="contest-meta">
            <span>Kelas: ${esc(c.grades.join(", "))}</span>
            <span>Hadiah: ${esc(c.prize)}</span>
          </div>
          <div class="contest-dates">
            <div><strong>Daftar:</strong> ${esc(regOpen.toLocaleDateString("id-ID"))} &ndash; ${esc(regClose.toLocaleDateString("id-ID"))}</div>
            <div><strong>Acara:</strong> ${esc(eventDate.toLocaleDateString("id-ID"))}</div>
          </div>
          <div class="contest-actions">
            <button class="btn btn-primary btn-sm" type="button" ${status.canRegister ? "" : "disabled"} data-contest-register="${esc(c.id)}">${status.canRegister ? "Daftar (Demo)" : esc(status.text)}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-contest-detail="${esc(c.id)}">Detail</button>
          </div>
        </article>
      `;
      })
      .join("");
  }

  function setupContestHandlers() {
    const grid = $("#contestsGrid");
    if (!grid) return;
    grid.addEventListener("click", (event) => {
      const register = event.target.closest("[data-contest-register]");
      if (register && !register.disabled) {
        toast("Demo: pendaftaran hanya simulasi.", "info");
        return;
      }
      const detail = event.target.closest("[data-contest-detail]");
      if (detail) showContestDetail(detail.dataset.contestDetail);
    });
  }

  function showContestDetail(contestId) {
    const c = (learnHubData.contests || []).find((item) => item.id === contestId);
    if (!c) return;
    const status = contestStatus(c);
    const body = $("#scheduleModalBody");
    body.innerHTML = `
      <div class="schedule-booking">
        <span class="contest-status ${status.cls}">${esc(status.text)}</span>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description)}</p>
        <div class="booking-summary">
          <p><strong>Penyelenggara:</strong> ${esc(c.organizer)}</p>
          <p><strong>Mapel:</strong> ${esc(c.subject)}</p>
          <p><strong>Kelas:</strong> ${esc(c.grades.join(", "))}</p>
          <p><strong>Pendaftaran:</strong> ${esc(parseLocalDate(c.registrationOpen).toLocaleDateString("id-ID"))} &ndash; ${esc(parseLocalDate(c.registrationClose).toLocaleDateString("id-ID"))}</p>
          <p><strong>Tanggal acara:</strong> ${esc(parseLocalDate(c.eventDate).toLocaleDateString("id-ID"))}</p>
          <p><strong>Hadiah:</strong> ${esc(c.prize)}</p>
        </div>
        <p class="demo-note">Demo: informasi lomba hanya contoh, bukan data resmi.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" type="button" id="bookingCancel">Tutup</button>
        </div>
      </div>
    `;
    openModal("#scheduleModal");
    $("#bookingCancel").onclick = () => closeModal("#scheduleModal");
  }

  // ==================== Edumate Panel ====================
  function renderEdumate() {
    const grid = $("#edumateGrid");
    const mentors = (learnHubData.mentors || []).filter(
      (m) => currentEdumateFilter === "all" || m.type === currentEdumateFilter
    );

    if (!mentors.length) {
      grid.innerHTML = '<div class="dash-empty"><p>Tidak ada tentor untuk filter ini.</p></div>';
      return;
    }

    grid.innerHTML = mentors
      .map(
        (mentor) => `
      <article class="edumate-card" data-mentor="${esc(mentor.id)}" data-type="${esc(mentor.type)}">
        <div class="edumate-card-top">
          <div class="edumate-avatar" style="background:${esc(mentor.avatarColor)}" aria-hidden="true">${esc(mentor.initials)}</div>
          <div class="edumate-rating">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <strong>${esc(mentor.rating)}</strong>
            <span>(${esc(mentor.reviewCount)})</span>
          </div>
        </div>
        <div class="edumate-info">
          <h3>${esc(mentor.name)}</h3>
          <p class="edumate-bio">${esc(mentor.bio)}</p>
          <div class="edumate-subjects">
            ${mentor.subjects.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}
          </div>
          ${
            mentor.type === "online"
              ? `<p class="edumate-line">Kelas via Zoom/Meet</p>`
              : mentor.type === "offline"
              ? `<p class="edumate-line">Lokasi: ${esc(mentor.address)}</p>`
              : `<p class="edumate-line">Tentor datang ke alamat Anda</p>`
          }
          <div class="edumate-footer">
            <span class="edumate-price">Rp ${Number(mentor.pricePerHour).toLocaleString("id-ID")}/jam</span>
            <span class="edumate-type ${mentor.type === "offline_privat" ? "offline-privat" : esc(mentor.type)}">${esc(TYPE_TEXT[mentor.type] || mentor.type)}</span>
          </div>
        </div>
        <button class="btn btn-primary edumate-select" type="button" data-mentor-select="${esc(mentor.id)}">Pilih tentor</button>
      </article>
    `
      )
      .join("");
  }

  function setupEdumateHandlers() {
    document.querySelectorAll(".edumate-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentEdumateFilter = btn.dataset.type;
        document.querySelectorAll(".edumate-filter-btn").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-pressed", String(b === btn));
        });
        renderEdumate();
      });
    });

    const grid = $("#edumateGrid");
    if (!grid) return;
    grid.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-mentor-select]");
      if (btn) showEdumateDetail(btn.dataset.mentorSelect);
    });
  }

  function showEdumateDetail(mentorId) {
    const mentor = learnHubData.mentors.find((m) => m.id === mentorId);
    if (!mentor) return;

    const body = $("#edumateModalBody");
    const schedule = mentor.schedule || [];

    let html = `
      <div class="edumate-detail">
        <div class="edumate-detail-header">
          <div class="edumate-avatar large" style="background:${esc(mentor.avatarColor)}" aria-hidden="true">${esc(mentor.initials)}</div>
          <div>
            <h2 id="edumateModalTitle">${esc(mentor.name)}</h2>
            <div class="edumate-rating">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <strong>${esc(mentor.rating)}</strong>
              <span>(${esc(mentor.reviewCount)} ulasan)</span>
            </div>
            <span class="edumate-type ${mentor.type === "offline_privat" ? "offline-privat" : esc(mentor.type)}">${esc(TYPE_TEXT[mentor.type] || mentor.type)}</span>
          </div>
        </div>
        <p class="edumate-bio">${esc(mentor.bio)}</p>
        <div class="edumate-subjects">
          ${mentor.subjects.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}
          ${mentor.grades.map((g) => `<span class="chip chip-grade">Grade ${esc(g)}</span>`).join("")}
        </div>
        <div class="edumate-price-large">Rp ${Number(mentor.pricePerHour).toLocaleString("id-ID")} / jam</div>
    `;

    if (mentor.type === "online") {
      html += `
        <div class="edumate-online-info">
          <h4>Link Kelas Online</h4>
          <a class="btn btn-outline" href="${esc(mentor.zoomLink)}" target="_blank" rel="noopener">Buka Zoom/Meet</a>
          <small class="demo-note">Link demo, tidak benar-benar mengarah ke kelas.</small>
        </div>
      `;
    } else if (mentor.type === "offline") {
      html += `
        <div class="edumate-offline-info">
          <h4>Alamat Tempat Belajar</h4>
          <p>${esc(mentor.address)}</p>
        </div>
      `;
    } else {
      const saved = formatUserAddress();
      html += `
        <div class="edumate-privat-info">
          <h4>Tentor Datang ke Rumah Anda</h4>
          <p>Alamat tentor disembunyikan untuk privasi. Setelah memilih jadwal, Anda akan diminta mengisi alamat Anda.</p>
          ${saved ? `<p><strong>Alamat tersimpan:</strong> ${esc(saved)}</p>` : ""}
        </div>
      `;
    }

    html += `
        <h4 class="edumate-schedule-title">Jadwal Tersedia</h4>
        <div class="edumate-schedule">
          ${
            schedule.length
              ? schedule
                  .map(
                    (slot) => `
            <button class="schedule-slot" type="button" data-mentor="${esc(mentor.id)}" data-day="${esc(slot.day)}" data-time="${esc(slot.time)}" data-grade="${esc(slot.grade)}" data-subject="${esc(slot.subject)}">
              <span class="slot-day">${esc(slot.day)}</span>
              <span class="slot-body">
                <span class="slot-time">${esc(slot.time)}</span>
                <span class="slot-detail">Grade ${esc(slot.grade)} &middot; ${esc(slot.subject)}</span>
              </span>
            </button>
          `
                  )
                  .join("")
              : '<div class="dash-empty"><p>Belum ada slot jadwal.</p></div>'
          }
        </div>
      </div>
    `;

    body.innerHTML = html;
    openModal("#edumateModal");

    // Handlers
    body.querySelectorAll(".schedule-slot").forEach((slot) => {
      slot.addEventListener("click", () => {
        const picked = learnHubData.mentors.find((m) => m.id === slot.dataset.mentor);
        if (!picked) return;
        if (picked.type === "offline_privat") {
          closeModal("#edumateModal");
          showAddressForm(picked, { ...slot.dataset });
        } else {
          closeModal("#edumateModal");
          showScheduleBooking(picked, { ...slot.dataset });
        }
      });
    });
  }

  function showAddressForm(mentor, slotData) {
    $("#addressMentorId").value = mentor.id;
    const sessionId = "slot-" + Date.now();
    $("#addressSessionId").value = sessionId;
    sessionStorage.setItem("edumate_slot_" + sessionId, JSON.stringify(slotData));

    const savedAddress = loadUserAddress();
    if (savedAddress) {
      $("#addressStreet").value = savedAddress.street || "";
      $("#addressCity").value = savedAddress.city || "";
      $("#addressNotes").value = savedAddress.notes || "";
    }
    openModal("#addressModal");
  }

  function showScheduleBooking(mentor, slotData) {
    const body = $("#scheduleModalBody");
    const userAddress = mentor.type === "offline_privat" ? formatUserAddress() : "";
    body.innerHTML = `
      <div class="schedule-booking">
        <h3>Konfirmasi Jadwal</h3>
        <div class="booking-summary">
          <p><strong>${esc(mentor.name)}</strong></p>
          <p>${esc(slotData.day)}, ${esc(slotData.time)} &middot; Grade ${esc(slotData.grade)} &middot; ${esc(slotData.subject)}</p>
          ${
            mentor.type === "online"
              ? `<p>Link: <a href="${esc(mentor.zoomLink)}" target="_blank" rel="noopener">Zoom/Meet</a></p>`
              : mentor.type === "offline"
              ? `<p>Lokasi: ${esc(mentor.address)}</p>`
              : `<p>Alamat Anda: ${esc(userAddress)}</p>`
          }
        </div>
        <p class="demo-note">Demo: Jadwal hanya tersimpan di browser, tidak benar-benar dipesan ke tentor.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" id="bookingCancel">Batal</button>
          <button class="btn btn-primary" type="button" id="bookingConfirm">Simpan Jadwal</button>
        </div>
      </div>
    `;
    openModal("#scheduleModal");

    $("#bookingCancel").onclick = () => closeModal("#scheduleModal");
    $("#bookingConfirm").onclick = () => {
      if (mentor.type === "offline_privat" && !userAddress) {
        toast("Alamat belum terisi. Isi alamat dulu ya.", "error");
        return;
      }
      const session = saveDemoSession(mentor, slotData);
      closeModal("#scheduleModal");
      toast("Jadwal tersimpan di kalender (demo)");
      calendarInitialised = true;
      currentCalendarDate = parseLocalDate(session.date);
      switchTab("calendar");
      renderCalendar();
      renderAgenda();
    };
  }

  function saveDemoSession(mentor, slotData) {
    const today = new Date();
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const targetDay = dayNames.indexOf(slotData.day);
    const sessionDate = new Date(today);
    if (targetDay >= 0) {
      sessionDate.setDate(today.getDate() + ((targetDay - today.getDay() + 7) % 7 || 7));
    } else {
      sessionDate.setDate(today.getDate() + 7);
    }

    const [start, end] = String(slotData.time || "").split("-");
    let duration = 90;
    if (start && end) {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const diff = eh * 60 + em - (sh * 60 + sm);
      if (diff > 0) duration = diff;
    }

    const session = {
      id: "demo-" + Date.now(),
      mentorId: mentor.id,
      title: `${slotData.subject}: Grade ${slotData.grade}`,
      subject: slotData.subject,
      grade: slotData.grade,
      date: toLocalISO(sessionDate),
      time: (start || "08:00").trim(),
      duration,
      type: mentor.type,
      status: "scheduled",
      isDemo: true
    };

    if (mentor.type === "online") session.zoomLink = mentor.zoomLink;
    if (mentor.type === "offline") session.address = mentor.address;
    if (mentor.type === "offline_privat") session.userAddress = formatUserAddress();

    const demoSessions = readDemoSessions();
    demoSessions.push(session);
    localStorage.setItem(DEMO_SESSIONS_KEY, JSON.stringify(demoSessions));

    learnHubData.sessions.push(session);
    return session;
  }

  // ==================== Preferences Popup ====================
  function showPrefsPopup() {
    if (prefsSeen() || hasPrefs()) return;
    renderPrefsChips();
    openModal("#prefsModal");
  }

  function openPrefsEditor() {
    renderPrefsChips();
    openModal("#prefsModal");
  }

  function renderPrefsChips() {
    const atSubjectLimit = selectedSubjects.length >= 3;

    const subjectContainer = $("#subjectChips");
    subjectContainer.innerHTML = SUBJECTS.map((s) => {
      const selected = selectedSubjects.includes(s.label);
      const locked = !selected && atSubjectLimit;
      return `
      <button class="chip ${selected ? "selected" : ""} ${locked ? "locked" : ""}" data-type="subject" data-value="${esc(s.label)}" type="button" ${locked ? 'aria-disabled="true"' : ""}>
        ${s.icon} ${esc(s.label)}
      </button>`;
    }).join("");

    const methodContainer = $("#methodChips");
    methodContainer.innerHTML = METHODS.map((m) => `
      <button class="chip ${selectedMethods.includes(m.id) ? "selected" : ""}" data-type="method" data-value="${esc(m.id)}" type="button">
        ${esc(m.label)}
      </button>
    `).join("");

    const goalContainer = $("#goalChips");
    goalContainer.innerHTML = GOALS.map((g) => `
      <button class="chip ${selectedGoals.includes(g.id) ? "selected" : ""}" data-type="goal" data-value="${esc(g.id)}" type="button">
        ${esc(g.label)}
      </button>
    `).join("");

    updateSubjectCount();
    updatePrefsSaveButton();

    document.querySelectorAll("#subjectChips .chip, #methodChips .chip, #goalChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => togglePrefChip(chip));
    });
  }

  function togglePrefChip(chip) {
    const type = chip.dataset.type;
    const value = chip.dataset.value;

    if (type === "subject") {
      if (selectedSubjects.includes(value)) {
        selectedSubjects = selectedSubjects.filter((s) => s !== value);
      } else if (selectedSubjects.length < 3) {
        selectedSubjects.push(value);
      } else {
        toast("Maksimal 3 mapel", "info");
        return;
      }
      renderPrefsChips();
      return;
    }

    if (type === "method") {
      selectedMethods = selectedMethods.includes(value)
        ? selectedMethods.filter((m) => m !== value)
        : selectedMethods.concat(value);
    } else if (type === "goal") {
      selectedGoals = selectedGoals.includes(value)
        ? selectedGoals.filter((g) => g !== value)
        : selectedGoals.concat(value);
    }

    chip.classList.toggle("selected");
    updatePrefsSaveButton();
  }

  function updateSubjectCount() {
    const el = $("#subjectCount");
    if (el) el.textContent = `${selectedSubjects.length}/3`;
  }

  function updatePrefsSaveButton() {
    const saveBtn = $("#prefsSave");
    if (saveBtn) saveBtn.disabled = !hasPrefs();
  }

  function savePrefsAndClose() {
    savePrefs();
    markPrefsSeen();
    closeModal("#prefsModal");
    toast("Preferensi tersimpan! Rekomendasi akan disesuaikan.");
    renderRecommended();
  }

  function skipPrefs() {
    markPrefsSeen();
    closeModal("#prefsModal");
  }

  // ==================== Address Form Handler ====================
  function setupAddressForm() {
    const form = $("#addressForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const mentorId = $("#addressMentorId").value;
      const sessionId = $("#addressSessionId").value;
      const street = $("#addressStreet").value.trim();
      const city = $("#addressCity").value.trim();
      const notes = $("#addressNotes").value.trim();

      if (!street || !city) {
        toast("Isi jalan dan kota terlebih dahulu", "error");
        return;
      }

      localStorage.setItem(USER_ADDRESS_KEY, JSON.stringify({ street, city, notes }));

      let slotData = {};
      try {
        slotData = JSON.parse(sessionStorage.getItem("edumate_slot_" + sessionId) || "{}");
      } catch (err) {
        slotData = {};
      }
      const mentor = learnHubData.mentors.find((m) => m.id === mentorId);

      closeModal("#addressModal");

      if (mentor && slotData.day) {
        showScheduleBooking(mentor, slotData);
      } else {
        toast("Jadwal tidak ditemukan. Pilih ulang slot ya.", "error");
      }
    });

    $("#addressCancel").addEventListener("click", () => {
      closeModal("#addressModal");
    });
    $("#addressModalClose").addEventListener("click", () => {
      closeModal("#addressModal");
    });
  }

  // ==================== Modal Close Handlers ====================
  function setupModalCloses() {
    $("#prefsClose").addEventListener("click", () => {
      markPrefsSeen();
      closeModal("#prefsModal");
    });
    $("#prefsSkip").addEventListener("click", skipPrefs);
    $("#prefsSave").addEventListener("click", savePrefsAndClose);

    $("#edumateModalClose").addEventListener("click", () => closeModal("#edumateModal"));
    $("#scheduleModalClose").addEventListener("click", () => closeModal("#scheduleModal"));

    // Close on backdrop click
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal(backdrop);
      });
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop.is-open").forEach((b) => closeModal(b));
      }
    });
  }

  // ==================== Init ====================
  document.addEventListener("DOMContentLoaded", async () => {
    user = await Educrazy.getUser();
    if (!user) {
      window.location.replace("login.html?next=dashboard.html");
      return;
    }

    const nameEl = $("[data-user-name]");
    if (nameEl) nameEl.textContent = user.name || user.email;

    const dashAvatar = $("#dashAvatar");
    if (dashAvatar) {
      dashAvatar.textContent =
        String(user.name || user.email || "")
          .trim()
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "EC";
    }

    renderPlan();

    document.querySelectorAll("#logoutBtn, [data-logout]").forEach((button) => {
      button.addEventListener("click", async () => {
        await Educrazy.signOut();
        window.location.href = "index.html";
      });
    });

    try {
      allResources = await fetchResources();
    } catch (error) {
      allResources = [];
      toast("Gagal memuat materi.", "error");
    }

    learnHubData = await fetchLearnHubData();
    learnHubData.mentors = learnHubData.mentors || [];
    learnHubData.sessions = (learnHubData.sessions || []).concat(readDemoSessions());
    learnHubData.posts = learnHubData.posts || [];
    learnHubData.contests = learnHubData.contests || [];
    Educrazy.community.setSeed(learnHubData.posts);

    savedIds = (await Educrazy.getSavedIds()).map(Number);
    doneIds = (await Educrazy.getDoneIds()).map(Number);
    savedResources = allResources.filter((resource) => savedIds.includes(Number(resource.id)));

    loadPrefs();

    renderSaved();
    renderRecommended();
    renderCounts();

    document.querySelectorAll(".hub-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    $("#savedList").addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove]");
      if (remove) {
        event.stopPropagation();
        removeSaved(remove.dataset.remove);
        return;
      }
      openResource(event);
    });

    $("#recommendedList").addEventListener("click", openResource);

    $("#editPrefsBtn").addEventListener("click", openPrefsEditor);

    setupModalCloses();
    setupAddressForm();
    setupEdumateHandlers();
    setupCommunityHandlers();
    setupContestHandlers();

    setTimeout(showPrefsPopup, 500);

    document.addEventListener("educrazy:user", (event) => {
      if (!event.detail) window.location.href = "index.html";
    });
  });

  function openResource(event) {
    const item = event.target.closest("[data-open]");
    if (!item) return;
    const resource = allResources.find((r) => Number(r.id) === Number(item.dataset.open));
    const query = resource ? encodeURIComponent(resource.title) : "";
    window.location.href = "resources.html?q=" + query;
  }
})();