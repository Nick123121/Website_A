// Unified include.js for AlbaSpace website (Turkish)
// Includes: Dynamic Header/Footer, AI Widget (Text+Voice), Analytics (GA4 + Yandex)
runAfterDomReady(() => {
  // AI-виджеты включены — используются для текстового и голосового общения
  window.__disableAiWidgets = false;
  // 1. ЗАПУСК АНАЛИТИКИ (В первую очередь)
  injectAnalytics();
  // 2. Favicon
  (function ensureFavicon() {
    try {
      const existing = document.querySelector('link[rel~="icon"]');
      if (existing) {
        if (existing.getAttribute('href') === '/favicon.png') {
          existing.setAttribute('href', '/assets/images/albalogo.png');
        }
        return;
      }
      const l = document.createElement('link');
      l.rel = 'icon';
      l.type = 'image/png';
      l.href = '/assets/images/albalogo.png';
      document.head.appendChild(l);
    } catch (e) {
      /* silently ignore DOM issues */
    }
  })();
  // 3. Загружаем CSS и скрипт для model-viewer
  injectModelViewerStyles();
  ensureModelViewerLoaded();
  // 3.1. Фикс фона и ширины на iOS
  injectBackgroundFix();

  // 4. Создаём лоадеры
  const ensurePreloaderScript = createPreloaderLoader();
  const ensureModelPreloader = createModelPreloaderLoader();
  const ensureModelNavLoader = createModelNavLoader();
  // 5. Mobile nav override - REMOVED, using site.css mobile styles instead
  // The override was causing pointer-events issues with menu toggle
  // 6. Load includes (Header / Footer)
  const includes = document.querySelectorAll("[data-include], [data-include-html]");
  if (includes.length) {
    includes.forEach((el) => {
      const url = el.getAttribute("data-include") || el.getAttribute("data-include-html");
      if (!url) return;
      const tryPaths = [url];
      if (url.startsWith("/")) {
        tryPaths.push(url.slice(1));
      }
      const loadFragment = async () => {
        let html = "";
        let lastErr;
        for (const path of tryPaths) {
          try {
            const res = await fetch(path, { cache: "no-cache" });
            if (!res.ok) throw new Error("Failed " + res.status + " for " + path);
            html = await res.text();
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!html) throw lastErr || new Error("Unknown include error for " + url);
        // Вставка HTML и выполнение скриптов
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        const scripts = Array.from(tmp.querySelectorAll("script"));
        scripts.forEach((s) => {
          if (s.parentNode) s.parentNode.removeChild(s);
        });
        el.innerHTML = tmp.innerHTML;
        scripts.forEach((oldScript) => {
          const newScript = document.createElement("script");
          Array.from(oldScript.attributes || []).forEach(({ name, value }) => {
            if (name === "src") {
              newScript.src = value;
            } else {
              newScript.setAttribute(name, value);
            }
          });
          if (!oldScript.src) {
            newScript.textContent = oldScript.textContent || "";
          }
          if (oldScript.async) newScript.async = true;
          if (oldScript.defer) newScript.defer = true;
          (document.head || document.documentElement).appendChild(newScript);
        });
      };
      loadFragment()
        .then(() => {
          if (url.includes("header-")) {
            markActiveNav();
            setupLangSwitch();
            ensurePreloaderScript();
            ensureModelPreloader();
            ensureModelNavLoader();
          }
          if (url.includes("footer-")) {
            enhanceFooter(el);
            ensureModelPreloader();
          }
          // After an include is injected, re-scan for revealable elements so
          // dynamically-inserted content (header/footer) and content shown by
          // interactive controls are observed and animated.
          try {
            if (typeof initScrollReveal === 'function') initScrollReveal();
          } catch (e) { /* ignore errors during init */ }
        })
        .catch((err) => console.error("[include.js] include failed", url, err));
    });
  } else {
    ensureModelPreloader();
  }
  // 7. GLOBAL AI WIDGET (Albamen / Albaman) — текстовый чат
  // Отключаем авто-открытие по умолчанию — будем открывать только по клику
  // ===== GLOBAL AI WIDGET (Albamen / Albaman) =====
  // Отключаем авто-открытие виджета по умолчанию — открываем только по клику
  window.__allowAiAutoOpen = false;
  // Включаем виджеты только на странице "hakkimizda"
  try {
    const _path = window.location.pathname || '/';
    const _enableAiOnThisPage = /\/hakkimizda(\.html)?\/?$/i.test(_path);
    if (!window.__disableAiWidgets && _enableAiOnThisPage) {
      injectAiWidget();
      // 8. Голосовой виджет — кнопка + модалка + подключение script.js
      injectVoiceWidget();
    } else {
      console.info('[include.js] AI widgets are disabled by flag or not allowed on this page');
    }
  } catch (e) {
    console.error('[include.js] Failed to decide AI widget injection:', e);
  }
    // Safety: ensure AI panels are collapsed on initial load
    try {
      const cleanupOpenAi = () => {
        document.querySelectorAll('.ai-panel-global.ai-open, .ai-panel-voice.ai-open').forEach(el => el.classList.remove('ai-open'));
        const floating = document.getElementById('ai-floating-global');
        if (floating && (!floating.dataset || floating.dataset.keepVisible !== 'true')) {
          floating.style.display = 'none !important';
        }
        const toggle = document.getElementById('ai-widget-toggle-btn');
        if (toggle) toggle.classList.remove('ai-open');
      };
      // run immediately and also shortly after to cover race conditions
      cleanupOpenAi();
      setTimeout(cleanupOpenAi, 300);
    } catch (e) { /* noop */ }
  // 9. Плавное появление блоков на всех страницах
  initScrollReveal();

  // --- Текстовый чат Albamen (старый UI, новая схема с памятью) ---
  function injectAiWidget() {
    const path = window.location.pathname || '/';
    const isEn = path.startsWith('/eng/');

    const strings = isEn ? {
      placeholder: 'Send a message...',
      listening: 'Listening...',
      connect: 'Connecting...',
      initialStatus: 'How can I help you today?',
      welcomeBack: 'Welcome back, ',
      voiceNotSupported: 'Voice not supported',
      connectionError: 'Connection error.'
    } : {
      placeholder: 'Bir mesaj yazın...',
      listening: 'Dinliyorum...',
      connect: 'Bağlanıyor...',
      initialStatus: 'Bugün sana nasıl yardım edebilirim?',
      welcomeBack: 'Tekrar hoş geldin, ',
      voiceNotSupported: 'Ses desteği yok',
      connectionError: 'Bağlantı hatası.'
    };

    // имя для приветствия
    const storedName = localStorage.getItem('albamen_user_name');
    if (storedName) {
      strings.initialStatus = strings.welcomeBack + storedName + '! 🚀';
    }

    // sessionId для памяти
    const sessionId = getAlbamenSessionId();

    if (document.getElementById('ai-floating-global')) return;

    // Создаем контейнер для виджетов (минимизированный — видны только кнопки)
    const floating = document.createElement('div');
    floating.className = 'ai-floating';
    floating.id = 'ai-floating-global';
    const avatarSrc = '/assets/images/albamenai.png';
    floating.innerHTML = `
      <div class="ai-hero-avatar" id="ai-avatar-trigger">
        <img src="${avatarSrc}" alt="Albamen AI">
      </div>
    `;
    floating.style.display = 'none !important'; // Скрываем виджеты по умолчанию — открываем только по клику
    document.body.appendChild(floating);

    // Создаем главную кнопку вызова виджетов (всегда видна)
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ai-widget-toggle-btn';
    toggleBtn.id = 'ai-widget-toggle-btn';
    toggleBtn.setAttribute('aria-label', isEn ? 'Open AI assistant' : 'AI asistanı aç');
    toggleBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    document.body.appendChild(toggleBtn);

    // Обработчик для открытия/закрытия виджетов
    toggleBtn.addEventListener('click', () => {
      if (floating.style.display === 'none' || floating.style.display === 'none !important') {
        floating.style.display = 'flex !important'; // Показываем виджеты
        toggleBtn.classList.add('ai-open');
      } else {
        floating.style.display = 'none !important'; // Скрываем виджеты
        toggleBtn.classList.remove('ai-open');
        // Закрываем панель чата если она открыта
        const panel = document.querySelector('.ai-panel-global');
        if (panel) panel.classList.remove('ai-open');
      }
    });

    const panel = document.createElement('div');
    panel.className = 'ai-panel-global';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <button class="ai-voice-btn" id="ai-voice-btn-panel" aria-label="Call AI">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </button>
        <button class="ai-close-icon" id="ai-close-btn">×</button>
      </div>
      <div class="ai-panel-body">
        <div class="ai-messages-list" id="ai-messages-list"></div>
        <div class="ai-chat-avatar-large"><img src="${avatarSrc}" alt="Albamen"></div>
        <div class="ai-status-text" id="ai-status-text">${strings.initialStatus}</div>
        <div class="ai-status-text ai-voice-status" id="voice-status-text" style="display:none;">${strings.talkPrompt}</div>
        <div class="voice-controls hidden" id="voice-inline-controls">
          <div class="voice-wave hidden" id="voice-wave">
            <div class="voice-bar"></div><div class="voice-bar"></div><div class="voice-bar"></div>
          </div>
          <button class="voice-stop-btn hidden" id="voice-stop-btn">■</button>
        </div>
        <div class="ai-input-area">
          <button class="ai-action-btn ai-mic-btn-panel" id="ai-mic-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>
          <input type="text" class="ai-input" id="ai-input-field" placeholder="${strings.placeholder}">
          <button class="ai-action-btn ai-send-btn-panel" id="ai-send-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Ensure panels are hidden by default and attach delegated handlers
    // This prevents accidental auto-open and makes close buttons reliable
    try {
      panel.classList.remove('ai-open');
      panel.classList.remove('chat-active');
      panel.classList.remove('voice-active');
      // Delegated click handler: open/close reliably even with duplicate IDs
      if (!window.__albamen_ai_delegated) {
        window.__albamen_ai_delegated = true;
        document.addEventListener('click', (ev) => {
          const close = ev.target.closest && ev.target.closest('.ai-close-icon');
          if (close) {
            const p = close.closest('.ai-panel-global, .ai-panel-voice');
            if (p) p.classList.remove('ai-open');
            return;
          }
          const openChat = ev.target.closest && ev.target.closest('#ai-avatar-trigger, #ai-call-trigger, .ai-call-btn, .ai-hero-avatar');
          if (openChat) {
            const p = document.querySelector('.ai-panel-global');
            if (p) p.classList.add('ai-open');
            return;
          }
          const openVoice = ev.target.closest && ev.target.closest('#ai-voice-btn, .ai-voice-btn');
          if (openVoice) {
            const vp = document.querySelector('.ai-panel-voice');
            if (vp) vp.classList.add('ai-open');
            return;
          }
        }, { capture: false });
      }
    } catch (e) { /* safe fallback */ }

    const avatarTrigger = document.getElementById('ai-avatar-trigger');
    const closeBtn = document.getElementById('ai-close-btn');
    const sendBtn = document.getElementById('ai-send-btn');
    const micBtn = document.getElementById('ai-mic-btn');
    const inputField = document.getElementById('ai-input-field');
    const msgList = document.getElementById('ai-messages-list');
    const statusText = document.getElementById('ai-status-text');

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    const recognition = SpeechRec ? new SpeechRec() : null;
    let isListening = false;

    const openPanel = (evt) => {
      // Only open in response to a trusted user event, or when explicitly allowed.
      if (!evt || evt.isTrusted !== true) {
        if (!window.__allowAiAutoOpen) return;
      }
      panel.classList.add('ai-open');
    };
    const closePanel = () => {
      panel.classList.remove('ai-open');
      panel.classList.remove('chat-active');
      statusText.style.display = 'block';
      statusText.textContent = strings.initialStatus;
    };

    avatarTrigger.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);

    function addMessage(text, type, id = null) {
      const div = document.createElement('div');
      div.className = `ai-msg ${type}`;
      div.textContent = text;
      if (id) div.id = id;
      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
    }

    function sendMessage() {
      const txt = (inputField.value || '').trim();
      if (!txt) return;

      panel.classList.add('chat-active');
      addMessage(txt, 'user');
      inputField.value = '';

      const loadingId = 'loading-' + Date.now();
      addMessage('...', 'bot', loadingId);
      statusText.textContent = strings.connect;
      statusText.style.display = 'block';

      const workerUrl = 'https://divine-flower-a0ae.nncdecdgc.workers.dev';

      // текущее сохранённое имя/возраст
      const currentName = localStorage.getItem('albamen_user_name') || null;
      const currentAge  = localStorage.getItem('albamen_user_age')  || null;

      fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: txt,
          sessionId,
          savedName: currentName,
          savedAge: currentAge
        })
      })
        .then(res => res.json())
        .then(data => {
          const loader = document.getElementById(loadingId);
          if (loader) loader.remove();

          if (!data || typeof data.reply !== 'string') {
            addMessage(strings.connectionError, 'bot');
            statusText.style.display = 'none';
            return;
          }

          // сохраняем имя/возраст, если воркер их прислал
          if (data.saveName && typeof data.saveName === 'string') {
            const newName = data.saveName.trim();
            if (newName) {
              localStorage.setItem('albamen_user_name', newName);
            }
          }

          if (data.saveAge && typeof data.saveAge === 'string') {
            const newAge = data.saveAge.trim();
            if (newAge) {
              localStorage.setItem('albamen_user_age', newAge);
            }
          }

          let finalReply = data.reply.trim();

          // Если воркер вернул текст своей ошибки — прячем его от пользователя
          if (/^(Grok Hatası|JS Hatası)/i.test(finalReply)) {
            addMessage(strings.connectionError, 'bot');
            statusText.style.display = 'none';
            return;
          }

          addMessage(finalReply || strings.connectionError, 'bot');
          statusText.style.display = 'none';
        })
        .catch(err => {
          console.error('AI Error:', err);
          const loader = document.getElementById(loadingId);
          if (loader) loader.remove();
          addMessage(strings.connectionError, 'bot');
          statusText.style.display = 'none';
        });
    }

    sendBtn.addEventListener('click', sendMessage);
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    micBtn.addEventListener('click', () => {
      if (!recognition) {
        statusText.textContent = strings.voiceNotSupported;
        statusText.style.display = 'block';
        return;
      }
      if (isListening) {
        recognition.stop();
        return;
      }
      panel.classList.add('chat-active');
      statusText.textContent = strings.listening;
      statusText.style.display = 'block';
      inputField.focus();
      recognition.lang = isEn ? 'en-US' : 'tr-TR';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      isListening = true;
      recognition.start();
    });

    if (recognition) {
      recognition.addEventListener('result', (event) => {
        const transcript = Array.from(event.results)
          .map(res => res[0].transcript)
          .join(' ')
          .trim();
        if (transcript) {
          inputField.value = transcript;
        }
      });
      recognition.addEventListener('end', () => {
        isListening = false;
        statusText.textContent = strings.initialStatus;
      });
      recognition.addEventListener('error', () => {
        isListening = false;
        statusText.textContent = strings.voiceNotSupported;
      });
    }
  }

