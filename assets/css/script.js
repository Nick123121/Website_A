// URL вашего голосового Worker'а (замените на реальный!)
const VOICE_WORKER_URL = 'wss://divine-flower-a0ae.nncdedcg.workers.dev/voice'; // пример, укажите точный

let ws = null;
let mediaRecorder = null;
let stream = null;

//
// Кнопка вызова голосового чата
//
// Изначальный код искал кнопку по классу `.ai-call-btn`, однако в текущей
// реализации виджет кнопка имеет класс `ai-voice-btn`.  Чтобы поддержать
// оба варианта (старый и новый), выбираем сначала `.ai-voice-btn`, а если
// её нет, то используем `.ai-call-btn` для обратной совместимости.
const voiceBtn = document.querySelector('.ai-voice-btn') || document.querySelector('.ai-call-btn');
const voiceModal = document.querySelector('.ai-panel-voice'); // модальное окно
const avatarImg = voiceModal?.querySelector('.ai-chat-avatar-large img'); // аватар для свечения
const closeBtn = voiceModal?.querySelector('.ai-close-icon'); // кнопка закрытия (X)

if (voiceBtn && voiceModal) {
  voiceBtn.addEventListener('click', async () => {
    // Открываем модалку
    voiceModal.classList.add('ai-open');

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert('Mikrofon izni verilmedi. Lütfen izin verin.');
      voiceModal.classList.remove('ai-open');
      return;
    }

    ws = new WebSocket(VOICE_WORKER_URL);

    ws.onopen = () => {
      console.log('WebSocket bağlı — ses kaydı başlıyor');

      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };
      mediaRecorder.start(250); // низкая задержка
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(buffer => {
          const audioBlob = new Blob([buffer], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play();

          // Свечение аватара
          if (avatarImg) {
            avatarImg.classList.add('ai-glow');
            audio.onended = () => avatarImg.classList.remove('ai-glow');
          }
        });
      }
    };

    ws.onclose = ws.onerror = () => {
      console.log('WebSocket kapandı');
      stopRecording();
    };
  });
}

// Закрытие модалки
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    voiceModal.classList.remove('ai-open');
    if (ws) ws.close();
    stopRecording();
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (stream) stream.getTracks().forEach(t => t.stop());
}
