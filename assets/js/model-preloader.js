// Automatically inject a viewer-wrapper overlay for every <model-viewer>
(function(){
  // Default localized texts. Can be overridden by setting
  // window.MODEL_PRELOADER_TEXTS = { en: {...}, tr: {...} }
  const DEFAULT_TEXTS = {
    tr: {
      loadingText: 'Lütfen bekleyin, 3D model yükleniyor…',
      loadingSubtext: 'Bu işlem internet hızınıza göre birkaç saniye sürebilir.',
      overlayHint: 'AR & 3D deneyimi hazırlanıyor',
      logoText: 'ALBASPACE'
    },
    en: {
      loadingText: 'Please wait — 3D model is loading…',
      loadingSubtext: 'This may take a few seconds depending on your connection.',
      overlayHint: 'Preparing AR & 3D experience',
      logoText: 'ALBASPACE'
    }
  };

  function getTextsForViewer(viewer){
    const global = (window.MODEL_PRELOADER_TEXTS && typeof window.MODEL_PRELOADER_TEXTS === 'object') ? window.MODEL_PRELOADER_TEXTS : {};
    // prefer per-viewer data-lang attribute, otherwise document lang
    const viewerLang = viewer && viewer.dataset && viewer.dataset.lang ? viewer.dataset.lang.split('-')[0] : null;
    const docLang = viewerLang || ((document.documentElement && document.documentElement.lang) ? document.documentElement.lang.split('-')[0] : 'tr');
    const base = Object.assign({}, DEFAULT_TEXTS[docLang] || DEFAULT_TEXTS.tr, global[docLang] || {});

    // allow per-viewer overrides via data- attributes
    const texts = {
      loadingText: viewer.dataset.loadingText || base.loadingText,
      loadingSubtext: viewer.dataset.loadingSubtext || base.loadingSubtext,
      overlayHint: viewer.dataset.overlayHint || base.overlayHint,
      logoText: viewer.dataset.logoText || base.logoText
    };

    if (window.MODEL_PRELOADER_DEBUG) {
      try { console.log('[model-preloader] locale:', docLang, 'texts:', texts); } catch(e){}
    }

    return texts;
  }

  function createOverlayNode(viewer){
    const t = getTextsForViewer(viewer);
    const div = document.createElement('div');
    div.className = 'model-loading-overlay';
    div.setAttribute('aria-live','polite');
    div.setAttribute('aria-busy','true');
    div.innerHTML = `
      <div class="loader-card">
        <div class="loading-logo">
          <img src="/assets/images/albaspace-logo.png" alt="AlbaSpace Logo" />
          <span>${t.logoText}</span>
        </div>

        <div class="loader-orb"><div class="orb-ring"></div><div class="orb-core"></div></div>

        <p class="loading-text">${t.loadingText}</p>
        <p class="loading-subtext">${t.loadingSubtext}</p>

        <div class="progress-shell">
          <div class="progress-bar"><div class="progress-fill"></div></div>
          <div class="progress-glow"></div>
        </div>

        <div class="overlay-hint">${t.overlayHint}</div>
      </div>`;
    return div;
  }

  function attachToViewer(viewer){
    if (!viewer) return;
    if (viewer.closest('.viewer-wrapper')) return; // already wrapped

    const wrapper = document.createElement('div');
    wrapper.className = 'viewer-wrapper';

    // insert wrapper in place of viewer
    viewer.parentNode.insertBefore(wrapper, viewer);
    wrapper.appendChild(viewer);

    const overlay = createOverlayNode(viewer);
    wrapper.insertBefore(overlay, viewer);

    const progressFill = overlay.querySelector('.progress-fill');

    const hideOverlay = () => {
      if (!overlay || overlay.classList.contains('fade-out')) return;
      overlay.classList.add('fade-out');
      overlay.setAttribute('aria-busy', 'false');
      setTimeout(() => { overlay?.remove(); }, 550);
    };

    function updateProgress(e){
      const t = (e && e.detail && typeof e.detail.totalProgress === 'number') ? e.detail.totalProgress : null;
      if (t !== null && progressFill){
        const percent = Math.max(0, Math.min(100, Math.round(t*100)));
        progressFill.style.width = percent + '%';
        if (percent >= 100) setTimeout(hideOverlay, 200);
      }
    }

    viewer.addEventListener('progress', updateProgress);
    viewer.addEventListener('load', () => { if (progressFill) progressFill.style.width = '100%'; setTimeout(hideOverlay, 250); });
    viewer.addEventListener('poster-dismissed', () => { if (progressFill) progressFill.style.width = '100%'; setTimeout(hideOverlay, 250); });

    // Fallback: if model loading stalls
    const fallback = setTimeout(hideOverlay, 20000);

    // if viewer becomes removed, cleanup
    const obs = new MutationObserver(() => {
      if (!document.body.contains(viewer)){
        clearTimeout(fallback);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // If the model-viewer is already complete, hide immediately
    if (viewer.hasAttribute('reveal') || viewer.getAttribute('src') === '') {
      // don't assume loaded; keep overlay until progress/load events
    }
  }

  function init(){
    const viewers = document.querySelectorAll('model-viewer');
    if (!viewers || viewers.length === 0) return;

    viewers.forEach(attachToViewer);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