function injectVoiceWidget() {
  const path = window.location.pathname || '/';
  const isEn = path.startsWith('/eng/');

  const t = isEn ? {
    btnAria: 'Voice chat',
    talkPrompt: 'Tap and Talk 🔊',
    connecting: 'Connecting...',
    listening: 'Listening...',
    modalTitle: 'Let’s meet! 👋',
    modalSubtitle: 'Albamen wants to know your name and age.',
    namePlaceholder: 'Your name?',
    agePlaceholder: 'Your age?',
    cancel: 'Cancel',
    start: 'Start 🚀',
    stop: 'Stop',
    error: 'Voice not supported',
    welcomeBackPrefix: 'Welcome back, ',
    welcomeBackSuffix: '! 🚀',
  } : {
    btnAria: 'Sesli sohbet',
    talkPrompt: 'Tıkla ve Konuş 🔊',
    connecting: 'Bağlanıyor...',
    listening: 'Dinliyorum...',
    modalTitle: 'Tanışalım! 👋',
    modalSubtitle: 'Albamen seninle daha iyi konuşmak için adını ve yaşını bilmek istiyor.',
    namePlaceholder: 'Adın ne?',
    agePlaceholder: 'Yaşın kaç?',
    cancel: 'İptal',
    start: 'Başla 🚀',
    stop: 'Durdur',
    error: 'Ses desteği yok',
    welcomeBackPrefix: 'Tekrar hoş geldin, ',
    welcomeBackSuffix: '! 🚀',
  };

  // ⚡ Берём общую идентичность (sessionId + имя/возраст)
  const identity = getAlbamenIdentity();

  // Пробросим её глобально, чтобы script.js мог использовать
  window.albamenVoiceIdentity = identity;

  // Инъекция CSS для голосового виджета
  if (!document.getElementById('ai-voice-style')) {
    const style = document.createElement('style');
    style.id = 'ai-voice-style';
    style.textContent = `
      .ai-voice-btn { width: 52px; height: 52px; border-radius: 999px; background: #020617; border: 2px solid rgba(148, 163, 184, 0.6); color: #e5e7eb; display: grid; place-items: center; cursor: pointer; box-shadow: 0 14px 35px rgba(15, 23, 42, 0.75); transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease; }
      .ai-voice-btn:hover { transform: translateY(-1px) scale(1.05); background: radial-gradient(circle at 30% 0%, #0ea5e9, #020617 60%); border-color: rgba(56, 189, 248, 0.9); box-shadow: 0 20px 40px rgba(8, 47, 73, 0.9); }
      .ai-panel-voice { position: fixed; right: 20px; bottom: 20px; width: 340px; max-width: 95vw; height: 360px; background: #020617; color: #e5e7eb; border-radius: 24px; box-shadow: 0 22px 55px rgba(15, 23, 42, 0.85); display: flex; flex-direction: column; overflow: hidden; transform: translateY(18px) scale(0.96); opacity: 0; pointer-events: none; transition: transform .26s cubic-bezier(.16,1,.3,1), opacity .26s ease; z-index: 1205; }
      .ai-panel-voice.ai-open { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
      .ai-panel-voice .ai-panel-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px; height: 100%; }
      .ai-panel-voice .ai-status-text { font-size: 12px; color: #9ca3af; text-align: center; min-height: 18px; }
      .ai-panel-voice .ai-chat-avatar-large { margin: 0 auto 4px; }
      .voice-controls { margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 12px; }
      .voice-wave { display: flex; gap: 4px; align-items: flex-end; }
      .voice-wave.hidden { display: none !important; }
      .voice-bar { width: 4px; border-radius: 999px; background: #22c55e; animation: voiceWave 1.2s ease-in-out infinite; }
      .voice-bar:nth-child(2) { animation-delay: .12s; }
      .voice-bar:nth-child(3) { animation-delay: .24s; }
      @keyframes voiceWave { 0%,100% { height: 6px; } 50% { height: 20px; } }
      .voice-stop-btn { width: 34px; height: 34px; border-radius: 999px; border: none; cursor: pointer; display: grid; place-items: center; background: #ef4444; color: #fee2e2; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); animation: pulseStop 1.4s infinite; }
      .voice-stop-btn.hidden { display: none !important; }
      @keyframes pulseStop { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); } 70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      .ai-glow { box-shadow: 0 0 14px rgba(56, 189, 248, 0.8), 0 0 32px rgba(59, 130, 246, 0.8); animation: aiGlow 1.2s ease-in-out infinite; }
      @keyframes aiGlow { 0%,100% { box-shadow: 0 0 10px rgba(56, 189, 248, 0.7), 0 0 24px rgba(56, 189, 248, 0.5); } 50% { box-shadow: 0 0 24px rgba(56, 189, 248, 1), 0 0 42px rgba(37, 99, 235, 0.9); } }
    `;
    document.head.appendChild(style);
  }

  if (document.getElementById('ai-voice-btn')) return;

  const floating = document.getElementById('ai-floating-global');
  if (!floating) return;

  const avatarSrc = '/assets/images/albamenai.png';

  // Кнопка голосового вызова
  const voiceBtn = document.createElement('button');
  voiceBtn.className = 'ai-voice-btn';
  voiceBtn.id = 'ai-voice-btn';
  voiceBtn.setAttribute('aria-label', t.btnAria);
  voiceBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
  floating.appendChild(voiceBtn);

  // Модальное окно голосового чата
  const voicePanel = document.createElement('div');
  voicePanel.id = 'ai-panel-voice';
  voicePanel.className = 'ai-panel-voice';
  voicePanel.innerHTML = `
    <div class="ai-panel-header">
      <button class="ai-close-icon" id="ai-voice-close-btn">×</button>
    </div>
    <div class="ai-panel-body">
      <div class="ai-chat-avatar-large"><img src="${avatarSrc}" alt="Albamen"></div>
      <div class="ai-status-text" id="voice-status-text"></div>
      <div class="voice-controls">
        <div class="voice-wave hidden" id="voice-wave">
          <div class="voice-bar"></div><div class="voice-bar"></div><div class="voice-bar"></div>
        </div>
        <button class="voice-stop-btn hidden" id="voice-stop-btn">■</button>
      </div>
    </div>
  `;
  document.body.appendChild(voicePanel);

  // Ensure voice panel is hidden by default
  voicePanel.classList.remove('ai-open');

  const statusEl = document.getElementById('voice-status-text');

  // Если уже знаем имя — показываем "welcome back", иначе дефолтный prompt
  if (identity.name) {
    statusEl.textContent = (t.welcomeBackPrefix || '') + identity.name + (t.welcomeBackSuffix || '');
  } else {
    statusEl.textContent = t.talkPrompt;
  }

  // === ПОДКЛЮЧЕНИЕ script.js (логика голоса) ===
  if (!document.getElementById('albamen-voice-script')) {
    const voiceScript = document.createElement('script');
    voiceScript.src = '/assets/js/script.js';
    voiceScript.id = 'albamen-voice-script';
    voiceScript.defer = true;
    document.body.appendChild(voiceScript);
  }

  // === ПОДКЛЮЧЕНИЕ voice-diagnostics.js (для отладки) ===
  if (!document.getElementById('albamen-voice-diagnostics')) {
    const diagnosticsScript = document.createElement('script');
    diagnosticsScript.src = '/assets/js/voice-diagnostics.js';
    diagnosticsScript.id = 'albamen-voice-diagnostics';
    diagnosticsScript.defer = true;
    document.body.appendChild(diagnosticsScript);
  }
}
}); // END runAfterDomReady




