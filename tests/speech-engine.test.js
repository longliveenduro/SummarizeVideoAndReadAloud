import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeechEngine } from '../src/tts/speech-engine.js';

describe('SpeechEngine', () => {
  let fakeChrome;
  let engine;
  let stateChanges;
  let progressEvents;

  beforeEach(() => {
    stateChanges = [];
    progressEvents = [];

    fakeChrome = {
      runtime: {
        sendMessage: vi.fn((msg, cb) => {
          if (msg.action === 'TTS_SPEAK') {
            cb && cb({ status: 'end' });
          } else {
            cb && cb({ status: 'ok' });
          }
        })
      }
    };

    engine = new SpeechEngine({
      chromeInstance: fakeChrome,
      settings: {
        voiceName: 'Google Deutsch',
        lang: 'de-DE',
        rate: 1.2,
        pitch: 1.0,
        volume: 1.0
      },
      onStateChange: (state) => stateChanges.push(state),
      onProgress: (prog) => progressEvents.push(prog)
    });
  });

  it('initializes with proper defaults and settings', () => {
    expect(engine.isPlaying).toBe(false);
    expect(engine.isPaused).toBe(false);
    expect(engine.settings.voiceName).toBe('Google Deutsch');
  });

  it('speaks text by chunking and dispatching messages', async () => {
    const text = 'Erster Satz der Zusammenfassung. Zweiter Satz der Zusammenfassung.';
    await engine.speak(text);

    expect(stateChanges).toContainEqual({ isPlaying: true, isPaused: false });
    expect(fakeChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TTS_SPEAK' }),
      expect.any(Function)
    );
  });

  it('pauses and resumes playback', () => {
    engine.isPlaying = true;
    engine.pause();
    expect(engine.isPaused).toBe(true);
    expect(stateChanges).toContainEqual({ isPlaying: true, isPaused: true });

    engine.resume();
    expect(engine.isPaused).toBe(false);
    expect(stateChanges).toContainEqual({ isPlaying: true, isPaused: false });
  });

  it('stops playback and resets state', () => {
    engine.isPlaying = true;
    engine.isPaused = true;
    engine.stop();
    expect(engine.isPlaying).toBe(false);
    expect(engine.isPaused).toBe(false);
    expect(stateChanges).toContainEqual({ isPlaying: false, isPaused: false });
  });
});

