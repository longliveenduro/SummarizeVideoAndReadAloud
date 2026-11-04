/**
 * Default configuration settings for the YouTube Gemini Summarizer & TTS extension.
 */
export const DEFAULT_SETTINGS = {
  // Voice selection (empty string means auto-select Google voice for current language)
  voiceName: '',
  // Preferred language ('auto', 'de-DE', 'en-US', etc.)
  lang: 'auto',
  // Speech rate: 0.5 to 2.0 (1.0 = normal)
  rate: 1.0,
  // Speech pitch: 0.5 to 1.5 (1.0 = normal)
  pitch: 1.0,
  // Speech volume: 0.0 to 1.0
  volume: 1.0,
  // Automatically pause YouTube video while TTS is reading summary
  autoPauseVideo: true,
  // Resume YouTube video when TTS completes or is stopped
  resumeVideoAfterTTS: false,
  // Show in-page floating summary button next to YouTube action buttons
  showInPageButton: true,
  // Optional Google Cloud Text-to-Speech API key for WaveNet/Neural2 voices
  cloudTtsApiKey: '',
  cloudTtsVoice: 'de-DE-Neural2-B',
  useCloudTts: false
};

/**
 * Loads settings from chrome.storage.sync (with fallback to local storage or defaults).
 * @param {typeof chrome} [chromeInstance] - Optional chrome API object for testing
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings(chromeInstance = (typeof chrome !== 'undefined' ? chrome : null)) {
  if (!chromeInstance?.storage?.sync) {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('yt_gemini_tts_settings');
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
        console.warn('[YT-Gemini-TTS] Storage get error:', chromeInstance.runtime.lastError);
        resolve({ ...DEFAULT_SETTINGS });
      } else {
        resolve({ ...DEFAULT_SETTINGS, ...items });
      }
    });
  });
}

/**
 * Saves partial or full settings to chrome.storage.sync.
 * @param {Partial<typeof DEFAULT_SETTINGS>} newSettings
 * @param {typeof chrome} [chromeInstance] - Optional chrome API object for testing
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function saveSettings(newSettings, chromeInstance = (typeof chrome !== 'undefined' ? chrome : null)) {
  const current = await getSettings(chromeInstance);
  const updated = { ...current, ...newSettings };

  if (!chromeInstance?.storage?.sync) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('yt_gemini_tts_settings', JSON.stringify(updated));
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

/**
 * Resets settings to default values.
 * @param {typeof chrome} [chromeInstance]
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function resetSettings(chromeInstance = (typeof chrome !== 'undefined' ? chrome : null)) {
  return saveSettings(DEFAULT_SETTINGS, chromeInstance);
}

