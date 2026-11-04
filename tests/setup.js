import { vi } from 'vitest';

// Mock chrome API globally
globalThis.chrome = {
  runtime: {
    sendMessage: vi.fn((_msg, cb) => cb && cb({ status: 'ok' })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    openOptionsPage: vi.fn(),
    lastError: null
  },
  storage: {
    sync: {
      get: vi.fn((defaults, cb) => cb && cb(defaults)),
      set: vi.fn((_items, cb) => cb && cb())
    },
    local: {
      get: vi.fn((defaults, cb) => cb && cb(defaults)),
      set: vi.fn((_items, cb) => cb && cb())
    }
  },
  tts: {
    speak: vi.fn((_text, options) => {
      if (options?.onEvent) {
        options.onEvent({ type: 'start' });
        setTimeout(() => options.onEvent({ type: 'end' }), 10);
      }
    }),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    isSpeaking: vi.fn((cb) => cb && cb(false)),
    getVoices: vi.fn((cb) => {
      cb([
        { voiceName: 'Google Deutsch', lang: 'de-DE' },
        { voiceName: 'Google US English', lang: 'en-US' },
        { voiceName: 'Google UK English Female', lang: 'en-GB' }
      ]);
    })
  },
  action: {
    onClicked: {
      addListener: vi.fn()
    },
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn()
  },
  tabs: {
    sendMessage: vi.fn()
  },
  scripting: {
    executeScript: vi.fn()
  }
};

// Mock SpeechSynthesis if not present
if (typeof window !== 'undefined' && !window.speechSynthesis) {
  window.speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => [
      { name: 'Google Deutsch', lang: 'de-DE' },
      { name: 'Google US English', lang: 'en-US' }
    ]),
    onvoiceschanged: null
  };

  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.lang = 'de-DE';
      this.rate = 1.0;
      this.pitch = 1.0;
      this.volume = 1.0;
      this.onend = null;
      this.onerror = null;
    }
  };
}
