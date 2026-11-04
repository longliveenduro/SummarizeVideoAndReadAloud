import { DEFAULT_SETTINGS, getSettings, resetSettings, saveSettings } from '../src/utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const voiceSelect = document.getElementById('voice-select');
  const langSelect = document.getElementById('lang-select');
  const rateSlider = document.getElementById('rate-slider');
  const rateValue = document.getElementById('rate-value');
  const pitchSlider = document.getElementById('pitch-slider');
  const pitchValue = document.getElementById('pitch-value');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeValue = document.getElementById('volume-value');
  const autoPauseVideo = document.getElementById('auto-pause-video');
  const resumeVideo = document.getElementById('resume-video-after-tts');
  const showInPageBtn = document.getElementById('show-in-page-btn');
  const useCloudTts = document.getElementById('use-cloud-tts');
  const cloudTtsFields = document.getElementById('cloud-tts-fields');
  const cloudApiKey = document.getElementById('cloud-api-key');
  const cloudVoiceName = document.getElementById('cloud-voice-name');
  const btnTestVoice = document.getElementById('btn-test-voice');
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const toast = document.getElementById('toast');

  // Load voices and populate select
  await populateVoices();

  // Load existing settings
  const settings = await getSettings();
  applySettingsToUI(settings);

  // Slider change listeners
  rateSlider.addEventListener('input', () => {
    rateValue.textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`;
  });

  pitchSlider.addEventListener('input', () => {
    pitchValue.textContent = `${parseFloat(pitchSlider.value).toFixed(1)}`;
  });

  volumeSlider.addEventListener('input', () => {
    volumeValue.textContent = `${Math.round(parseFloat(volumeSlider.value) * 100)}%`;
  });

  useCloudTts.addEventListener('change', () => {
    cloudTtsFields.style.display = useCloudTts.checked ? 'block' : 'none';
  });

  // Test voice button
  btnTestVoice.addEventListener('click', () => {
    testVoice();
  });

  // Save settings
  btnSave.addEventListener('click', async () => {
    const newSettings = getSettingsFromUI();
    await saveSettings(newSettings);
    showToast('Einstellungen erfolgreich gespeichert!');
  });

  // Reset settings
  btnReset.addEventListener('click', async () => {
    if (confirm('Möchtest du wirklich alle Einstellungen auf die Standardwerte zurücksetzen?')) {
      const reset = await resetSettings();
      applySettingsToUI(reset);
      showToast('Einstellungen auf Standard zurückgesetzt.');
    }
  });

  function applySettingsToUI(s) {
    if (s.voiceName) voiceSelect.value = s.voiceName;
    if (s.lang) langSelect.value = s.lang;
    rateSlider.value = s.rate || 1.0;
    rateValue.textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`;
    pitchSlider.value = s.pitch || 1.0;
    pitchValue.textContent = `${parseFloat(pitchSlider.value).toFixed(1)}`;
    volumeSlider.value = s.volume ?? 1.0;
    volumeValue.textContent = `${Math.round(parseFloat(volumeSlider.value) * 100)}%`;
    autoPauseVideo.checked = Boolean(s.autoPauseVideo);
    resumeVideo.checked = Boolean(s.resumeVideoAfterTTS);
    showInPageBtn.checked = Boolean(s.showInPageButton);
    useCloudTts.checked = Boolean(s.useCloudTts);
    cloudTtsFields.style.display = s.useCloudTts ? 'block' : 'none';
    cloudApiKey.value = s.cloudTtsApiKey || '';
    if (s.cloudTtsVoice) cloudVoiceName.value = s.cloudTtsVoice;
  }

  function getSettingsFromUI() {
    return {
      voiceName: voiceSelect.value,
      lang: langSelect.value,
      rate: parseFloat(rateSlider.value),
      pitch: parseFloat(pitchSlider.value),
      volume: parseFloat(volumeSlider.value),
      autoPauseVideo: autoPauseVideo.checked,
      resumeVideoAfterTTS: resumeVideo.checked,
      showInPageButton: showInPageBtn.checked,
      useCloudTts: useCloudTts.checked,
      cloudTtsApiKey: cloudApiKey.value.trim(),
      cloudTtsVoice: cloudVoiceName.value
    };
  }

  async function populateVoices() {
    return new Promise((resolve) => {
      const handleVoices = (voices) => {
        // Clear except first default option
        voiceSelect.innerHTML = '<option value="">(Automatisch – Beste Google-Stimme)</option>';

        // Separate Google voices from other system voices
        const googleVoices = [];
        const otherVoices = [];

        for (const v of voices) {
          if (v.voiceName.toLowerCase().includes('google') || (v.lang && v.lang.startsWith('de')) || (v.lang && v.lang.startsWith('en'))) {
            googleVoices.push(v);
          } else {
            otherVoices.push(v);
          }
        }

        // Sort Google voices with German & English on top
        googleVoices.sort((a, b) => {
          const aIsGoogle = a.voiceName.toLowerCase().includes('google');
          const bIsGoogle = b.voiceName.toLowerCase().includes('google');
          if (aIsGoogle && !bIsGoogle) return -1;
          if (!aIsGoogle && bIsGoogle) return 1;
          return a.voiceName.localeCompare(b.voiceName);
        });

        if (googleVoices.length > 0) {
          const optgroupGoogle = document.createElement('optgroup');
          optgroupGoogle.label = 'Empfohlene Google- & Systemsprachen';
          for (const v of googleVoices) {
            const opt = document.createElement('option');
            opt.value = v.voiceName;
            opt.textContent = `${v.voiceName} (${v.lang || 'Standard'})`;
            optgroupGoogle.appendChild(opt);
          }
          voiceSelect.appendChild(optgroupGoogle);
        }

        if (otherVoices.length > 0) {
          const optgroupOther = document.createElement('optgroup');
          optgroupOther.label = 'Weitere installierte Stimmen';
          for (const v of otherVoices) {
            const opt = document.createElement('option');
            opt.value = v.voiceName;
            opt.textContent = `${v.voiceName} (${v.lang || 'unbekannt'})`;
            optgroupOther.appendChild(opt);
          }
          voiceSelect.appendChild(optgroupOther);
        }

        resolve();
      };

      if (typeof chrome !== 'undefined' && chrome.tts?.getVoices) {
        chrome.tts.getVoices(handleVoices);
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        let v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          handleVoices(v.map(item => ({ voiceName: item.name, lang: item.lang })));
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            v = window.speechSynthesis.getVoices();
            handleVoices(v.map(item => ({ voiceName: item.name, lang: item.lang })));
          };
        }
      } else {
        resolve();
      }
    });
  }

  function testVoice() {
    const voiceName = voiceSelect.value;
    const rate = parseFloat(rateSlider.value);
    const pitch = parseFloat(pitchSlider.value);
    const volume = parseFloat(volumeSlider.value);
    const lang = langSelect.value === 'auto' ? 'de-DE' : langSelect.value;

    const sampleText = lang.startsWith('en')
      ? 'Hello! This is a test of the Google Text to Speech voice for YouTube Gemini summaries.'
      : 'Hallo! Dies ist eine Testausgabe der Google Text-to-Speech Sprachausgabe für YouTube Gemini Zusammenfassungen.';

    if (typeof chrome !== 'undefined' && chrome.tts?.speak) {
      chrome.tts.stop();
      chrome.tts.speak(sampleText, {
        voiceName: voiceName || undefined,
        lang: lang,
        rate: rate,
        pitch: pitch,
        volume: volume
      });
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(sampleText);
      utter.lang = lang;
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = volume;
      window.speechSynthesis.speak(utter);
    }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
});

