import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS, getSettings, saveSettings, resetSettings } from '../src/utils/storage.js';

describe('Storage Utility', () => {
  let mockStorage = {};

  const fakeChrome = {
    storage: {
      sync: {
        get: vi.fn((defaults, cb) => {
          cb({ ...defaults, ...mockStorage });
        }),
        set: vi.fn((items, cb) => {
          mockStorage = { ...mockStorage, ...items };
          cb();
        })
      }
    },
    runtime: { lastError: null }
  };

  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('should return default settings when storage is empty', async () => {
    const settings = await getSettings(fakeChrome);
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.rate).toBe(1.0);
    expect(settings.autoPauseVideo).toBe(true);
  });

  it('should save and retrieve partial settings updates', async () => {
    await saveSettings({ rate: 1.5, voiceName: 'Google Deutsch' }, fakeChrome);
    const updated = await getSettings(fakeChrome);
    expect(updated.rate).toBe(1.5);
    expect(updated.voiceName).toBe('Google Deutsch');
    expect(updated.pitch).toBe(DEFAULT_SETTINGS.pitch);
  });

  it('should reset settings back to defaults', async () => {
    await saveSettings({ rate: 2.0, lang: 'en-US' }, fakeChrome);
    const reset = await resetSettings(fakeChrome);
    expect(reset.rate).toBe(1.0);
    expect(reset.lang).toBe('de-DE');
    expect(reset.summaryLang).toBe('de');
  });

  it('should fallback gracefully when chrome.storage is unavailable', async () => {
    localStorage.clear();
    const settings = await getSettings(null);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