// -------------------- HELPER FUNCTIONS --------------------
function runAfterDomReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function initScrollReveal() {
  if (window.__albaRevealReady) return;
  window.__albaRevealReady = true;

  const processed = new WeakSet();
  let revealIndex = 0;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.18,
    rootMargin: '0px 0px -8% 0px'
  });

  const selectors = [
    // Explicit opts-in
    '[data-reveal]',
    '.reveal',

    // Common layout containers across legacy pages
    'body > *:not(script):not(style):not(link):not(meta)',
    'main > *:not(script):not(style)',
    '.container',
    '.row',
    '.col',
    '.section',
    '.content',
    '.wrapper',

    // Semantically meaningful blocks
    'section',
    'article',
    '.card',
    '.glass-box',
    '.product-card',
    '.feature-card',
    '.info-card',
    '.panel',
    '.content-block',
    '.hero',
    '.category-card',
    '.logo-carousel-wrap',
    '.atlas-inner',
    '.shop-card',
    '.blog-card',
    '.gallery-card',
    '.team-card',
    '.mission-card'
  ];

  const tagForReveal = (el) => {
    if (!el || processed.has(el) || el.dataset.revealSkip === 'true') return;

    if (!el.classList.contains('reveal')) {
      el.classList.add('reveal');
    }

    if (!el.dataset.direction) {
      el.dataset.direction = (revealIndex % 2 === 0) ? 'left' : 'right';
    }

    const delay = el.dataset.direction === 'left' ? revealIndex * 0.05 : revealIndex * 0.06;
    el.style.setProperty('--reveal-delay', `${delay}s`);

    observer.observe(el);
    processed.add(el);
    revealIndex += 1;
  };

  const scan = () => {
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach(tagForReveal);
    });
  };

  scan();
  setTimeout(scan, 300);
  setTimeout(scan, 1200);
}

