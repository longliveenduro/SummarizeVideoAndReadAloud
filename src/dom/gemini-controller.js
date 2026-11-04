import { SELECTORS, findAskButton, findSummarizeChip } from './selectors.js';

export class GeminiController {
  constructor(options = {}) {
    this.doc = options.doc || (typeof document !== 'undefined' ? document : null);
    this.win = options.win || (typeof window !== 'undefined' ? window : null);
    this.pollInterval = options.pollInterval || 250;
    this.timeout = options.timeout || 12000;
  }

  /**
   * Validates if current page is a YouTube video watch page.
   * @returns {boolean}
   */
  isWatchPage() {
    if (!this.win) return false;
    const url = new URL(this.win.location.href);
    return url.pathname === '/watch' && url.searchParams.has('v');
  }

  /**
   * Gets current YouTube video ID.
   * @returns {string | null}
   */
  getVideoId() {
    if (!this.win) return null;
    const url = new URL(this.win.location.href);
    return url.searchParams.get('v');
  }

  /**
   * Pauses the YouTube video if currently playing.
   * @returns {boolean} Whether video was paused
   */
  pauseVideo() {
    if (!this.doc) return false;
    const video = this.doc.querySelector(SELECTORS.videoPlayer);
    if (video && !video.paused) {
      video.pause();
      return true;
    }
    return false;
  }

  /**
   * Resumes YouTube video playback.
   * @returns {boolean}
   */
  resumeVideo() {
    if (!this.doc) return false;
    const video = this.doc.querySelector(SELECTORS.videoPlayer);
    if (video && video.paused) {
      video.play().catch(() => {});
      return true;
    }
    return false;
  }

  /**
   * Waits for an element to match a selector or predicate.
   * @param {() => HTMLElement | null} checkFn
   * @param {number} [timeoutMs]
   * @returns {Promise<HTMLElement | null>}
   */
  async waitFor(checkFn, timeoutMs = this.timeout) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const initial = checkFn();
      if (initial) return resolve(initial);

