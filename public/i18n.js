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
    document.title = mapped(originalTitle, language);
    document.body.dataset.language = language;
    document.body.dataset.lang = language;
    translateTree(document.body, language);
    carryLanguageIntoLinks(language);
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

  var style = document.createElement('style');
  style.textContent = '.vie-language-switch{position:fixed;top:var(--vie-lang-top,12px);right:var(--vie-lang-right,12px);z-index:2147483000;display:flex;align-items:center;padding:3px;border:1px solid var(--vie-lang-border,rgba(40,35,32,.18));border-radius:999px;background:var(--vie-lang-bg,rgba(255,255,255,.88));color:var(--vie-lang-fg,#322b28);box-shadow:0 8px 28px rgba(0,0,0,.12);backdrop-filter:blur(12px);font:700 10px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em}.vie-language-switch button{min-width:34px;height:28px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer}.vie-language-switch button:hover{background:rgba(127,127,127,.12)}.vie-language-switch button.is-active{background:var(--vie-lang-active,#322b28);color:var(--vie-lang-active-fg,#fff)}.vie-language-switch button:focus-visible{outline:2px solid var(--vie-lang-focus,#c4848b);outline-offset:2px}@media(max-width:640px){.vie-language-switch{top:var(--vie-lang-mobile-top,8px);right:var(--vie-lang-mobile-right,8px)}.vie-language-switch button{min-width:31px;padding:0 6px}}@media print{.vie-language-switch{display:none!important}}';
  document.head.appendChild(style);

  createSwitch();
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