function injectAnalytics() {
  if (!document.querySelector('script[src*="googletagmanager"]')) {
    const gScript = document.createElement('script');
    gScript.async = true;
    gScript.src = "https://www.googletagmanager.com/gtag/js?id=G-FV3RXWJ5PQ";
    document.head.appendChild(gScript);
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-FV3RXWJ5PQ');
  }
  if (!window.ym) {
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        k=e.createElement(t),a=e.getElementsByTagName(t)[0];
        k.async=1;
        k.src=r;
        if(a) { a.parentNode.insertBefore(k,a); }
        else { document.head.appendChild(k); }
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=105726731", "ym");
    ym(105726731, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true,
        ecommerce:"dataLayer"
    });
  }
}

function injectModelViewerStyles() {
  if (document.getElementById("albaspace-model-viewer-styles")) return;
  const style = document.createElement("style");
  style.id = "albaspace-model-viewer-styles";
  style.textContent = `
    model-viewer { width: 100%; height: 600px; margin-top: 30px; background: rgba(0, 0, 0, 0.65); border-radius: 12px; box-shadow: 0 0 30px rgba(0, 150, 255, 0.5); display: block; }
    @media (max-width: 768px) { model-viewer { height: 420px; margin-top: 20px; } }
    model-viewer[ar-status="session-started"] { display: block !important; }
    model-viewer::part(default-progress-bar) { background: linear-gradient(90deg, #00b4ff, #00e5ff); }
  `;
  document.head.appendChild(style);
}

