(function () {
  'use strict';

  var STORAGE_KEY = 'vie-language';
  var SUPPORTED = ['en', 'id', 'zh-Hant-TW'];
  var SHORT = { en: 'EN', id: 'ID', 'zh-Hant-TW': '繁中' };
  var FULL = { en: 'English', id: 'Bahasa Indonesia', 'zh-Hant-TW': '繁體中文（台灣）' };
  var OWNED_HOST = /(^|\.)(vercel\.app)$/i;
  var originalText = new WeakMap();
  var originalAttrs = new WeakMap();
  var originalTitle = document.title;
  var PORTFOLIO_URL = 'https://vienna-portfolio-psi.vercel.app/';
  var DOCK_COPY = {
    en: { label: 'A working sample by Vie', portfolio: 'View portfolio', contact: 'Discuss a project' },
    id: { label: 'Contoh karya langsung oleh Vie', portfolio: 'Lihat portofolio', contact: 'Diskusikan proyek' },
    'zh-Hant-TW': { label: 'Vie 的實作範例', portfolio: '查看作品集', contact: '洽談專案' }
  };
  var TITLE_COPY = {
    'Vie — web, design & data after dark': {
      id: 'Vie — web, desain & data setelah jam kerja',
      'zh-Hant-TW': 'Vie — 下班後的網站、設計與資料服務'
    },
    'Vienna HPP Tracker — demo lengkap': { en: 'Vienna HPP Tracker — full demo', 'zh-Hant-TW': 'Vienna HPP Tracker — 完整試用版' },
    'Manis Petang — cake for the slow hour': { id: 'Manis Petang — kue untuk waktu yang berjalan pelan', 'zh-Hant-TW': 'Manis Petang — 留給悠閒時光的蛋糕' },
    'Vie · Content Writer & Proofreader — SEO-first, Bilingual EN/ID': { id: 'Vie · Penulis Konten & Proofreader — SEO, EN/ID', 'zh-Hant-TW': 'Vie · 內容寫作與校對 — SEO、印尼文／英文' },
    'vienna — parallax landing page demos': { id: 'vienna — demo landing page parallax', 'zh-Hant-TW': 'vienna — 視差形象頁展示' },
    'Dapur Asap — smoke, fire, rice': { id: 'Dapur Asap — asap, api, nasi', 'zh-Hant-TW': 'Dapur Asap — 煙、火與米飯' },
    'Manis Petang — a patisserie that closes at dusk': { id: 'Manis Petang — patisserie yang tutup saat senja', 'zh-Hant-TW': 'Manis Petang — 黃昏打烊的甜點店' },
    'Sore — one cardigan, knitted slowly': { id: 'Sore — satu cardigan, dirajut perlahan', 'zh-Hant-TW': 'Sore — 慢慢織成的一件針織外套' },
    'MERIDIAN 38 — a field watch that reads at a glance': { id: 'MERIDIAN 38 — jam lapangan yang mudah dibaca', 'zh-Hant-TW': 'MERIDIAN 38 — 一眼即可讀時的戶外腕錶' },
    'STRIDE 01 — a sneaker built for pavement': { id: 'STRIDE 01 — sneaker untuk jalanan kota', 'zh-Hant-TW': 'STRIDE 01 — 為城市街道打造的球鞋' },
    'Ruang Senja — interiors for the way light moves': { id: 'Ruang Senja — interior yang mengikuti gerak cahaya', 'zh-Hant-TW': 'Ruang Senja — 順著光線流動的室內設計' },
    'Undangan Pernikahan — Nusantara': { en: 'Wedding Invitation — Nusantara', 'zh-Hant-TW': '婚禮電子喜帖 — Nusantara' },
    'vienna · banking — Dashboard Demo': { en: 'vienna · banking — Dashboard Demo', 'zh-Hant-TW': 'vienna · banking — 銀行儀表板展示' },
    'vienna · Sticker Nama — Label Tom & Jerry': { en: 'vienna · Name Stickers — Tom & Jerry Labels', 'zh-Hant-TW': 'vienna · 姓名貼 — Tom & Jerry 標籤' }
  };
  var config = getPageConfig();
  if (!config) return;

  function normalizedPath() {
    var path = location.pathname.replace(/\/+$/, '') || '/';
    return path === '/index.html' ? '/' : path;
  }

  function getPageConfig() {
    var translations = window.VIE_TRANSLATIONS || {};
    var pages = translations.pages || {};
    return pages[normalizedPath()] || pages['*'] || null;
  }

  function requestedLanguage() {
    var fromUrl = new URLSearchParams(location.search).get('lang');
    if (SUPPORTED.indexOf(fromUrl) >= 0) return fromUrl;
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED.indexOf(saved) >= 0) return saved;
    } catch (_) {}
    return config.default || config.source || 'en';
  }

  function mapped(value, language) {
    if (!value || language === config.source) return value;
    var dictionary = (config.locales && config.locales[language]) || {};
    if (Object.prototype.hasOwnProperty.call(dictionary, value)) return dictionary[value];
    var patterns = (config.patterns && config.patterns[language]) || [];
    for (var i = 0; i < patterns.length; i++) {
      var pattern = patterns[i];
      var match = value.match(new RegExp(pattern[0]));
      if (match) return value.replace(new RegExp(pattern[0]), pattern[1]);
    }
    return value;
  }

  function localizedTitle(language) {
    var translated = mapped(originalTitle, language);
    var fallback = TITLE_COPY[originalTitle];
    return translated === originalTitle && fallback && fallback[language] ? fallback[language] : translated;
  }

  function translateTextNode(node, language) {
    if (!node.nodeValue || !node.parentElement || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(node.parentElement.tagName)) return;
    if (node.parentElement.closest('[data-i18n-skip]')) return;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    var original = originalText.get(node);
    var trimmed = original.trim();
    if (!trimmed) return;
    var replacement = mapped(trimmed, language);
    var nextValue = language === 'zh-Hant-TW' && /[\u3400-\u9fff]/.test(replacement)
      ? replacement
      : original.replace(trimmed, replacement);
    if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
  }

  function translateElement(element, language) {
    if (!(element instanceof Element) || element.closest('[data-vie-language-switch]')) return;
    var attrs = ['aria-label', 'placeholder', 'title'];
    if (!originalAttrs.has(element)) originalAttrs.set(element, {});
    var saved = originalAttrs.get(element);
    attrs.forEach(function (name) {
      if (!element.hasAttribute(name) && saved[name] == null) return;
      if (saved[name] == null) saved[name] = element.getAttribute(name);
      if (saved[name] != null) {
        var nextValue = mapped(saved[name], language);
        if (element.getAttribute(name) !== nextValue) element.setAttribute(name, nextValue);
      }
    });
  }

  function translateTree(root, language) {
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root, language);
      return;
    }
    if (!(root instanceof Element) && root !== document) return;
    if (root instanceof Element) translateElement(root, language);
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
      else translateElement(node, language);
    }
  }

  function carryLanguageIntoLinks(language) {
    document.querySelectorAll('a[href]').forEach(function (anchor) {
      var raw = anchor.getAttribute('href');
      if (!raw || raw[0] === '#' || /^(mailto:|tel:|javascript:)/i.test(raw) || anchor.hasAttribute('download')) return;
      try {
        var url = new URL(raw, location.href);
        if (url.origin === location.origin || OWNED_HOST.test(url.hostname)) {
          url.searchParams.set('lang', language);
          anchor.href = url.href;
        }
      } catch (_) {}
    });
  }

  function setLanguage(language, updateUrl) {
    if (SUPPORTED.indexOf(language) < 0) language = config.source || 'en';
    document.documentElement.lang = language;
    document.title = localizedTitle(language);
    document.body.dataset.language = language;
    document.body.dataset.lang = language;
    translateTree(document.body, language);
    carryLanguageIntoLinks(language);
    updateStudioDock(language);
    document.querySelectorAll('[data-vie-language]').forEach(function (button) {
      var active = button.dataset.vieLanguage === language;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    });
    try { localStorage.setItem(STORAGE_KEY, language); } catch (_) {}
    if (updateUrl && history.replaceState) {
      var url = new URL(location.href);
      url.searchParams.set('lang', language);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    window.dispatchEvent(new CustomEvent('vie:languagechange', { detail: { language: language } }));
  }

  function createSwitch() {
    var existing = document.querySelector('[data-vie-language-switch]');
    if (existing) {
      existing.querySelectorAll('[data-vie-language]').forEach(function (button) {
        button.addEventListener('click', function () { setLanguage(button.dataset.vieLanguage, true); });
      });
      return;
    }
    var nav = document.createElement('nav');
    nav.className = 'vie-language-switch';
    nav.dataset.vieLanguageSwitch = '';
    nav.setAttribute('aria-label', 'Language / Bahasa / 語言');
    SUPPORTED.forEach(function (language) {
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.vieLanguage = language;
      button.textContent = SHORT[language];
      button.title = FULL[language];
      button.addEventListener('click', function () { setLanguage(language, true); });
      nav.appendChild(button);
    });
    document.body.appendChild(nav);
  }

  function isPortfolioHost() {
    return /^vienna-portfolio(?:-|\.|$)/i.test(location.hostname);
  }

  function createStudioDock() {
    if (isPortfolioHost() || document.querySelector('[data-vie-studio-dock]')) return;
    var dock = document.createElement('aside');
    dock.className = 'vie-studio-dock';
    dock.dataset.vieStudioDock = '';
    dock.dataset.i18nSkip = '';
    dock.innerHTML = '<span data-vie-dock-label></span><div><a data-vie-dock-portfolio href="' + PORTFOLIO_URL + '"></a><a data-vie-dock-contact href="mailto:vchoi75@gmail.com?subject=Project%20inquiry%20%E2%80%94%20Vie"></a></div>';
    document.body.appendChild(dock);
  }

  function updateStudioDock(language) {
    var dock = document.querySelector('[data-vie-studio-dock]');
    if (!dock) return;
    var copy = DOCK_COPY[language] || DOCK_COPY.en;
    dock.querySelector('[data-vie-dock-label]').textContent = copy.label;
    dock.querySelector('[data-vie-dock-portfolio]').textContent = copy.portfolio + ' ↗';
    dock.querySelector('[data-vie-dock-contact]').textContent = copy.contact + ' ↗';
  }

  var style = document.createElement('style');
  style.textContent = '.vie-language-switch{position:fixed;top:var(--vie-lang-top,12px);right:var(--vie-lang-right,12px);z-index:2147483000;display:flex;align-items:center;padding:3px;border:1px solid var(--vie-lang-border,rgba(40,35,32,.18));border-radius:999px;background:var(--vie-lang-bg,rgba(255,255,255,.88));color:var(--vie-lang-fg,#322b28);box-shadow:0 8px 28px rgba(0,0,0,.12);backdrop-filter:blur(12px);font:700 10px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em}.vie-language-switch button{min-width:34px;height:28px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer}.vie-language-switch button:hover{background:rgba(127,127,127,.12)}.vie-language-switch button.is-active{background:var(--vie-lang-active,#322b28);color:var(--vie-lang-active-fg,#fff)}.vie-language-switch button:focus-visible{outline:2px solid var(--vie-lang-focus,#c4848b);outline-offset:2px}.vie-studio-dock{position:fixed;left:12px;bottom:12px;z-index:2147482999;width:min(310px,calc(100vw - 24px));padding:10px 12px;border:1px solid rgba(40,35,32,.18);border-radius:16px;background:rgba(255,255,255,.92);color:#242033;box-shadow:0 12px 38px rgba(0,0,0,.16);backdrop-filter:blur(14px);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.vie-studio-dock>span{display:block;margin-bottom:7px;color:#6b6576;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}.vie-studio-dock>div{display:flex;flex-wrap:wrap;gap:7px 12px}.vie-studio-dock a{color:inherit;font-size:11px;font-weight:750;text-decoration:underline;text-decoration-color:rgba(79,107,255,.45);text-underline-offset:3px}.vie-studio-dock a:hover{color:#4f6bff}.vie-studio-dock a:focus-visible{outline:2px solid #4f6bff;outline-offset:3px;border-radius:3px}@media(max-width:640px){.vie-language-switch{top:var(--vie-lang-mobile-top,8px);right:var(--vie-lang-mobile-right,8px)}.vie-language-switch button{min-width:31px;padding:0 6px}.vie-studio-dock{left:8px;bottom:8px;width:min(286px,calc(100vw - 16px));padding:8px 10px}}@media print{.vie-language-switch,.vie-studio-dock{display:none!important}}';
  document.head.appendChild(style);

  createSwitch();
  createStudioDock();
  var language = requestedLanguage();
  setLanguage(language, false);
  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) { translateTree(node, language); });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('vie:languagechange', function (event) { language = event.detail.language; });
})();
