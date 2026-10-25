(function () {
  const $ = UI.$;
  const toast = UI.toast;
  const cfg = window.EDUCRAZY_CONFIG || {};
  const monthly = Number(cfg.PREMIUM_MONTHLY || 15.99);
  const yearly = Number(cfg.PREMIUM_YEARLY || 119.99);

  let billing = "monthly";
  let currentUser = null;

  function renderBilling() {
    const isYearly = billing === "yearly";
    const perMonth = isYearly ? yearly / 12 : monthly;
    $("#premiumPrice").textContent = "$" + perMonth.toFixed(2);
    $("#premiumUnit").textContent = "/ month";
    $("#premiumNote").textContent = isYearly
      ? "$" + yearly.toFixed(2) + " billed once a year. Cancel anytime."
      : "Billed monthly. Cancel anytime.";
    $("#billingMonthly").classList.toggle("is-active", !isYearly);
    $("#billingYearly").classList.toggle("is-active", isYearly);
  }

  function openCheckout() {
    const modal = $("#checkoutModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#checkoutClose").focus();
  }

  function closeCheckout() {
    const modal = $("#checkoutModal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function startPremium() {
    if (!currentUser) {
      window.location.href = "signup.html?next=pricing.html";
      return;
    }
    if (currentUser.plan === "premium") {
      window.location.href = "dashboard.html";
      return;
    }
    openCheckout();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderBilling();

    $("#billingMonthly").addEventListener("click", () => {
      billing = "monthly";
      renderBilling();
    });
    $("#billingYearly").addEventListener("click", () => {
      billing = "yearly";
      renderBilling();
    });

    $("#premiumCta").addEventListener("click", startPremium);

    $("#checkoutClose").addEventListener("click", closeCheckout);
    $("#checkoutCancel").addEventListener("click", closeCheckout);
    $("#checkoutModal").addEventListener("click", (event) => {
      if (event.target === $("#checkoutModal")) closeCheckout();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCheckout();
    });

    currentUser = await Educrazy.getUser();
    if (currentUser && currentUser.plan === "premium") {
      $("#premiumCta").textContent = "Manage membership";
      $("#premiumCta").classList.remove("btn-primary");
      $("#premiumCta").classList.add("btn-soft");
    }

    document.addEventListener("educrazy:user", (event) => {
      currentUser = event.detail;
    });

    $("#activateDemo").addEventListener("click", async () => {
      if (!currentUser) {
        window.location.href = "signup.html?next=pricing.html";
        return;
      }
      const { error } = await Educrazy.setPlan("premium");
      if (error) {
        toast("Could not activate premium. Check your Supabase setup.", "error");
        return;
      }
      closeCheckout();
      toast("Premium activated for this account.");
      setTimeout(() => (window.location.href = "dashboard.html"), 900);
    });
  });
})();