// Фикс увеличенного фона и «лишней ширины» на iPhone/iOS
function injectBackgroundFix() {
  if (document.getElementById('alba-bg-fix-style')) return;

  const style = document.createElement('style');
  style.id = 'alba-bg-fix-style';
  style.textContent = `
    /* Применяем только в Safari/iOS (webkit-особенность) */
    @supports (-webkit-touch-callout: none) {
      html, body {
        max-width: 100%;
        overflow-x: hidden;
      }
      /* Перебиваем background-attachment: fixed из inline-стиля body */
      body {
        background-attachment: scroll !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureModelViewerLoaded() {
  const hasModelViewer = !!document.querySelector("model-viewer");
  if (!hasModelViewer) return;
  if (window.customElements && window.customElements.get("model-viewer")) return;
  const googleSrc = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.0.0/model-viewer.min.js";
  const fallbackSrc = "https://unpkg.com/@google/model-viewer@3.0.0/dist/model-viewer.min.js";
  const existingGoogleScript = document.querySelector(`script[src="${googleSrc}"]`);
  if (existingGoogleScript) return;
  const loadModelViewer = () => {
    if (window.customElements && window.customElements.get("model-viewer")) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = googleSrc;
    script.onerror = () => {
      if (window.customElements && window.customElements.get("model-viewer")) return;
      const fallbackScript = document.createElement("script");
      fallbackScript.type = "module";
      fallbackScript.src = fallbackSrc;
      document.head.appendChild(fallbackScript);
    };
    document.head.appendChild(script);
  };
  setTimeout(loadModelViewer, 800);
}

function createPreloaderLoader() {
  let loaded = false;
  return function ensurePreloaderScript() {
    if (loaded) return;
    if (document.querySelector("script[data-preloader-loader]")) { loaded = true; return; }
    const script = document.createElement("script");
    script.src = "/assets/js/preloader.js";
    script.defer = true;
    script.dataset.preloaderLoader = "true";
    document.head.appendChild(script);
    loaded = true;
  };
}

function createModelPreloaderLoader() {
  let loaded = false;
  return function ensureModelPreloader() {
    if (loaded) return;
    if (!document.querySelector('model-viewer')) return;
    if (document.querySelector('script[data-model-preloader]')) { loaded = true; return; }
    const script = document.createElement("script");
    script.src = '/assets/js/model-preloader.js';
    script.defer = true;
    script.dataset.modelPreloader = 'true';
    document.head.appendChild(script);
    loaded = true;
  };
}

function createModelNavLoader() {
  let loaded = false;
  return function ensureModelNavLoader() {
    if (loaded) return;
    if (document.querySelector('script[data-model-nav-loader]')) { loaded = true; return; }
    const script = document.createElement("script");
    script.src = '/assets/js/model-nav-loader.js';
    script.defer = true;
    script.dataset.modelNavLoader = 'true';
    document.head.appendChild(script);
    loaded = true;
  };
}

function markActiveNav() {
  const path = normalizePath(window.location.pathname || "/");
  const navLinks = document.querySelectorAll(".main-nav a");
  const isEnglish = (document.documentElement.lang || "").toLowerCase().startsWith("en") || path.startsWith("/eng/");
  const isProductPage = /\/product-[^/]+\.html$/i.test(path);
  let matched = false;

  const highlightShop = () => {
    const targetPath = normalizePath(isEnglish ? "/eng/shop.html" : "/shop.html");
    let found = false;
    navLinks.forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      try {
        const linkPath = normalizePath(new URL(href, window.location.origin).pathname);
        if (linkPath === targetPath) { a.classList.add("active"); found = true; }
      } catch (e) {
        // fallback below
      }
      if (!found) {
        const label = (a.textContent || "").trim().toUpperCase();
        if ((isEnglish && label.includes("SHOP")) || (!isEnglish && label.includes("MAĞAZA"))) {
          a.classList.add("active");
          found = true;
        }
      }
    });
    return found;
  };

  if (isProductPage) {
    matched = highlightShop();
  }
  navLinks.forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    try {
      const linkPath = normalizePath(new URL(href, window.location.origin).pathname);
      if (linkPath === path) { a.classList.add("active"); matched = true; }
    } catch (e) {
      if (href && path.endsWith(href)) { a.classList.add("active"); matched = true; }
    }
  });
  if (!matched) {
    navLinks.forEach((a) => {
      const text = (a.textContent || "").trim().toUpperCase();
      if (text.includes("ATLAS")) a.classList.add("active");
    });
  }
}

function normalizePath(p) {
  if (!p || p === "/") return "/index.html";
  if (!p.endsWith(".html") && !p.endsWith("/")) return p + "/";
  return p;
}

function setupLangSwitch() {
  const path = window.location.pathname || "/";
  const isEn = path.startsWith("/eng/");
  const currentLang = isEn ? "en" : "tr";
  const container = document.querySelector(".top-lang-switch");
  if (!container) return;
  container.querySelectorAll("[data-lang]").forEach((btn) => {
    const lang = btn.getAttribute("data-lang");
    btn.classList.toggle("active", lang === currentLang);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (lang === currentLang) return;
      const targetPath = lang === "en" ? toEnPath(path) : toTrPath(path);
      window.location.href = targetPath;
    });
  });
}

function toEnPath(path) {
  path = normalizePath(path);
  if (path.startsWith("/eng/")) return path;
  if (path === "/index.html") return "/eng/index.html";
  return "/eng" + (path.startsWith("/") ? path : "/" + path);
}

function toTrPath(path) {
  path = normalizePath(path);
  if (!path.startsWith("/eng/")) return path;
  return path.replace(/^\/eng/, "") || "/index.html";
}

function enhanceFooter(root) {
  injectFooterStyles();
  const footer = root.querySelector("footer");
  if (!footer || footer.classList.contains("alba-footer-v5")) return;
  footer.classList.add("alba-footer-v5");
  const allowCallSquare = /\/hizmetler(\.html)?\/?$/i.test(window.location.pathname || "");
  if (!allowCallSquare) { footer.querySelectorAll(".alba-call-square").forEach((el) => el.remove()); }
  const socials = footer.querySelector(".social-icons") || footer.querySelector(".footer-socials") || footer.querySelector("[data-socials]");
  if (socials) socials.classList.add("alba-footer-socials");
  const addressContainer = footer.querySelector(".footer-actions") || footer.querySelector(".footer-right") || footer.querySelector(".footer-address") || footer.querySelector(".footer-contact") || footer.querySelector("[data-footer-address]");
  if (!addressContainer) return;
  const rawAddrText = (addressContainer.innerText || "").trim();
  if (!rawAddrText) return;
  const isEnglish = window.location.pathname.startsWith('/eng/');
  const headOfficeRegex = isEnglish ? /Head Office/i : /Merkez Ofis/i;
  const branchOfficeRegex = isEnglish ? /Branch Office/i : /Adana Şube/i;
  const phoneHint = isEnglish ? 'Tap to call' : 'Aramak için dokunun';
  const emailHint = isEnglish ? 'Write to us' : 'Bize yazın';
  const mapHint = isEnglish ? 'Tap to open map' : 'Haritayı açmak için докунун';
  const merkezBlock = extractSection(rawAddrText, headOfficeRegex, branchOfficeRegex);
  const adanaBlock = extractSection(rawAddrText, branchOfficeRegex, null);
  const mailAnchors = footer.querySelectorAll('a[href^="mailto:"]');
  mailAnchors.forEach((el) => el.remove());
  const contactPanel = document.createElement('div');
  contactPanel.className = 'alba-footer-contact-panel';
  const phoneBtn = document.createElement('a');
  phoneBtn.className = 'alba-footer-action';
  phoneBtn.href = 'tel:+905387781018';
  phoneBtn.innerHTML = `<div class="action-row"><span class="action-icon">☎</span><span class="action-text">+90 538 778 10 18</span></div><div class="action-hint alba-blink">${phoneHint}</div>`;
  contactPanel.appendChild(phoneBtn);
  const emailBtn = document.createElement('a');
  emailBtn.className = 'alba-footer-action';
  emailBtn.href = 'mailto:hello@albaspace.com.tr';
  emailBtn.innerHTML = `<div class="action-row"><span class="action-icon">✉</span><span class="action-text">hello@albaspace.com.tr</span></div><div class="action-hint alba-blink">${emailHint}</div>`;
  contactPanel.appendChild(emailBtn);
  const map1 = buildMapButton(merkezBlock, mapHint);
  const map2 = buildMapButton(adanaBlock, mapHint);
  if (map1) contactPanel.appendChild(map1);
  if (map2) contactPanel.appendChild(map2);
  addressContainer.innerHTML = '';
  addressContainer.style.display = 'flex';
  addressContainer.style.flexDirection = 'column';
  addressContainer.style.alignItems = 'center';
  addressContainer.style.justifyContent = 'center';
  addressContainer.style.width = '100%';
  addressContainer.style.margin = '0 auto';
  addressContainer.appendChild(contactPanel);
}

function buildMapButton(blockText, hint) {
  if (!blockText) return null;
  const lines = blockText.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return null;
  const title = lines[0];
  const addressLines = lines.slice(1).filter((l) => !/(\+?\s*\d[\d\s()\-]{7,}\d)/.test(l));
  const address = addressLines.join(', ').replace(/\s+/g, ' ').trim();
  if (!address) return null;
  const a = document.createElement('a');
  a.className = 'alba-footer-action';
  a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  a.target = '_blank';
  a.rel = 'noopener';
  a.innerHTML = `<div class="action-row"><span class="action-icon">📍</span><span class="action-text">${escapeHtml(title)}</span></div><div class="map-address">${escapeHtml(address)}</div><div class="action-hint alba-blink">${escapeHtml(hint)}</div>`;
  return a;
}

function extractSection(text, startRegex, beforeRegex) {
  if (!text) return "";
  const start = text.search(startRegex);
  if (start === -1) return "";
  const sliced = text.slice(start);
  if (!beforeRegex) return sliced.trim();
  const end = sliced.search(beforeRegex);
  if (end === -1) return sliced.trim();
  return sliced.slice(0, end).trim();
}

function escapeHtml(str) {
  return String(str || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function injectFooterStyles() {
  if (document.getElementById("alba-footer-style-v5")) return;
  const s = document.createElement("style");
  s.id = "alba-footer-style-v5";
  s.textContent = `
    .alba-footer-contact-panel { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 20px; }
    .alba-footer-action { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 12px; background: rgba(15,23,42,0.88); border: 1px solid rgba(148,163,184,0.45); color: #e5e7eb; text-decoration: none; width: 100%; max-width: 360px; box-shadow: 0 16px 40px rgba(15,23,42,0.8); transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
    .alba-footer-action:hover { transform: translateY(-1px); box-shadow: 0 20px 55px rgba(15,23,42,0.95); border-color: rgba(56,189,248,0.8); background: radial-gradient(circle at top, rgba(15,23,42,1), rgba(8,47,73,0.96)); }
    .action-row { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
    .action-icon { font-size: 18px; }
    .action-text { letter-spacing: 0.01em; }
    .map-address { margin-top: 6px; font-size: 13px; color: #cbd5f5; text-align: center; line-height: 1.35; }
    .action-hint { margin-top: 6px; font-size: 12px; color: #60a5fa; }
    .alba-blink { animation: albaBlink 1.6s ease-in-out infinite; }
    @keyframes albaBlink { 0%, 100% { opacity: 1; transform: translateY(0); } 50% { opacity: 0.4; transform: translateY(-1px); } }
  `;
  document.head.appendChild(s);
}

function getAlbamenSessionId() {
  let id = localStorage.getItem('albamen_session_id');
  if (!id) {
    if (window.crypto && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = 'sess-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }
    localStorage.setItem('albamen_session_id', id);
  }
  return id;
}


function getAlbamenIdentity() {
  return {
    sessionId: getAlbamenSessionId(),
    name: localStorage.getItem('albamen_user_name') || null,
    age: localStorage.getItem('albamen_user_age') || null,
  };
}



