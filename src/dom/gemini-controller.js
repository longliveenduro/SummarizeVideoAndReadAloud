import { SELECTORS, findAskButton, findSummarizeChip, simulateClick } from './selectors.js';

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
      simulateClick(overflowBtn);
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

    // Click the ask button with full event sequence
    simulateClick(askButton);

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
      const panels = this.doc.querySelectorAll(selector);
      for (const panel of panels) {
        const text = (panel.textContent || '').toLowerCase();
        // Ensure this panel is the conversational AI panel (e.g. contains "ask about this video" or target-id has ask/conversational)
        const targetId = (panel.getAttribute('target-id') || '').toLowerCase();
        const isAskPanel = targetId.includes('ask') || targetId.includes('conversational') || targetId.includes('summary')
          || text.includes('ask about this video') || text.includes('curious about what you\'re watching');

        if (isAskPanel) {
          const style = this.win ? this.win.getComputedStyle(panel) : { display: 'block' };
          if (style.display !== 'none' && panel.getAttribute('visibility') !== 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN') {
            return panel;
          }
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

    // 1. Wait for and click the summary chip (supports British "Summarise", American "Summarize", German "Zusammenfassen")
    const chipWaitTimeout = Math.min(this.timeout, 5000);
    const chip = await this.waitFor(() => findSummarizeChip(panel), chipWaitTimeout);
    if (chip) {
      simulateClick(chip);
      return true;
    }

    // 2. Fallback: If chip is not present or already clicked, use the text input at the bottom of the panel
    const inputSelectors = [
      'textarea#input',
      'div#input[contenteditable="true"]',
      'div[role="textbox"]',
      '[contenteditable="true"]',
      'input#input',
      'input[type="text"]',
      'textarea'
    ];

    let inputField = null;
    for (const sel of inputSelectors) {
      inputField = panel.querySelector(sel);
      if (inputField) break;
    }

    if (inputField) {
      const promptText = 'Summarise the video';

      if (inputField.isContentEditable || inputField.tagName === 'DIV') {
        inputField.focus();
        inputField.textContent = promptText;
        inputField.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: promptText }));
      } else {
        inputField.focus();
        inputField.value = promptText;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Try hitting Enter key
      const enterOptions = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
      inputField.dispatchEvent(new KeyboardEvent('keydown', enterOptions));
      inputField.dispatchEvent(new KeyboardEvent('keypress', enterOptions));
      inputField.dispatchEvent(new KeyboardEvent('keyup', enterOptions));

      // Also try clicking the submit/send button
      const sendButtonSelectors = [
        '#send-button button',
        'button[aria-label*="Send" i]',
        'button[aria-label*="Senden" i]',
        'button[aria-label*="Ask" i]',
        'yt-icon-button#send-button',
        '#send-button',
        'button:has(svg)'
      ];

      for (const btnSel of sendButtonSelectors) {
        const sendBtn = panel.querySelector(btnSel);
        if (sendBtn) {
          simulateClick(sendBtn);
          break;
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Waits for Gemini summary generation to finish and returns the extracted text.
   * @param {HTMLElement} panel
   * @param {(status: string) => void} [onProgress]
   * @param {number} [timeoutMs=35000]
   * @returns {Promise<string>}
   */
  async extractSummaryText(panel, onProgress = () => {}, timeoutMs = 35000) {
    if (!panel) return '';

    const startTime = Date.now();
    let lastText = '';
    let stableCount = 0;

    // Filter out common initial UI strings
    const ignoredPhrases = [
      'ask about this video',
      'curious about what you\'re watching',
      'not sure what to ask? choose something',
      'summarise the video',
      'summarize the video',
      'recommend related content',
      'how should we control ai?',
      'ask a question',
      'ai can make mistakes'
    ];

    const cleanResponseText = (text) => {
      let t = text.trim();
      const lower = t.toLowerCase();
      // If the text is merely one of the greeting/chip prompts, ignore it
      for (const phrase of ignoredPhrases) {
        if (lower === phrase || lower.startsWith(phrase) && t.length < phrase.length + 15) {
          return '';
        }
      }
      return t;
    };

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        // Find response container inside the panel
        const responseEls = panel.querySelectorAll(SELECTORS.responseContent.join(', '));
        let currentText = '';

        if (responseEls.length > 0) {
          // Take the latest response node that has actual summary text
          for (let i = responseEls.length - 1; i >= 0; i--) {
            const raw = (responseEls[i].innerText || responseEls[i].textContent || '').trim();
            const cleaned = cleanResponseText(raw);
            if (cleaned.length > 30) {
              currentText = cleaned;
              break;
            }
          }
        }

        // Deep fallback: If no response node matched specific selectors, check message bubbles
        if (!currentText) {
          const allTextEls = panel.querySelectorAll('yt-formatted-string, p, [role="article"], .content');
          for (let i = allTextEls.length - 1; i >= 0; i--) {
            const raw = (allTextEls[i].innerText || allTextEls[i].textContent || '').trim();
            const cleaned = cleanResponseText(raw);
            if (cleaned.length > 50) {
              currentText = cleaned;
              break;
            }
          }
        }

        // Check if loading indicators or shimmers are still active
        const hasLoadingIndicator = Boolean(panel.querySelector(SELECTORS.loadingIndicator.join(', ')));

        if (currentText.length > 0) {
          onProgress(`Generiere Zusammenfassung... (${currentText.length} Zeichen)`);

          if (currentText === lastText && !hasLoadingIndicator) {
            stableCount++;
            // If text has remained stable for ~1.2 seconds and not loading, generation is complete
            if (stableCount >= 4 && currentText.length > 25) {
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
