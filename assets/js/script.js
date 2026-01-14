// HTTPS endpoint of the Cloudflare Worker that handles text replies
const VOICE_WORKER_URL = 'https://albamen-voice.nncdecdgc.workers.dev';

let recognition = null;
let isListening = false;

// Попытка получить общую "личность" Albamen (sessionId + name/age)
function getVoiceIdentity() {
  // Сначала пробуем то, что положили из include.js
  if (window.albamenVoiceIdentity) {
    return window.albamenVoiceIdentity;
  }

  // Потом — общий хелпер, если доступен
  if (typeof window.getAlbamenIdentity === 'function') {
    return window.getAlbamenIdentity();
  }

  // Фолбэк: читаем напрямую из localStorage
  let sessionId = localStorage.getItem('albamen_session_id');
  if (!sessionId) {
    if (window.crypto && crypto.randomUUID) {
      sessionId = crypto.randomUUID();
    } else {
      sessionId = 'sess-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }
    localStorage.setItem('albamen_session_id', sessionId);
  }

  return {
    sessionId,
    name: localStorage.getItem('albamen_user_name') || null,
    age: localStorage.getItem('albamen_user_age') || null,
  };
}

// Обновление глобальной identity после того, как воркер прислал новое имя/возраст
function refreshVoiceIdentity() {
  if (typeof window.getAlbamenIdentity === 'function') {
    window.albamenVoiceIdentity = window.getAlbamenIdentity();
  } else {
    window.albamenVoiceIdentity = {
      sessionId: localStorage.getItem('albamen_session_id'),
      name: localStorage.getItem('albamen_user_name'),
      age: localStorage.getItem('albamen_user_age'),
    };
  }
}

//
// Кнопка вызова голосового чата — инициализация обработчиков динамически
//
function initVoiceHandlers() {
  const voiceButtons = document.querySelectorAll('#ai-voice-btn, #ai-voice-btn-panel, .ai-voice-btn, .ai-call-btn');
  const voiceModal = document.querySelector('.ai-panel-voice'); // модальное окно (если есть)
  const chatPanel = document.querySelector('.ai-panel-global');
  const avatarImg = (voiceModal || chatPanel)?.querySelector('.ai-chat-avatar-large img'); // аватар для свечения
  const closeBtn = voiceModal?.querySelector('.ai-close-icon') || chatPanel?.querySelector('.ai-close-icon'); // кнопка закрытия (X)
  const statusEl = document.getElementById('voice-status-text');
  const waveEl = document.getElementById('voice-wave');
  const stopBtn = document.getElementById('voice-stop-btn');
  const inlineControls = document.getElementById('voice-inline-controls');

  function showVoiceUi(show) {
    if (statusEl) statusEl.style.display = show ? 'block' : 'none';
    inlineControls?.classList.toggle('hidden', !show);
  }

  function setStatus(text, ensureVisible = true) {
    if (statusEl) {
      statusEl.textContent = text;
      if (ensureVisible) statusEl.style.display = 'block';
    }
  }

  function toggleListening(on) {
    isListening = on;
    waveEl?.classList.toggle('hidden', !on);
    stopBtn?.classList.toggle('hidden', !on);
  }

  async function sendTextToWorker(transcript) {
    const identity = getVoiceIdentity();
    try {
      const response = await fetch(VOICE_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          sessionId: identity.sessionId,
          savedName: identity.name,
          savedAge: identity.age,
        }),
      });

      const data = await response.json();

      // Сохраняем имя/возраст, если пришли
      if (data.saveName && typeof data.saveName === 'string') {
        localStorage.setItem('albamen_user_name', data.saveName.trim());
      }
      if (data.saveAge && typeof data.saveAge === 'string') {
        localStorage.setItem('albamen_user_age', data.saveAge.trim());
      }
      refreshVoiceIdentity();

      const reply = (data.reply || '').trim();
      if (reply) speakReply(reply);
      setStatus(reply || 'Albamen şu anda cevap veremiyor.');
    } catch (err) {
      console.error('Voice worker error:', err);
      setStatus('Bağlantı hatası, lütfen tekrar deneyin.');
    }
  }

  function speakReply(text) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.onstart = () => {
      if (avatarImg) avatarImg.classList.add('ai-glow');
    };
    utterance.onend = () => {
      if (avatarImg) avatarImg.classList.remove('ai-glow');
    };
    window.speechSynthesis.speak(utterance);
  }

  // Кнопки могут появляться динамически — если есть, навешиваем обработчики
  if (voiceButtons.length && (voiceModal || chatPanel)) {
    voiceButtons.forEach((btn) => btn.addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setStatus('Ses desteği yok');
        showVoiceUi(true);
        return;
      }

      if (voiceModal) {
        voiceModal.classList.add('ai-open');
      } else if (chatPanel) {
        chatPanel.classList.add('ai-open');
      }
      showVoiceUi(true);
      if (recognition) recognition.stop();

      recognition = new SpeechRecognition();
      recognition.lang = 'tr-TR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        toggleListening(true);
        setStatus('Dinliyorum...');
      };

      recognition.onerror = (event) => {
        toggleListening(false);
        setStatus(event.error === 'no-speech' ? 'Ses algılanmadı' : 'Ses hatası');
      };

      recognition.onresult = (event) => {
        toggleListening(false);
        const transcript = event.results[0][0].transcript;
        setStatus('Albamen düşünüyor...');
        sendTextToWorker(transcript);
      };

      recognition.onend = () => {
        toggleListening(false);
      };

      recognition.start();
    }));
  }

  // Закрытие модалки — навешиваем безопасно
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (voiceModal) voiceModal.classList.remove('ai-open');
      if (chatPanel) chatPanel.classList.remove('ai-open');
      if (recognition && isListening) recognition.stop();
      toggleListening(false);
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (recognition && isListening) recognition.stop();
      toggleListening(false);
      setStatus('Durduruldu');
    });
  }
}

// observe DOM to initialize when widget is injected dynamically
const voiceObserver = new MutationObserver((records, obs) => {
  if (document.querySelector('.ai-panel-voice') || document.querySelector('.ai-panel-global')) {
    initVoiceHandlers();
    obs.disconnect();
  }
});
voiceObserver.observe(document.body, { childList: true, subtree: true });

// Попытка инициализации сразу (если скрип загружен после инъекции)
try { initVoiceHandlers(); } catch (e) { /* silent */ }
