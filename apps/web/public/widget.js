(function () {
  "use strict";

  // Find this script tag by looking for data-slug attribute
  var scriptEl = document.querySelector("script[data-slug][src*=\"widget.js\"]");
  if (!scriptEl) return;

  var slug = scriptEl.getAttribute("data-slug");
  var color = scriptEl.getAttribute("data-color") || "#2563EB";
  var buttonText = scriptEl.getAttribute("data-text") || "Get Free Estimate";

  if (!slug) return;

  // Derive base URL from script src (handles both prod and dev)
  var src = scriptEl.getAttribute("src") || "";
  var baseUrl = src.replace(/\/widget\.js.*$/, "");

  var bookingUrl = baseUrl + "/book/" + slug + "?embed=1&source=widget";

  // Inject styles
  var style = document.createElement("style");
  style.textContent = [
    "#zaxvio-widget-btn{position:fixed;bottom:24px;right:24px;z-index:999998;display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:9999px;border:none;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);transition:transform .15s,box-shadow .15s}",
    "#zaxvio-widget-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.3)}",
    "#zaxvio-widget-btn svg{flex-shrink:0}",
    "#zaxvio-widget-overlay{display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px}",
    "#zaxvio-widget-overlay.open{display:flex}",
    "#zaxvio-widget-modal{position:relative;width:100%;max-width:520px;max-height:90vh;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.35);display:flex;flex-direction:column}",
    "#zaxvio-widget-close{position:absolute;top:12px;right:12px;z-index:1;background:rgba(0,0,0,.08);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}",
    "#zaxvio-widget-close:hover{background:rgba(0,0,0,.15)}",
    "#zaxvio-widget-iframe{flex:1;border:none;width:100%;height:680px}",
    "@media(max-width:600px){#zaxvio-widget-modal{max-height:95vh;border-radius:12px}#zaxvio-widget-iframe{height:580px}}",
  ].join("");
  document.head.appendChild(style);

  // Button
  var btn = document.createElement("button");
  btn.id = "zaxvio-widget-btn";
  btn.setAttribute("aria-label", buttonText);
  btn.style.backgroundColor = color;
  btn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>' +
    "<span>" + buttonText + "</span>";
  document.body.appendChild(btn);

  // Overlay
  var overlay = document.createElement("div");
  overlay.id = "zaxvio-widget-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Book a service appointment");

  var modal = document.createElement("div");
  modal.id = "zaxvio-widget-modal";

  var closeBtn = document.createElement("button");
  closeBtn.id = "zaxvio-widget-close";
  closeBtn.setAttribute("aria-label", "Close booking form");
  closeBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var iframe = document.createElement("iframe");
  iframe.id = "zaxvio-widget-iframe";
  iframe.setAttribute("title", "Book a service appointment");
  iframe.setAttribute("loading", "eager");
  // src set on open to avoid loading until needed

  modal.appendChild(closeBtn);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Open / close logic
  var iframeLoaded = false;

  function openWidget() {
    if (!iframeLoaded) {
      iframe.src = bookingUrl;
      iframeLoaded = true;
    }
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeWidget() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  btn.addEventListener("click", openWidget);
  closeBtn.addEventListener("click", closeWidget);

  // Close on backdrop click (not modal click)
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeWidget();
  });

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeWidget();
  });

  // Listen for a message from the iframe to close after successful booking
  window.addEventListener("message", function (e) {
    if (e.data === "zaxvio:booking-complete") closeWidget();
  });
})();
