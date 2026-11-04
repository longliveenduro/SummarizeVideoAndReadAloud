import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiController } from '../src/dom/gemini-controller.js';
import { isAskButtonElement, findAskButton, findSummarizeChip } from '../src/dom/selectors.js';

describe('GeminiController & DOM Automation', () => {
  let controller;
  let mockWin;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockWin = {
      location: new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      getComputedStyle: vi.fn(() => ({ display: 'block' }))
    };
    controller = new GeminiController({
      doc: document,
      win: mockWin,
      pollInterval: 20,
      timeout: 1000
    });
  });

  describe('isWatchPage', () => {
    it('returns true on standard youtube watch page', () => {
      expect(controller.isWatchPage()).toBe(true);
    });

    it('returns false on homepage or search page', () => {
      mockWin.location = new URL('https://www.youtube.com/results?search_query=gemini');
      expect(controller.isWatchPage()).toBe(false);
    });
  });

  describe('isAskButtonElement', () => {
    it('recognizes button by aria-label="Ask"', () => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', 'Ask');
      expect(isAskButtonElement(btn)).toBe(true);
    });

    it('recognizes button by German aria-label="Fragen"', () => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', 'Fragen');
      expect(isAskButtonElement(btn)).toBe(true);
    });

    it('recognizes button with Gemini sparkle SVG', () => {
      const btn = document.createElement('button');
      btn.innerHTML = '<svg><path d="M19 9l1.25-2.75L23 5 sparkles"></path></svg>';
      expect(isAskButtonElement(btn)).toBe(true);
    });

    it('rejects unrelated buttons like Like or Share', () => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', 'Mag ich');
      btn.textContent = 'Like';
      expect(isAskButtonElement(btn)).toBe(false);
    });
  });

  describe('detectGemini & Geofencing detection', () => {
    it('detects available Gemini feature when Ask button is in action bar', async () => {
      document.body.innerHTML = `
        <div id="actions">
          <div id="top-level-buttons-computed">
            <button aria-label="Ask">Ask</button>
          </div>
        </div>
      `;

      const result = await controller.detectGemini();
      expect(result.available).toBe(true);
      expect(result.isGeofenced).toBe(false);
      expect(result.button).toBeTruthy();
    });

    it('detects geofencing when actions bar is rendered but Ask button is missing', async () => {
      document.body.innerHTML = `
        <div id="actions">
          <div id="top-level-buttons-computed">
            <button aria-label="Like">Like</button>
            <button aria-label="Share">Share</button>
          </div>
        </div>
      `;

      const result = await controller.detectGemini();
      expect(result.available).toBe(false);
      expect(result.isGeofenced).toBe(true);
      expect(result.button).toBeNull();
    });
  });

  describe('findSummarizeChip & triggerSummaryChip', () => {
    it('finds and clicks summarize chip inside conversational panel', async () => {
      const panel = document.createElement('div');
      panel.innerHTML = `
        <div class="chips-container">
          <button class="chip">Key moments</button>
          <button class="chip" id="target-chip">Summarize this video</button>
        </div>
      `;
      document.body.appendChild(panel);

      const chip = findSummarizeChip(panel);
      expect(chip).toBeTruthy();
      expect(chip.id).toBe('target-chip');

      const clickSpy = vi.spyOn(chip, 'click');
      const triggered = await controller.triggerSummaryChip(panel);
      expect(triggered).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('extractSummaryText', () => {
    it('extracts stable summary text once generation finishes', async () => {
      const panel = document.createElement('div');
      panel.innerHTML = `
        <ytd-engagement-panel-section-list-renderer target-id="engagement-panel-conversational-ai">
          <div slot="content">
            <yt-formatted-string>Dies ist die vollständige Zusammenfassung des Videos mit vielen nützlichen Informationen.</yt-formatted-string>
          </div>
        </ytd-engagement-panel-section-list-renderer>
      `;
      document.body.appendChild(panel);

      const text = await controller.extractSummaryText(panel, () => {}, 2000);
      expect(text).toContain('Dies ist die vollständige Zusammenfassung des Videos');
    });
  });

  describe('video playback controls', () => {
    it('pauses and resumes video element', () => {
      const video = document.createElement('video');
      video.className = 'html5-main-video';
      document.body.appendChild(video);

      let isPaused = false;
      Object.defineProperty(video, 'paused', {
        get: () => isPaused,
        configurable: true
      });

      video.pause = vi.fn(() => { isPaused = true; });
      video.play = vi.fn(() => { isPaused = false; return Promise.resolve(); });

      expect(controller.pauseVideo()).toBe(true);
      expect(video.pause).toHaveBeenCalled();

      expect(controller.resumeVideo()).toBe(true);
      expect(video.play).toHaveBeenCalled();
    });
  });
});
