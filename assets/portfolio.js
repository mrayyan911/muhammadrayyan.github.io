// The content, project disclosures, and navigation also work without JavaScript.
const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

const EMAIL = "rayyan.scale@gmail.com";
const copyButton = document.querySelector(".copy-email");
const copyStatus = document.querySelector("#copy-status");

// Mobile browsers can lack the async Clipboard API (plain http, in-app browsers) or reject it,
// so fall back to selecting a hidden field and running the legacy copy command.
function legacyCopy(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
  document.body.appendChild(field);
  field.focus({ preventScroll: true });
  field.select();
  field.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { /* fall through */ }
  field.remove();
  return ok;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* try the legacy path */ }
  }
  return legacyCopy(text);
}

if (copyButton && copyStatus) {
  copyButton.hidden = false;
  let resetTimer;
  copyButton.addEventListener("click", async () => {
    clearTimeout(resetTimer);
    copyStatus.textContent = (await copyText(EMAIL))
      ? "Email address copied."
      : "Could not copy. Select the email address or use the email link.";
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
