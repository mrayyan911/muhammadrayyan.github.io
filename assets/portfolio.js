// The content, project disclosures, and navigation also work without JavaScript.
const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

const copyButton = document.querySelector(".copy-email");
const copyStatus = document.querySelector("#copy-status");
if (copyButton && copyStatus && navigator.clipboard && window.isSecureContext) {
  copyButton.hidden = false;
  let resetTimer;
  copyButton.addEventListener("click", async () => {
    clearTimeout(resetTimer);
    try {
      await navigator.clipboard.writeText("rayyan.scale@gmail.com");
      copyStatus.textContent = "Email address copied.";
    } catch {
      copyStatus.textContent =
        "Could not copy. Select the email address or use the email link.";
    }
    resetTimer = setTimeout(() => {
      copyStatus.textContent = "";
    }, 6000);
  });
}

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Caching is optional; the portfolio still works without it.
    });
  });
}
