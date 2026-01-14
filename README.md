# AlbaSpace-main2

## Model preloader localization

The site includes a shared model preloader that is injected for every `<model-viewer>` element by `assets/js/model-preloader.js`.

Features:
- Default language texts for Turkish (`tr`) and English (`en`). The script picks the language from `document.documentElement.lang` (falls back to `tr`).
- **Global override**: set `window.MODEL_PRELOADER_TEXTS` before the script runs to replace default texts per language:

```html
<script>
window.MODEL_PRELOADER_TEXTS = {
  en: {
    loadingText: 'Please wait — 3D model is loading…',
    loadingSubtext: 'This may take a few seconds depending on your connection.',
    overlayHint: 'Preparing AR & 3D experience',
    logoText: 'ALBASPACE'
  },
  tr: {
    loadingText: 'Lütfen bekleyin, 3D model yükleniyor…',
    loadingSubtext: 'Bu işlem internet hızınıza göre birkaç saniye sürebilir.',
    overlayHint: 'AR & 3D deneyimi hazırlanıyor',
    logoText: 'ALBASPACE'
  }
};
</script>
```

- **Per-viewer overrides**: set data attributes on a `<model-viewer>` to override texts for that particular viewer:

```html
<model-viewer src="/assets/models/foo.glb"
  data-loading-text="Custom loading text…"
  data-loading-subtext="Custom subtext"
  data-overlay-hint="Custom hint"
  data-logo-text="MyBrand"
  data-lang="en"></model-viewer>
```

The `data-lang` attribute forces the locale for that viewer (useful if page language is different).

- **Debugging**: set `window.MODEL_PRELOADER_DEBUG = true` in the page to log the selected locale and texts in the console (useful for verifying TR/EN on demand).

This centralizes localization and makes it easy to provide custom per-model messages without duplicating markup.
