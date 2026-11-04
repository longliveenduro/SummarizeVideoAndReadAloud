import { chunkTextForTTS, detectLanguage, sanitizeForSpeech } from './text-sanitizer.js';

export class SpeechEngine {
  constructor(options = {}) {
    this.chromeInstance = options.chromeInstance || (typeof chrome !== 'undefined' ? chrome : null);
    this.settings = options.settings || {};
    this.onStateChange = options.onStateChange || (() => {});
    this.onProgress = options.onProgress || (() => {});

    this.chunks = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.audioElement = null; // Used if Google Cloud TTS audio is streamed
  }

  /**
   * Updates settings.
   * @param {object} newSettings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Speaks the provided summary text.
   * @param {string} rawText
   * @returns {Promise<void>}
   */
  async speak(rawText) {
    this.stop();

    if (!rawText || !rawText.trim()) return;

    // Detect language or use user-configured preference
    const detectedLang = detectLanguage(rawText);
    const effectiveLang = this.settings.lang && this.settings.lang !== 'auto'
      ? this.settings.lang
      : (detectedLang === 'en' ? 'en-US' : 'de-DE');

    // Clean text and prepare chunks
    const cleaned = sanitizeForSpeech(rawText, effectiveLang.startsWith('en') ? 'en' : 'de');
    this.chunks = chunkTextForTTS(cleaned, 180);
    this.currentIndex = 0;

    if (this.chunks.length === 0) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.onStateChange({ isPlaying: true, isPaused: false });

    // Check if Cloud TTS is enabled with API key
    if (this.settings.useCloudTts && this.settings.cloudTtsApiKey) {
      try {
        await this.speakWithCloudTTS(cleaned, effectiveLang);
        return;
      } catch (err) {
        console.warn('[YT-Gemini-TTS] Cloud TTS error, falling back to local Google TTS:', err);
      }
    }

    // Play chunks sequentially via chrome.tts or Web Speech API
    await this.playNextChunk(effectiveLang);
  }

  /**
   * Plays the next chunk in sequence.
   * @param {string} lang
   */
  async playNextChunk(lang) {
    if (!this.isPlaying || this.isPaused) return;

    if (this.currentIndex >= this.chunks.length) {
      this.stop();
      this.onStateChange({ isPlaying: false, isPaused: false, finished: true });
      return;
    }

    const chunk = this.chunks[this.currentIndex];
    const progressPercent = Math.round(((this.currentIndex + 1) / this.chunks.length) * 100);
    this.onProgress({
      currentIndex: this.currentIndex,
      totalChunks: this.chunks.length,
      percent: progressPercent,
      text: chunk
    });

    const speakOptions = {
      text: chunk,
      lang: lang,
      rate: Number(this.settings.rate) || 1.0,
      pitch: Number(this.settings.pitch) || 1.0,
      volume: Number(this.settings.volume) || 1.0,
      voiceName: this.settings.voiceName || undefined
    };

    // If chrome.runtime messaging is available (Content Script talking to Background)
    if (this.chromeInstance?.runtime?.sendMessage) {
      this.chromeInstance.runtime.sendMessage(
        { action: 'TTS_SPEAK', payload: speakOptions },
        (response) => {
          if (response?.error) {
            console.warn('[YT-Gemini-TTS] Background TTS error:', response.error);
            this.fallbackWebSpeech(chunk, lang);
          } else {
            this.currentIndex++;
            if (this.isPlaying && !this.isPaused) {
              this.playNextChunk(lang);
            }
          }
        }
      );
    } else {
      // Direct Web Speech API fallback (useful in tests or when background unavailable)
      this.fallbackWebSpeech(chunk, lang);
    }
  }

  /**
   * Web Speech API fallback.
   * @param {string} text
   * @param {string} lang
   */
  fallbackWebSpeech(text, lang) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.stop();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = Number(this.settings.rate) || 1.0;
    utterance.pitch = Number(this.settings.pitch) || 1.0;
    utterance.volume = Number(this.settings.volume) || 1.0;

    utterance.onend = () => {
      this.currentIndex++;
      if (this.isPlaying && !this.isPaused) {
        this.playNextChunk(lang);
      }
    };

    utterance.onerror = (e) => {
      console.warn('[YT-Gemini-TTS] WebSpeech error:', e);
      this.stop();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Google Cloud Text-to-Speech API playback.
   * @param {string} text
   * @param {string} lang
   */
  async speakWithCloudTTS(text, lang) {
    const apiKey = this.settings.cloudTtsApiKey;
    const voiceName = this.settings.cloudTtsVoice || (lang.startsWith('en') ? 'en-US-Journey-F' : 'de-DE-Neural2-B');

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: lang,
          name: voiceName
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: Number(this.settings.rate) || 1.0,
          pitch: (Number(this.settings.pitch) - 1.0) * 10 || 0
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google Cloud TTS failed: ${response.statusText}`);
    }

    const data = await response.json();
    const audioSrc = `data:audio/mp3;base64,${data.audioContent}`;

    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.audioElement = new Audio(audioSrc);

    this.audioElement.onended = () => {
      this.stop();
      this.onStateChange({ isPlaying: false, isPaused: false, finished: true });
    };

    await this.audioElement.play();
  }

  /**
   * Pauses playback.
   */
  pause() {
    if (!this.isPlaying) return;
    this.isPaused = true;

    if (this.audioElement) {
      this.audioElement.pause();
    } else if (this.chromeInstance?.runtime?.sendMessage) {
      this.chromeInstance.runtime.sendMessage({ action: 'TTS_PAUSE' });
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }

    this.onStateChange({ isPlaying: true, isPaused: true });
  }

  /**
   * Resumes playback.
   */
  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;

    if (this.audioElement) {
      this.audioElement.play();
      this.onStateChange({ isPlaying: true, isPaused: false });
    } else if (this.chromeInstance?.runtime?.sendMessage) {
      this.chromeInstance.runtime.sendMessage({ action: 'TTS_RESUME' });
      this.onStateChange({ isPlaying: true, isPaused: false });
      // Continue next chunks if needed
      const lang = this.settings.lang && this.settings.lang !== 'auto' ? this.settings.lang : 'de-DE';
      this.playNextChunk(lang);
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      this.onStateChange({ isPlaying: true, isPaused: false });
    }
  }

  /**
   * Stops playback completely.
   */
  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.chunks = [];

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    if (this.chromeInstance?.runtime?.sendMessage) {
      this.chromeInstance.runtime.sendMessage({ action: 'TTS_STOP' });
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    this.onStateChange({ isPlaying: false, isPaused: false });
  }
}

