// HTTPS endpoint of the Cloudflare Worker that handles text replies
const VOICE_WORKER_URL = 'https://albamen-voice.nncdecdgc.workers.dev';
const VOICE_WORKER_TIMEOUT = 15000; // 15 секунд timeout
const VOICE_DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || true; // Включаем debug всегда

let recognition = null;
let isListening = false;
let currentWorkerRequest = null; // Для отслеживания текущего запроса

// === Логирование ===
function voiceLog(message, data = null) {
  if (VOICE_DEBUG) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Albamen Voice ${timestamp}]`, message, data || '');
  }
}

function voiceError(message, error = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.error(`[Albamen Voice ERROR ${timestamp}]`, message, error || '');
}

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

  voiceLog('Identity retrieved:', { sessionId: sessionId.substring(0, 8) + '...' });

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
  voiceLog('Identity refreshed after worker response');
}

//
// Кнопка вызова голосового чата — инициализация обработчиков динамически
//
function initVoiceHandlers() {
  voiceLog('Initializing voice handlers...');
  
  const voiceButtons = document.querySelectorAll('#ai-voice-btn, #ai-voice-btn-panel, .ai-voice-btn, .ai-call-btn');
  const voiceModal = document.querySelector('.ai-panel-voice'); // модальное окно (если есть)
  const chatPanel = document.querySelector('.ai-panel-global');
  const avatarImg = (voiceModal || chatPanel)?.querySelector('.ai-chat-avatar-large img'); // аватар для свечения
  const closeBtn = voiceModal?.querySelector('.ai-close-icon') || chatPanel?.querySelector('.ai-close-icon'); // кнопка закрытия (X)
  const statusEl = document.getElementById('voice-status-text');
  const waveEl = document.getElementById('voice-wave');
  const stopBtn = document.getElementById('voice-stop-btn');
  const inlineControls = document.getElementById('voice-inline-controls');

  voiceLog('Elements found:', {
    voiceButtons: voiceButtons.length,
    voiceModal: !!voiceModal,
    chatPanel: !!chatPanel,
    statusEl: !!statusEl,
    waveEl: !!waveEl,
  });

  function showVoiceUi(show) {
    if (statusEl) statusEl.style.display = show ? 'block' : 'none';
    inlineControls?.classList.toggle('hidden', !show);
  }

  function setStatus(text, ensureVisible = true) {
    if (statusEl) {
      statusEl.textContent = text;
      if (ensureVisible) statusEl.style.display = 'block';
      voiceLog('Status updated:', text);
    }
  }

  function toggleListening(on) {
    isListening = on;
    waveEl?.classList.toggle('hidden', !on);
    stopBtn?.classList.toggle('hidden', !on);
  }

  async function sendTextToWorker(transcript) {
    const identity = getVoiceIdentity();
    voiceLog('Sending transcript to worker:', transcript.substring(0, 50) + '...');
    
    try {
      setStatus('Albamen düşünüyor... ⏳');
      
      // Создаем AbortController для timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        voiceLog('Request timeout - aborting');
        controller.abort();
      }, VOICE_WORKER_TIMEOUT);
      
      const response = await fetch(VOICE_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          sessionId: identity.sessionId,
          savedName: identity.name,
          savedAge: identity.age,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        voiceError('Worker returned non-ok status:', response.status);
        setStatus('Bağlantı hatası (' + response.status + '). Lütfen tekrar deneyin.');
        return;
      }

      const data = await response.json();
      voiceLog('Worker response received:', data);

      // Сохраняем имя/возраст, если пришли
      if (data.saveName && typeof data.saveName === 'string') {
        const trimmedName = data.saveName.trim();
        localStorage.setItem('albamen_user_name', trimmedName);
        voiceLog('Saved user name:', trimmedName);
      }
      if (data.saveAge && typeof data.saveAge === 'string') {
        const trimmedAge = data.saveAge.trim();
        localStorage.setItem('albamen_user_age', trimmedAge);
        voiceLog('Saved user age:', trimmedAge);
      }
      refreshVoiceIdentity();

      const reply = (data.reply || '').trim();
      if (reply) {
        voiceLog('Speaking reply:', reply.substring(0, 50) + '...');
        speakReply(reply);
        setStatus(reply);
      } else {
        voiceLog('Worker returned empty reply');
        setStatus('Albamen şu anda cevap veremiyor. Lütfen tekrar deneyin.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        voiceError('Request timeout - worker did not respond in time');
        setStatus('⏱️ Albamen cevap vermedi. İnternet bağlantınızı kontrol edin.');
      } else {
        voiceError('Network error:', err.message);
        setStatus('❌ Bağlantı hatası: ' + (err.message || 'Bilinmeyen hata'));
      }
    }
  }

  function speakReply(text) {
    voiceLog('Speaking text:', text.substring(0, 50) + '...');
    
    if (!('speechSynthesis' in window)) {
      voiceError('SpeechSynthesis API not available');
      return;
    }

    try {
      // Отменяем предыдущее воспроизведение
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.95; // Слегка замедленная речь для лучшего понимания
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        voiceLog('Speech synthesis started');
        if (avatarImg) {
          avatarImg.classList.add('ai-glow');
          voiceLog('Avatar glow enabled');
        }
      };

      utterance.onend = () => {
        voiceLog('Speech synthesis ended');
        if (avatarImg) {
          avatarImg.classList.remove('ai-glow');
          voiceLog('Avatar glow disabled');
        }
      };

      utterance.onerror = (event) => {
        voiceError('Speech synthesis error:', event.error);
        if (avatarImg) avatarImg.classList.remove('ai-glow');
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      voiceError('Failed to speak reply:', err);
    }
  }

  // Кнопки могут появляться динамически — если есть, навешиваем обработчики
  if (voiceButtons.length && (voiceModal || chatPanel)) {
    voiceLog('Attaching voice button listeners (' + voiceButtons.length + ' buttons)');
    voiceButtons.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        voiceLog('Voice button clicked (index ' + idx + ')');
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          voiceError('SpeechRecognition API not supported');
          setStatus('❌ Tarayıcınız ses tanımadı desteklemiyor');
          showVoiceUi(true);
          return;
        }

        // Открываем модалку
        if (voiceModal) {
          voiceModal.classList.add('ai-open');
          voiceLog('Opened voice modal');
        } else if (chatPanel) {
          chatPanel.classList.add('ai-open');
          voiceLog('Opened chat panel');
        }
        
        showVoiceUi(true);
        
        // Останавливаем предыдущее распознавание
        if (recognition && isListening) {
          recognition.stop();
          voiceLog('Stopped previous recognition');
        }

        try {
          recognition = new SpeechRecognition();
          recognition.lang = 'tr-TR';
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          voiceLog('Created new SpeechRecognition instance');

          recognition.onstart = () => {
            voiceLog('Speech recognition started');
            toggleListening(true);
            setStatus('🎤 Dinliyorum...');
          };

          recognition.onerror = (event) => {
            voiceLog('Speech recognition error:', event.error);
            toggleListening(false);
            
            let errorMsg = 'Ses hatası';
            switch (event.error) {
              case 'no-speech':
                errorMsg = '🔇 Ses algılanmadı. Lütfen konuşun.';
                break;
              case 'network':
                errorMsg = '❌ Ağ hatası. İnternet bağlantısını kontrol edin.';
                break;
              case 'audio-capture':
                errorMsg = '🎤 Mikrofon sorunu. İzinleri kontrol edin.';
                break;
              case 'not-allowed':
                errorMsg = '🔒 Mikrofon izni reddedildi.';
                break;
              default:
                errorMsg = '⚠️ Hata: ' + event.error;
            }
            setStatus(errorMsg);
          };

          recognition.onresult = (event) => {
            voiceLog('Speech recognition result:', event.results.length + ' result(s)');
            toggleListening(false);
            
            if (!event.results || event.results.length === 0) {
              voiceError('No results from speech recognition');
              setStatus('⚠️ Sonuç alınamadı. Tekrar deneyin.');
              return;
            }
            
            const transcript = event.results[0][0].transcript;
            voiceLog('Transcript:', transcript);
            
            if (!transcript || transcript.trim() === '') {
              setStatus('⚠️ Boş metin. Tekrar deneyin.');
              return;
            }
            
            setStatus('🤔 Albamen düşünüyor...');
            sendTextToWorker(transcript);
          };

          recognition.onend = () => {
            voiceLog('Speech recognition ended');
            toggleListening(false);
          };

          recognition.start();
          voiceLog('Speech recognition started successfully');
        } catch (err) {
          voiceError('Failed to create SpeechRecognition:', err);
          setStatus('❌ Ses tanıma hatası: ' + err.message);
          toggleListening(false);
        }
      });
    });
  } else {
    voiceLog('Warning: Voice buttons not properly configured', {
      buttonsFound: voiceButtons.length,
      hasModal: !!voiceModal,
      hasChatPanel: !!chatPanel,
    });
  }

  // Закрытие модалки — навешиваем безопасно
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      voiceLog('Close button clicked');
      if (voiceModal) voiceModal.classList.remove('ai-open');
      if (chatPanel) chatPanel.classList.remove('ai-open');
      if (recognition && isListening) {
        recognition.stop();
        voiceLog('Recognition stopped on close');
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        voiceLog('Speech synthesis cancelled on close');
      }
      toggleListening(false);
      if (avatarImg) avatarImg.classList.remove('ai-glow');
    });
    voiceLog('Close button listener attached');
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      voiceLog('Stop button clicked');
      if (recognition && isListening) recognition.stop();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      toggleListening(false);
      setStatus('⏸️ Durduruldu');
      if (avatarImg) avatarImg.classList.remove('ai-glow');
    });
    voiceLog('Stop button listener attached');
  }

  voiceLog('Voice handlers initialized successfully');
}

// observe DOM to initialize when widget is injected dynamically
let voiceHandlersInitialized = false;

const voiceObserver = new MutationObserver((records, obs) => {
  if (voiceHandlersInitialized) return; // Инициализируем только один раз
  
  const voicePanel = document.querySelector('.ai-panel-voice');
  const chatPanel = document.querySelector('.ai-panel-global');
  
  if (voicePanel || chatPanel) {
    voiceLog('Voice widgets detected in DOM - initializing handlers');
    try {
      initVoiceHandlers();
      voiceHandlersInitialized = true;
      obs.disconnect();
    } catch (err) {
      voiceError('Failed to initialize voice handlers:', err);
    }
  }
});

voiceObserver.observe(document.body, { childList: true, subtree: true });
voiceLog('DOM observer started - waiting for voice widgets');

// Попытка инициализации сразу (если скрип загружен после инъекции)
if (document.querySelector('.ai-panel-voice') || document.querySelector('.ai-panel-global')) {
  voiceLog('Voice widgets already present - initializing immediately');
  try {
    initVoiceHandlers();
    voiceHandlersInitialized = true;
  } catch (err) {
    voiceError('Failed to initialize voice handlers:', err);
  }
}

// Отключаем observer если обработчики не инициализировались за разумное время
setTimeout(() => {
  if (!voiceHandlersInitialized) {
    voiceLog('Warning: Voice handlers not initialized after 10 seconds');
  }
}, 10000);
