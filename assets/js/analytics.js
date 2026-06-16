/* ==========================================================================
   Bizon Labs — analytics, engagement & consent (self-contained, no build step)
   --------------------------------------------------------------------------
   HOW TO ACTIVATE: paste your 3 IDs into CONFIG below. Each tool only turns on
   once its ID is filled in, so this file is safe to ship even while empty.

     1) Umami      -> umamiWebsiteId  (UUID from cloud.umami.is)   [COOKIELESS]
     2) Clarity    -> clarityProjectId (id from clarity.microsoft.com) [cookies]
     3) HubSpot    -> hubspotPortalId  (numeric Hub ID)               [cookies]

   Behaviour:
   - Umami is cookieless and privacy-friendly, so it loads immediately.
   - Clarity + HubSpot use cookies, so they load ONLY after the visitor clicks
     "Accept" in the consent banner. The banner appears only if at least one of
     those two IDs is configured.
   - Custom events (CTA clicks, contact-form submits, scroll depth) are sent to
     Umami automatically.
   ========================================================================== */
(function () {
	"use strict";

	var CONFIG = {
		umamiWebsiteId:   "REPLACE_WITH_UMAMI_WEBSITE_ID",     // e.g. "1a2b3c4d-...."
		umamiSrc:         "https://cloud.umami.is/script.js",  // change only if self-hosting
		clarityProjectId: "REPLACE_WITH_CLARITY_PROJECT_ID",   // e.g. "abcde12345"
		hubspotPortalId:  "REPLACE_WITH_HUBSPOT_PORTAL_ID"     // e.g. "12345678"
	};

	var PLACEHOLDER = "REPLACE_WITH";
	function isSet(v) { return !!v && v.indexOf(PLACEHOLDER) === -1; }

	/* ---- generic script loader ---- */
	function loadScript(src, attrs, id) {
		if (id && document.getElementById(id)) return;
		var s = document.createElement("script");
		s.src = src; s.async = true;
		if (id) s.id = id;
		if (attrs) { Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); }); }
		document.head.appendChild(s);
	}

	/* ---- Umami (cookieless, always on) ---- */
	function loadUmami() {
		if (!isSet(CONFIG.umamiWebsiteId)) return;
		loadScript(CONFIG.umamiSrc, { "data-website-id": CONFIG.umamiWebsiteId }, "umami-analytics");
	}

	/* ---- event helper -> Umami ---- */
	function track(name, data) {
		try {
			if (window.umami && typeof window.umami.track === "function") {
				window.umami.track(name, data || {});
			}
		} catch (e) { /* no-op */ }
	}

	/* ---- cookie-based tools (need consent) ---- */
	function loadClarity() {
		if (!isSet(CONFIG.clarityProjectId)) return;
		(function (c, l, a, r, i, t, y) {
			c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
			t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
			y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
		})(window, document, "clarity", "script", CONFIG.clarityProjectId);
	}
	function loadHubSpot() {
		if (!isSet(CONFIG.hubspotPortalId)) return;
		loadScript("https://js.hs-scripts.com/" + CONFIG.hubspotPortalId + ".js", null, "hs-script-loader");
	}
	function loadCookieTools() { loadClarity(); loadHubSpot(); }
	function cookieToolsConfigured() {
		return isSet(CONFIG.clarityProjectId) || isSet(CONFIG.hubspotPortalId);
	}

	/* ---- consent storage ---- */
	var KEY = "bz_consent"; // "granted" | "denied"
	function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
	function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* no-op */ } }

	/* ---- consent banner ---- */
	function buildBanner() {
		if (document.getElementById("bz-consent")) return;
		var bar = document.createElement("div");
		bar.id = "bz-consent";
		bar.className = "bz-consent";
		bar.setAttribute("role", "dialog");
		bar.setAttribute("aria-label", "Cookie consent");
		bar.innerHTML =
			'<p class="bz-consent-text">We use privacy-friendly analytics to understand how this site is used. ' +
			'With your consent we also enable optional tools (heatmaps and visitor insights). ' +
			'See our <a href="privacy.html">Privacy Policy</a>.</p>' +
			'<div class="bz-consent-actions">' +
				'<button type="button" class="btn btn--ghost bz-decline">Decline</button>' +
				'<button type="button" class="btn btn--primary bz-accept">Accept</button>' +
			'</div>';
		document.body.appendChild(bar);
		bar.querySelector(".bz-accept").addEventListener("click", function () {
			setConsent("granted"); hideBanner(); loadCookieTools(); track("consent_accept");
		});
		bar.querySelector(".bz-decline").addEventListener("click", function () {
			setConsent("denied"); hideBanner(); track("consent_decline");
		});
		requestAnimationFrame(function () { bar.classList.add("is-in"); });
	}
	function hideBanner() {
		var b = document.getElementById("bz-consent");
		if (b) { b.classList.remove("is-in"); setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 300); }
	}

	/* ---- engagement events ---- */
	function initEvents() {
		// CTA / button / email clicks (delegated, captures all without per-element edits)
		document.addEventListener("click", function (e) {
			var el = e.target.closest ? e.target.closest('a.btn, button[type="submit"], a[href^="mailto:"]') : null;
			if (!el) return;
			var label = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
			var href = el.getAttribute("href") || "";
			track("cta_click", { label: label, href: href });
		}, true);

		// Contact form submit
		var form = document.querySelector("form.form");
		if (form) { form.addEventListener("submit", function () { track("contact_submit", {}); }); }

		// Scroll depth (25 / 50 / 75 / 100 %)
		var marks = [25, 50, 75, 100], hit = {};
		window.addEventListener("scroll", function () {
			var h = document.documentElement;
			var max = h.scrollHeight - window.innerHeight;
			if (max <= 0) return;
			var pct = (h.scrollTop / max) * 100;
			marks.forEach(function (m) { if (pct >= m && !hit[m]) { hit[m] = 1; track("scroll_depth", { percent: m }); } });
		}, { passive: true });
	}

	/* ---- init ---- */
	function init() {
		loadUmami();      // cookieless — no consent required
		initEvents();
		var consent = getConsent();
		if (consent === "granted") {
			loadCookieTools();
		} else if (consent !== "denied" && cookieToolsConfigured()) {
			buildBanner();
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