      const interval = setInterval(() => {
        const found = checkFn();
        if (found) {
          clearInterval(interval);
          resolve(found);
        } else if (Date.now() - startTime >= timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, this.pollInterval);
    });
  }

  /**
   * Waits for the YouTube watch metadata / actions bar to render.
   * @returns {Promise<boolean>}
   */
  async waitForMetadata() {
    const actionsBar = await this.waitFor(() => {
      for (const sel of SELECTORS.actionsBar) {
        const el = this.doc.querySelector(sel);
        if (el) return el;
      }
      return null;
    }, 8000);
    return Boolean(actionsBar);
  }

  /**
   * Checks whether the Ask / Gemini feature is available, checking direct buttons and overflow menu.
   * @returns {Promise<{ available: boolean, button: HTMLElement | null, isGeofenced: boolean }>}
   */
  async detectGemini() {
    if (!this.isWatchPage()) {
      return { available: false, button: null, isGeofenced: false };
    }

    const metadataReady = await this.waitForMetadata();
    if (!metadataReady) {
      return { available: false, button: null, isGeofenced: false };
    }

    // 1. Direct search on visible action buttons
    let askBtn = findAskButton(this.doc);
    if (askBtn) {
      return { available: true, button: askBtn, isGeofenced: false };
    }

    // 2. Check if it's hidden inside the "..." overflow menu
    const overflowBtn = this.doc.querySelector(SELECTORS.overflowButton.join(', '));
    if (overflowBtn) {
      // Temporarily open overflow menu to inspect
      overflowBtn.click();
      await new Promise(r => setTimeout(r, 300));

      const popupMenu = this.doc.querySelector('ytd-menu-popup-renderer, tp-yt-iron-dropdown');
      if (popupMenu) {
        askBtn = findAskButton(popupMenu);
        if (askBtn) {
          return { available: true, button: askBtn, isGeofenced: false };
        }
      }

      // Close menu if not found
      if (this.doc.body) {
        this.doc.body.click();
      }
    }

    // If metadata is present but Ask button is nowhere to be found, geofencing is indicated
    return { available: false, button: null, isGeofenced: true };
  }

  /**
   * Opens YouTube's Gemini engagement panel.
   * @param {HTMLElement} askButton
   * @returns {Promise<HTMLElement | null>} The opened panel element
   */
  async openPanel(askButton) {
    if (!askButton) return null;

    // Check if panel is already expanded
    let panel = this.getExpandedPanel();
    if (panel) return panel;

    // Click the ask button
    askButton.click();

    // Wait for panel to appear and expand
    panel = await this.waitFor(() => this.getExpandedPanel(), 6000);
    return panel;
  }

  /**
   * Returns the conversational AI panel if currently visible in the DOM.
   * @returns {HTMLElement | null}
   */
  getExpandedPanel() {
    if (!this.doc) return null;
    for (const selector of SELECTORS.engagementPanel) {
      const panel = this.doc.querySelector(selector);
      if (panel) {
        const style = this.win ? this.win.getComputedStyle(panel) : { display: 'block' };
        if (style.display !== 'none' && panel.getAttribute('visibility') !== 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN') {
          return panel;
        }
      }
    }
    return null;
  }

  /**
   * Triggers the "Summarize" chip or enters prompt inside the panel.
   * @param {HTMLElement} panel
   * @returns {Promise<boolean>}
   */
  async triggerSummaryChip(panel) {
    if (!panel) return false;

    // Wait for chips to render
    const chip = await this.waitFor(() => findSummarizeChip(panel), 5000);
    if (chip) {
      chip.click();
      return true;
    }

    // Fallback: If chip is not present, use the text input inside conversational panel
    const inputField = panel.querySelector('textarea#input, div#input[contenteditable="true"], input[type="text"]');
    const sendButton = panel.querySelector('#send-button button, button[aria-label*="Send"], yt-icon-button#send-button');

    if (inputField) {
      if (inputField.tagName === 'DIV') {
        inputField.innerText = 'Summarize this video';
      } else {
        inputField.value = 'Summarize this video';
      }
      inputField.dispatchEvent(new Event('input', { bubbles: true }));

      if (sendButton) {
        sendButton.click();
        return true;
      }
    }

    return false;
  }

  /**
   * Waits for Gemini summary generation to finish and returns the extracted text.
   * @param {HTMLElement} panel
   * @param {(status: string) => void} [onProgress]
   * @param {number} [timeoutMs=30000]
   * @returns {Promise<string>}
   */
  async extractSummaryText(panel, onProgress = () => {}, timeoutMs = 30000) {
    if (!panel) return '';

    const startTime = Date.now();
    let lastText = '';
    let stableCount = 0;

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        // Find response container inside the panel
        const responseEls = panel.querySelectorAll(SELECTORS.responseContent.join(', '));
        let currentText = '';

        if (responseEls.length > 0) {
          // Take the latest response node
          const latestEl = responseEls[responseEls.length - 1];
          currentText = (latestEl.innerText || latestEl.textContent || '').trim();
        }

        // Check if loading indicators or shimmers are still active
        const hasLoadingIndicator = Boolean(panel.querySelector(SELECTORS.loadingIndicator.join(', ')));

        if (currentText.length > 0) {
          onProgress(`Generiere Zusammenfassung... (${currentText.length} Zeichen)`);

          if (currentText === lastText && !hasLoadingIndicator) {
            stableCount++;
            // If text has remained stable for ~1 second and not loading, generation is complete
            if (stableCount >= 4 && currentText.length > 20) {
              clearInterval(interval);
              return resolve(currentText);
            }
          } else {
            stableCount = 0;
            lastText = currentText;
          }
        } else {
          onProgress('Warte auf Gemini-Antwort...');
        }

        if (Date.now() - startTime >= timeoutMs) {
          clearInterval(interval);
          if (lastText.length > 0) {
            resolve(lastText);
          } else {
            reject(new Error('Zeitüberschreitung beim Warten auf die Gemini-Zusammenfassung.'));
          }
        }
      }, 300);
    });
  }
}
