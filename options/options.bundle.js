(() => {
  // src/utils/storage.js
  var DEFAULT_SETTINGS = {
    // Summary language requested from Gemini ('de', 'en', 'auto')
    summaryLang: "de",
    // Voice selection (empty string means auto-select best Google voice for preferred language)
    voiceName: "",
    // Preferred TTS language ('de-DE' by default, or 'en-US', 'auto', etc.)
    lang: "de-DE",
    // Speech rate: 0.5 to 2.0 (1.0 = normal)
    rate: 1,
    // Speech pitch: 0.5 to 1.5 (1.0 = normal)
    pitch: 1,
    // Speech volume: 0.0 to 1.0
    volume: 1,
    // Automatically pause YouTube video while TTS is reading summary
    autoPauseVideo: true,
    // Resume YouTube video when TTS completes or is stopped
    resumeVideoAfterTTS: false,
    // Show in-page floating summary button next to YouTube action buttons
    showInPageButton: true,
    // Strip timestamps like (0:47-2:33) from audio output for fluent speech
    stripTimestamps: true,
    // Optional Google Cloud Text-to-Speech API key for WaveNet/Neural2 voices
    cloudTtsApiKey: "",
    cloudTtsVoice: "de-DE-Neural2-B",
    useCloudTts: false
  };
  async function getSettings(chromeInstance = typeof chrome !== "undefined" ? chrome : null) {
    if (!chromeInstance?.storage?.sync) {
      if (typeof localStorage !== "undefined") {
        try {
          const stored = localStorage.getItem("yt_gemini_tts_settings");
          return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
        } catch {
          return { ...DEFAULT_SETTINGS };
        }
      }
      return { ...DEFAULT_SETTINGS };
    }
    return new Promise((resolve) => {
      chromeInstance.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        if (chromeInstance.runtime?.lastError) {
          console.warn("[YT-Gemini-TTS] Storage get error:", chromeInstance.runtime.lastError);
          resolve({ ...DEFAULT_SETTINGS });
        } else {
          resolve({ ...DEFAULT_SETTINGS, ...items });
        }
      });
    });
  }
  async function saveSettings(newSettings, chromeInstance = typeof chrome !== "undefined" ? chrome : null) {
    const current = await getSettings(chromeInstance);
    const updated = { ...current, ...newSettings };
    if (!chromeInstance?.storage?.sync) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("yt_gemini_tts_settings", JSON.stringify(updated));
      }
      return updated;
    }
    return new Promise((resolve, reject) => {
      chromeInstance.storage.sync.set(updated, () => {
        if (chromeInstance.runtime?.lastError) {
          reject(chromeInstance.runtime.lastError);
        } else {
          resolve(updated);
        }
      });
    });
  }
  async function resetSettings(chromeInstance = typeof chrome !== "undefined" ? chrome : null) {
    return saveSettings(DEFAULT_SETTINGS, chromeInstance);
  }

  // options/options.js
  document.addEventListener("DOMContentLoaded", async () => {
    const summaryLangSelect = document.getElementById("summary-lang-select");
    const voiceSelect = document.getElementById("voice-select");
    const langSelect = document.getElementById("lang-select");
    const rateSlider = document.getElementById("rate-slider");
    const rateValue = document.getElementById("rate-value");
    const pitchSlider = document.getElementById("pitch-slider");
    const pitchValue = document.getElementById("pitch-value");
    const volumeSlider = document.getElementById("volume-slider");
    const volumeValue = document.getElementById("volume-value");
    const autoPauseVideo = document.getElementById("auto-pause-video");
    const stripTimestamps = document.getElementById("strip-timestamps");
    const resumeVideo = document.getElementById("resume-video-after-tts");
    const showInPageBtn = document.getElementById("show-in-page-btn");
    const useCloudTts = document.getElementById("use-cloud-tts");
    const cloudTtsFields = document.getElementById("cloud-tts-fields");
    const cloudApiKey = document.getElementById("cloud-api-key");
    const cloudVoiceName = document.getElementById("cloud-voice-name");
    const btnTestVoice = document.getElementById("btn-test-voice");
    const btnSave = document.getElementById("btn-save");
    const btnReset = document.getElementById("btn-reset");
    const toast = document.getElementById("toast");
    await populateVoices();
    const settings = await getSettings();
    applySettingsToUI(settings);
    rateSlider.addEventListener("input", () => {
      rateValue.textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`;
    });
    pitchSlider.addEventListener("input", () => {
      pitchValue.textContent = `${parseFloat(pitchSlider.value).toFixed(1)}`;
    });
    volumeSlider.addEventListener("input", () => {
      volumeValue.textContent = `${Math.round(parseFloat(volumeSlider.value) * 100)}%`;
    });
    useCloudTts.addEventListener("change", () => {
      cloudTtsFields.style.display = useCloudTts.checked ? "block" : "none";
    });
    btnTestVoice.addEventListener("click", () => {
      testVoice();
    });
    btnSave.addEventListener("click", async () => {
      const newSettings = getSettingsFromUI();
      await saveSettings(newSettings);
      showToast("Einstellungen erfolgreich gespeichert!");
    });
    btnReset.addEventListener("click", async () => {
      if (confirm("M\xF6chtest du wirklich alle Einstellungen auf die Standardwerte zur\xFCcksetzen?")) {
        const reset = await resetSettings();
        applySettingsToUI(reset);
        showToast("Einstellungen auf Standard zur\xFCckgesetzt.");
      }
    });
    function applySettingsToUI(s) {
      if (summaryLangSelect) summaryLangSelect.value = s.summaryLang || "de";
      if (s.voiceName) voiceSelect.value = s.voiceName;
      if (s.lang) langSelect.value = s.lang || "de-DE";
      rateSlider.value = s.rate || 1;
      rateValue.textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`;
      pitchSlider.value = s.pitch || 1;
      pitchValue.textContent = `${parseFloat(pitchSlider.value).toFixed(1)}`;
      volumeSlider.value = s.volume ?? 1;
      volumeValue.textContent = `${Math.round(parseFloat(volumeSlider.value) * 100)}%`;
      autoPauseVideo.checked = Boolean(s.autoPauseVideo);
      if (stripTimestamps) stripTimestamps.checked = s.stripTimestamps !== false;
      resumeVideo.checked = Boolean(s.resumeVideoAfterTTS);
      showInPageBtn.checked = Boolean(s.showInPageButton);
      useCloudTts.checked = Boolean(s.useCloudTts);
      cloudTtsFields.style.display = s.useCloudTts ? "block" : "none";
      cloudApiKey.value = s.cloudTtsApiKey || "";
      if (s.cloudTtsVoice) cloudVoiceName.value = s.cloudTtsVoice;
    }
    function getSettingsFromUI() {
      return {
        summaryLang: summaryLangSelect ? summaryLangSelect.value : "de",
        voiceName: voiceSelect.value,
        lang: langSelect.value,
        rate: parseFloat(rateSlider.value),
        pitch: parseFloat(pitchSlider.value),
        volume: parseFloat(volumeSlider.value),
        autoPauseVideo: autoPauseVideo.checked,
        stripTimestamps: stripTimestamps ? stripTimestamps.checked : true,
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
          voiceSelect.innerHTML = '<option value="">(Automatisch \u2013 Beste Google-Stimme)</option>';
          const googleVoices = [];
          const otherVoices = [];
          for (const v of voices) {
            if (v.voiceName.toLowerCase().includes("google") || v.lang && v.lang.startsWith("de") || v.lang && v.lang.startsWith("en")) {
              googleVoices.push(v);
            } else {
              otherVoices.push(v);
            }
          }
          googleVoices.sort((a, b) => {
            const aIsGoogle = a.voiceName.toLowerCase().includes("google");
            const bIsGoogle = b.voiceName.toLowerCase().includes("google");
            if (aIsGoogle && !bIsGoogle) return -1;
            if (!aIsGoogle && bIsGoogle) return 1;
            return a.voiceName.localeCompare(b.voiceName);
          });
          if (googleVoices.length > 0) {
            const optgroupGoogle = document.createElement("optgroup");
            optgroupGoogle.label = "Empfohlene Google- & Systemsprachen";
            for (const v of googleVoices) {
              const opt = document.createElement("option");
              opt.value = v.voiceName;
              opt.textContent = `${v.voiceName} (${v.lang || "Standard"})`;
              optgroupGoogle.appendChild(opt);
            }
            voiceSelect.appendChild(optgroupGoogle);
          }
          if (otherVoices.length > 0) {
            const optgroupOther = document.createElement("optgroup");
            optgroupOther.label = "Weitere installierte Stimmen";
            for (const v of otherVoices) {
              const opt = document.createElement("option");
              opt.value = v.voiceName;
              opt.textContent = `${v.voiceName} (${v.lang || "unbekannt"})`;
              optgroupOther.appendChild(opt);
            }
            voiceSelect.appendChild(optgroupOther);
          }
          resolve();
        };
        if (typeof chrome !== "undefined" && chrome.tts?.getVoices) {
          chrome.tts.getVoices(handleVoices);
        } else if (typeof window !== "undefined" && window.speechSynthesis) {
          let v = window.speechSynthesis.getVoices();
          if (v && v.length > 0) {
            handleVoices(v.map((item) => ({ voiceName: item.name, lang: item.lang })));
          } else {
            window.speechSynthesis.onvoiceschanged = () => {
              v = window.speechSynthesis.getVoices();
              handleVoices(v.map((item) => ({ voiceName: item.name, lang: item.lang })));
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
      const lang = langSelect.value === "auto" ? "de-DE" : langSelect.value;
      const sampleText = lang.startsWith("en") ? "Hello! This is a test of the Google Text to Speech voice for YouTube Gemini summaries." : "Hallo! Dies ist eine Testausgabe der Google Text-to-Speech Sprachausgabe f\xFCr YouTube Gemini Zusammenfassungen.";
      if (typeof chrome !== "undefined" && chrome.tts?.speak) {
        chrome.tts.stop();
        chrome.tts.speak(sampleText, {
          voiceName: voiceName || void 0,
          lang,
          rate,
          pitch,
          volume
        });
      } else if (typeof window !== "undefined" && window.speechSynthesis) {
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
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2800);
    }
  });
})();
