(function () {
  const $ = UI.$;
  const toast = UI.toast;

  function showError(message) {
    const box = $("#formError");
    if (!box) return;
    box.textContent = message;
    box.classList.add("is-visible");
  }

  function clearError() {
    const box = $("#formError");
    if (box) box.classList.remove("is-visible");
  }

  function setLoading(button, loading, label) {
    if (!button) return;
    button.disabled = loading;
    button.dataset.label = button.dataset.label || button.textContent;
    button.textContent = loading ? "Please wait..." : label || button.dataset.label;
    button.style.opacity = loading ? "0.75" : "";
  }

  function nextUrl() {
    const fallback = "dashboard.html";
    const next = new URLSearchParams(window.location.search).get("next");
    if (!next) return fallback;
    if (
      !/^(index|resources|pricing|dashboard|game)\.html(?:\?[A-Za-z0-9_=&%.-]+)?$/.test(
        next
      )
    ) {
      return fallback;
    }
    return next;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function friendlyError(message) {
    if (!message) return "Something went wrong. Please try again.";
    if (/invalid login credentials/i.test(message)) return "That email or password is incorrect.";
    if (/email not confirmed/i.test(message)) return "Please confirm your email address before logging in.";
    if (/already registered|already exists/i.test(message)) return "An account with that email already exists. Try logging in.";
    if (/password/i.test(message) && /6/.test(message)) return "Password must be at least 6 characters.";
    return message;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (Educrazy.isDemo) {
      const notice = $("#demoNotice");
      if (notice) notice.classList.remove("hidden");
    }

    const existing = await Educrazy.getUser();
    if (existing) {
      window.location.href = nextUrl();
      return;
    }

    const loginForm = $("#loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearError();
        const email = $("#email").value.trim();
        const password = $("#password").value;
        if (!validEmail(email)) return showError("Enter a valid email address.");
        if (!password) return showError("Enter your password.");

        const button = $("#submitBtn");
        setLoading(button, true);
        const { error } = await Educrazy.signIn({ email, password });
        setLoading(button, false, "Log In");

        if (error) return showError(friendlyError(error.message));
        toast("Welcome back!");
        window.location.href = nextUrl();
      });
    }

    const signupForm = $("#signupForm");
    if (signupForm) {
      signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearError();
        const name = $("#name").value.trim();
        const email = $("#email").value.trim();
        const password = $("#password").value;
        const role = signupForm.querySelector('input[name="role"]:checked').value;
        const grade = $("#grade").value;

        if (name.length < 2) return showError("Enter your full name.");
        if (!validEmail(email)) return showError("Enter a valid email address.");
        if (password.length < 6) return showError("Password must be at least 6 characters.");

        const button = $("#submitBtn");
        setLoading(button, true);
        const { error } = await Educrazy.signUp({ name, email, password, role, grade });
        setLoading(button, false, "Create free account");

        if (error) return showError(friendlyError(error.message));

        const user = await Educrazy.getUser();
        if (!user) {
          toast("Check your email to confirm your account.");
          showError("Account created. Confirm your email, then log in.");
          return;
        }
        toast("Your free account is ready.");
        window.location.href = nextUrl();
      });
    }
  });
})();
