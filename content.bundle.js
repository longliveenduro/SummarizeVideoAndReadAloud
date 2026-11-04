(() => {
  // src/dom/selectors.js
  var SELECTORS = {
    // Main container for YouTube video page actions
    actionsBar: [
      "#actions",
      "#actions-inner",
      "#top-level-buttons-computed",
      "ytd-watch-metadata #actions",
      "ytd-menu-renderer.ytd-watch-metadata"
    ],
    // Overflow menu button ("..." more actions)
    overflowButton: [
      'button[aria-label="More actions"]',
      'button[aria-label="Weitere Aktionen"]',
      'yt-icon-button[aria-label*="More"]',
      'yt-icon-button[aria-label*="Aktionen"]',
      "#top-level-buttons-computed ytd-menu-renderer button"
    ],
    // Conversational AI / Ask engagement panel
    engagementPanel: [
      'ytd-engagement-panel-section-list-renderer[target-id*="conversational"]',
      'ytd-engagement-panel-section-list-renderer[target-id*="ask"]',
      'ytd-engagement-panel-section-list-renderer[target-id*="search-summary"]',
      'ytd-engagement-panel-section-list-renderer[target-id*="summary"]',
      'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]'
    ],
    // Response text container inside the panel
    responseContent: [
      'ytd-engagement-panel-section-list-renderer [slot="content"] yt-formatted-string',
      ".clarity-summary-renderer",
      "ytd-conversational-message-renderer[is-response] #message",
      "ytd-conversational-message-renderer[is-response] yt-formatted-string",
      "ytd-ai-summary-renderer yt-formatted-string",
      "ytd-engagement-panel-section-list-renderer #content yt-formatted-string"
    ],
    // Loading/Shimmer indicators when Gemini is thinking
    loadingIndicator: [
      'ytd-engagement-panel-section-list-renderer [slot="content"] tp-yt-paper-spinner',
      'ytd-engagement-panel-section-list-renderer [slot="content"] .loading-shimmer',
      'ytd-engagement-panel-section-list-renderer [slot="content"] yt-activity-indicator',
      'ytd-engagement-panel-section-list-renderer [slot="content"] [aria-busy="true"]',
      "ytd-engagement-panel-section-list-renderer .typing-indicator"
    ],
    // YouTube's main HTML5 video element
    videoPlayer: "video.html5-main-video, .html5-video-player video"
  };
  function isAskButtonElement(element) {
    if (!element) return false;
    const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();
    const title = (element.getAttribute("title") || "").toLowerCase();
    const text = (element.textContent || "").trim().toLowerCase();
    const keywords = ["ask", "ask youtube", "ask gemini", "fragen", "ai summary", "zusammenfassen", "gemini"];
    for (const kw of keywords) {
      if (ariaLabel.includes(kw) || title.includes(kw)) {
        return true;
      }
    }
    if (["ask", "fragen", "ask youtube", "ask gemini"].includes(text)) {
      return true;
    }
    const svg = element.querySelector("svg");
    if (svg) {
      const svgContent = svg.innerHTML.toLowerCase();
      if (svgContent.includes("sparkle") || svgContent.includes("gemini") || svgContent.includes("m19 9l1.25")) {
        return true;
      }
    }
    return false;
  }
  function findAskButton(doc = document) {
    const ariaMatches = doc.querySelectorAll('button[aria-label*="Ask" i], button[aria-label*="Fragen" i], button[aria-label*="Gemini" i]');
    for (const btn of ariaMatches) {
      if (isAskButtonElement(btn)) return btn;
    }
    for (const selector of SELECTORS.actionsBar) {
      const bar = doc.querySelector(selector);
      if (!bar) continue;
      const candidateButtons = bar.querySelectorAll("button, yt-button-view-model, ytd-button-renderer");
      for (const el of candidateButtons) {
        if (isAskButtonElement(el)) {
          return el.querySelector("button") || el;
        }
      }
    }
    const allMetadataButtons = doc.querySelectorAll("ytd-watch-metadata button, #actions button");
    for (const btn of allMetadataButtons) {
      if (isAskButtonElement(btn)) {
        return btn;
      }
    }
    return null;
  }
  function findSummarizeChip(panelElement) {
    if (!panelElement) return null;
    const candidates = panelElement.querySelectorAll("yt-chip-cloud-chip-renderer, button, ytd-button-renderer, yt-button-view-model");
    const chipKeywords = [
      "summarize the video",
      "summarize this video",
      "summarize video",
      "summarize",
      "video zusammenfassen",
      "dieses video zusammenfassen",
      "zusammenfassen",
      "summary"
    ];
    for (const candidate of candidates) {
      const text = (candidate.textContent || "").trim().toLowerCase();
      for (const kw of chipKeywords) {
        if (text.includes(kw)) {
          return candidate.querySelector("button") || candidate;
        }
      }
    }
    return null;
  }

  // src/dom/gemini-controller.js
  var GeminiController = class {
    constructor(options = {}) {
      this.doc = options.doc || (typeof document !== "undefined" ? document : null);
      this.win = options.win || (typeof window !== "undefined" ? window : null);
      this.pollInterval = options.pollInterval || 250;
      this.timeout = options.timeout || 12e3;
    }
    /**
     * Validates if current page is a YouTube video watch page.
     * @returns {boolean}
     */
    isWatchPage() {
      if (!this.win) return false;
      const url = new URL(this.win.location.href);
      return url.pathname === "/watch" && url.searchParams.has("v");
    }
    /**
     * Gets current YouTube video ID.
     * @returns {string | null}
     */
    getVideoId() {
      if (!this.win) return null;
      const url = new URL(this.win.location.href);
      return url.searchParams.get("v");
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
        video.play().catch(() => {
        });
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
      }, 8e3);
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
      let askBtn = findAskButton(this.doc);
      if (askBtn) {
        return { available: true, button: askBtn, isGeofenced: false };
      }
      const overflowBtn = this.doc.querySelector(SELECTORS.overflowButton.join(", "));
      if (overflowBtn) {
        overflowBtn.click();
        await new Promise((r) => setTimeout(r, 300));
        const popupMenu = this.doc.querySelector("ytd-menu-popup-renderer, tp-yt-iron-dropdown");
        if (popupMenu) {
          askBtn = findAskButton(popupMenu);
          if (askBtn) {
            return { available: true, button: askBtn, isGeofenced: false };
          }
        }
        if (this.doc.body) {
          this.doc.body.click();
        }
      }
      return { available: false, button: null, isGeofenced: true };
    }
    /**
     * Opens YouTube's Gemini engagement panel.
     * @param {HTMLElement} askButton
     * @returns {Promise<HTMLElement | null>} The opened panel element
     */
    async openPanel(askButton) {
      if (!askButton) return null;
      let panel = this.getExpandedPanel();
      if (panel) return panel;
      askButton.click();
      panel = await this.waitFor(() => this.getExpandedPanel(), 6e3);
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
          const style = this.win ? this.win.getComputedStyle(panel) : { display: "block" };
          if (style.display !== "none" && panel.getAttribute("visibility") !== "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN") {
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
      const chip = await this.waitFor(() => findSummarizeChip(panel), 5e3);
      if (chip) {
        chip.click();
        return true;
      }
      const inputField = panel.querySelector('textarea#input, div#input[contenteditable="true"], input[type="text"]');
      const sendButton = panel.querySelector('#send-button button, button[aria-label*="Send"], yt-icon-button#send-button');
      if (inputField) {
        if (inputField.tagName === "DIV") {
          inputField.innerText = "Summarize this video";
        } else {
          inputField.value = "Summarize this video";
        }
        inputField.dispatchEvent(new Event("input", { bubbles: true }));
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
    async extractSummaryText(panel, onProgress = () => {
    }, timeoutMs = 3e4) {
      if (!panel) return "";
      const startTime = Date.now();
      let lastText = "";
      let stableCount = 0;
      return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          const responseEls = panel.querySelectorAll(SELECTORS.responseContent.join(", "));
          let currentText = "";
          if (responseEls.length > 0) {
            const latestEl = responseEls[responseEls.length - 1];
            currentText = (latestEl.innerText || latestEl.textContent || "").trim();
          }
          const hasLoadingIndicator = Boolean(panel.querySelector(SELECTORS.loadingIndicator.join(", ")));
          if (currentText.length > 0) {
            onProgress(`Generiere Zusammenfassung... (${currentText.length} Zeichen)`);
            if (currentText === lastText && !hasLoadingIndicator) {
              stableCount++;
              if (stableCount >= 4 && currentText.length > 20) {
                clearInterval(interval);
                return resolve(currentText);
              }
            } else {
              stableCount = 0;
              lastText = currentText;
            }
          } else {
            onProgress("Warte auf Gemini-Antwort...");
          }
          if (Date.now() - startTime >= timeoutMs) {
            clearInterval(interval);
            if (lastText.length > 0) {
              resolve(lastText);
            } else {
              reject(new Error("Zeit\xFCberschreitung beim Warten auf die Gemini-Zusammenfassung."));
            }
          }
        }, 300);
      });
    }
  };

  // src/tts/text-sanitizer.js
  function detectLanguage(text) {
    if (!text || typeof text !== "string") return "auto";
    const lower = text.toLowerCase();
    const germanMarkers = [" und ", " der ", " die ", " das ", " ist ", " nicht ", " eine ", " einen ", " f\xFCr ", " video ", " zusammenfassung "];
    const englishMarkers = [" and ", " the ", " is ", " not ", " a ", " an ", " for ", " video ", " summary ", " about ", " with "];
    let deScore = 0;
    let enScore = 0;
    for (const marker of germanMarkers) {
      if (lower.includes(marker)) deScore++;
    }
    for (const marker of englishMarkers) {
      if (lower.includes(marker)) enScore++;
    }
    if (/[äöüßÄÖÜ]/.test(text)) {
      deScore += 3;
    }
    if (deScore > enScore) return "de";
    if (enScore > deScore) return "en";
    return "auto";
  }
  function normalizeTimestamps(text, lang = "de") {
    if (!text) return "";
    return text.replace(/\b(\d{1,2}):(\d{2}):(\d{2})\b/g, (_match, h, m, s) => {
      const hours = parseInt(h, 10);
      const minutes = parseInt(m, 10);
      const seconds = parseInt(s, 10);
      if (lang === "de") {
        return `${hours} Stunden, ${minutes} Minuten und ${seconds} Sekunden`;
      }
      return `${hours} hours, ${minutes} minutes and ${seconds} seconds`;
    }).replace(/\b(\d{1,2}):(\d{2})\b/g, (_match, m, s) => {
      const minutes = parseInt(m, 10);
      const seconds = parseInt(s, 10);
      if (lang === "de") {
        return `${minutes} Minuten und ${seconds} Sekunden`;
      }
      return `${minutes} minutes and ${seconds} seconds`;
    });
  }
  function sanitizeForSpeech(text, lang = "de") {
    if (!text || typeof text !== "string") return "";
    let cleaned = text;
    cleaned = cleaned.replace(/https?:\/\/\S+/gi, lang === "de" ? "Weblink" : "link");
    cleaned = normalizeTimestamps(cleaned, lang);
    cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, "$1.");
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
    cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
    cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
    cleaned = cleaned.replace(/_([^_]+)_/g, "$1");
    cleaned = cleaned.replace(/^\s*>\s*/gm, "");
    cleaned = cleaned.replace(/^\s*[-*•]\s+/gm, " ");
    cleaned = cleaned.replace(/^\s*(\d+)\.\s+/gm, "$1. ");
    cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, "");
    cleaned = cleaned.replace(/[\[\]{}()]/g, " ");
    cleaned = cleaned.replace(/\.{2,}/g, ".");
    cleaned = cleaned.replace(/!{2,}/g, "!");
    cleaned = cleaned.replace(/\?{2,}/g, "?");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned;
  }
  function chunkTextForTTS(text, maxChunkLength = 180) {
    if (!text || typeof text !== "string") return [];
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.length <= maxChunkLength) {
      return [trimmed];
    }
    const sentenceRegex = /([^.!?;\n]+[.!?;\n]+)/g;
    const rawSentences = trimmed.match(sentenceRegex) || [trimmed];
    const remaining = trimmed.replace(sentenceRegex, "").trim();
    if (remaining) {
      rawSentences.push(remaining);
    }
    const chunks = [];
    let currentChunk = "";
    for (let rawSentence of rawSentences) {
      let sentence = rawSentence.trim();
      if (!sentence) continue;
      if (sentence.length > maxChunkLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        const clauses = sentence.split(/([,:]\s+)/);
        let subChunk = "";
        for (let clause of clauses) {
          if (!clause) continue;
          if ((subChunk + clause).length > maxChunkLength) {
            if (subChunk.trim()) {
              chunks.push(subChunk.trim());
            }
            if (clause.length > maxChunkLength) {
              const words = clause.split(/\s+/);
              let wordChunk = "";
              for (let word of words) {
                if ((wordChunk + " " + word).length > maxChunkLength) {
                  if (wordChunk.trim()) chunks.push(wordChunk.trim());
                  wordChunk = word;
                } else {
                  wordChunk += (wordChunk ? " " : "") + word;
                }
              }
              subChunk = wordChunk;
            } else {
              subChunk = clause;
            }
          } else {
            subChunk += clause;
          }
        }
        if (subChunk.trim()) {
          chunks.push(subChunk.trim());
        }
      } else {
        if ((currentChunk + " " + sentence).length > maxChunkLength) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? " " : "") + sentence;
        }
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }

  // src/tts/speech-engine.js
  var SpeechEngine = class {
    constructor(options = {}) {
      this.chromeInstance = options.chromeInstance || (typeof chrome !== "undefined" ? chrome : null);
      this.settings = options.settings || {};
      this.onStateChange = options.onStateChange || (() => {
      });
      this.onProgress = options.onProgress || (() => {
      });
      this.chunks = [];
      this.currentIndex = 0;
      this.isPlaying = false;
      this.isPaused = false;
      this.audioElement = null;
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
      const detectedLang = detectLanguage(rawText);
      const effectiveLang = this.settings.lang && this.settings.lang !== "auto" ? this.settings.lang : detectedLang === "en" ? "en-US" : "de-DE";
      const cleaned = sanitizeForSpeech(rawText, effectiveLang.startsWith("en") ? "en" : "de");
      this.chunks = chunkTextForTTS(cleaned, 180);
      this.currentIndex = 0;
      if (this.chunks.length === 0) return;
      this.isPlaying = true;
      this.isPaused = false;
      this.onStateChange({ isPlaying: true, isPaused: false });
      if (this.settings.useCloudTts && this.settings.cloudTtsApiKey) {
        try {
          await this.speakWithCloudTTS(cleaned, effectiveLang);
          return;
        } catch (err) {
          console.warn("[YT-Gemini-TTS] Cloud TTS error, falling back to local Google TTS:", err);
        }
      }
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
      const progressPercent = Math.round((this.currentIndex + 1) / this.chunks.length * 100);
      this.onProgress({
        currentIndex: this.currentIndex,
        totalChunks: this.chunks.length,
        percent: progressPercent,
        text: chunk
      });
      const speakOptions = {
        text: chunk,
        lang,
        rate: Number(this.settings.rate) || 1,
        pitch: Number(this.settings.pitch) || 1,
        volume: Number(this.settings.volume) || 1,
        voiceName: this.settings.voiceName || void 0
      };
      if (this.chromeInstance?.runtime?.sendMessage) {
        this.chromeInstance.runtime.sendMessage(
          { action: "TTS_SPEAK", payload: speakOptions },
          (response) => {
            if (response?.error) {
              console.warn("[YT-Gemini-TTS] Background TTS error:", response.error);
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
        this.fallbackWebSpeech(chunk, lang);
      }
    }
    /**
     * Web Speech API fallback.
     * @param {string} text
     * @param {string} lang
     */
    fallbackWebSpeech(text, lang) {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        this.stop();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = Number(this.settings.rate) || 1;
      utterance.pitch = Number(this.settings.pitch) || 1;
      utterance.volume = Number(this.settings.volume) || 1;
      utterance.onend = () => {
        this.currentIndex++;
        if (this.isPlaying && !this.isPaused) {
          this.playNextChunk(lang);
        }
      };
      utterance.onerror = (e) => {
        console.warn("[YT-Gemini-TTS] WebSpeech error:", e);
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
      const voiceName = this.settings.cloudTtsVoice || (lang.startsWith("en") ? "en-US-Journey-F" : "de-DE-Neural2-B");
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: lang,
            name: voiceName
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: Number(this.settings.rate) || 1,
            pitch: (Number(this.settings.pitch) - 1) * 10 || 0
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
        this.chromeInstance.runtime.sendMessage({ action: "TTS_PAUSE" });
      } else if (typeof window !== "undefined" && window.speechSynthesis) {
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
        this.chromeInstance.runtime.sendMessage({ action: "TTS_RESUME" });
        this.onStateChange({ isPlaying: true, isPaused: false });
        const lang = this.settings.lang && this.settings.lang !== "auto" ? this.settings.lang : "de-DE";
        this.playNextChunk(lang);
      } else if (typeof window !== "undefined" && window.speechSynthesis) {
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
        this.chromeInstance.runtime.sendMessage({ action: "TTS_STOP" });
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      this.onStateChange({ isPlaying: false, isPaused: false });
    }
  };

  // src/ui/hud.js
  var SummaryHUD = class {
    constructor(options = {}) {
      this.container = null;
      this.summaryText = "";
      this.onPlay = options.onPlay || (() => {
      });
      this.onPause = options.onPause || (() => {
      });
      this.onResume = options.onResume || (() => {
      });
      this.onStop = options.onStop || (() => {
      });
      this.onReplay = options.onReplay || (() => {
      });
      this.onOpenOptions = options.onOpenOptions || (() => {
      });
    }
    /**
     * Initializes or gets existing HUD container.
     */
    ensureContainer() {
      if (this.container && document.body.contains(this.container)) {
        return this.container;
      }
      const existing = document.getElementById("yt-gemini-summary-hud");
      if (existing) existing.remove();
      this.container = document.createElement("div");
      this.container.id = "yt-gemini-summary-hud";
      this.container.className = "yt-gemini-hud";
      this.container.innerHTML = `
      <div class="yt-gemini-hud-header">
        <div class="yt-gemini-hud-title-wrap">
          <span class="yt-gemini-hud-sparkle">\u2728</span>
          <span class="yt-gemini-hud-title">Gemini Video-Zusammenfassung</span>
        </div>
        <div class="yt-gemini-hud-actions">
          <button class="yt-gemini-hud-icon-btn" id="yt-gemini-hud-options-btn" title="Einstellungen" aria-label="Einstellungen">\u2699\uFE0F</button>
          <button class="yt-gemini-hud-icon-btn" id="yt-gemini-hud-minimize-btn" title="Minimieren" aria-label="Minimieren">_</button>
          <button class="yt-gemini-hud-icon-btn" id="yt-gemini-hud-close-btn" title="Schlie\xDFen" aria-label="Schlie\xDFen">&times;</button>
        </div>
      </div>

      <div class="yt-gemini-hud-body">
        <div class="yt-gemini-hud-status-row">
          <span class="yt-gemini-hud-spinner" id="yt-gemini-hud-spinner"></span>
          <span class="yt-gemini-hud-status-text" id="yt-gemini-hud-status-text">Initialisiere...</span>
        </div>

        <div class="yt-gemini-hud-progress-bar-wrap" id="yt-gemini-hud-progress-wrap" style="display: none;">
          <div class="yt-gemini-hud-progress-bar" id="yt-gemini-hud-progress-bar" style="width: 0%;"></div>
        </div>

        <!-- Controls: Play / Pause / Stop / Replay -->
        <div class="yt-gemini-hud-controls" id="yt-gemini-hud-controls" style="display: none;">
          <button class="yt-gemini-control-btn" id="yt-gemini-btn-pause-play" title="Pause / Weiter" aria-label="Pause / Weiter">
            <span class="btn-icon">\u23F8\uFE0F</span> <span class="btn-text">Pause</span>
          </button>
          <button class="yt-gemini-control-btn" id="yt-gemini-btn-stop" title="Stopp" aria-label="Stopp">
            <span class="btn-icon">\u23F9\uFE0F</span> <span class="btn-text">Stopp</span>
          </button>
          <button class="yt-gemini-control-btn" id="yt-gemini-btn-replay" title="Erneut vorlesen" aria-label="Erneut vorlesen">
            <span class="btn-icon">\u{1F504}</span> <span class="btn-text">Wiederholen</span>
          </button>
          <button class="yt-gemini-control-btn" id="yt-gemini-btn-toggle-text" title="Text anzeigen" aria-label="Text anzeigen">
            <span class="btn-icon">\u{1F4DC}</span> <span class="btn-text">Text</span>
          </button>
        </div>

        <!-- Collapsible text summary -->
        <div class="yt-gemini-hud-text-panel" id="yt-gemini-hud-text-panel" style="display: none;">
          <div class="yt-gemini-hud-text-content" id="yt-gemini-hud-summary-content"></div>
          <div class="yt-gemini-hud-text-actions">
            <button class="yt-gemini-btn-small" id="yt-gemini-btn-copy-summary">\u{1F4CB} Kopieren</button>
          </div>
        </div>
      </div>
    `;
      document.body.appendChild(this.container);
      this.attachEventListeners();
      return this.container;
    }
    attachEventListeners() {
      if (!this.container) return;
      this.container.querySelector("#yt-gemini-hud-close-btn")?.addEventListener("click", () => {
        this.onStop();
        this.hide();
      });
      this.container.querySelector("#yt-gemini-hud-minimize-btn")?.addEventListener("click", () => {
        this.container.classList.toggle("yt-gemini-minimized");
      });
      this.container.querySelector("#yt-gemini-hud-options-btn")?.addEventListener("click", () => {
        this.onOpenOptions();
      });
      const pausePlayBtn = this.container.querySelector("#yt-gemini-btn-pause-play");
      pausePlayBtn?.addEventListener("click", () => {
        const isPaused = pausePlayBtn.dataset.paused === "true";
        if (isPaused) {
          this.onResume();
        } else {
          this.onPause();
        }
      });
      this.container.querySelector("#yt-gemini-btn-stop")?.addEventListener("click", () => {
        this.onStop();
        this.setStatus("Vorgang gestoppt.", false);
      });
      this.container.querySelector("#yt-gemini-btn-replay")?.addEventListener("click", () => {
        this.onReplay(this.summaryText);
      });
      this.container.querySelector("#yt-gemini-btn-toggle-text")?.addEventListener("click", () => {
        const panel = this.container.querySelector("#yt-gemini-hud-text-panel");
        if (panel) {
          panel.style.display = panel.style.display === "none" ? "block" : "none";
        }
      });
      this.container.querySelector("#yt-gemini-btn-copy-summary")?.addEventListener("click", async () => {
        if (this.summaryText && navigator.clipboard) {
          await navigator.clipboard.writeText(this.summaryText);
          const copyBtn = this.container.querySelector("#yt-gemini-btn-copy-summary");
          if (copyBtn) {
            const original = copyBtn.textContent;
            copyBtn.textContent = "\u2705 Kopiert!";
            setTimeout(() => {
              copyBtn.textContent = original;
            }, 2e3);
          }
        }
      });
    }
    /**
     * Sets the displayed status message and spinner.
     * @param {string} text
     * @param {boolean} [showSpinner=true]
     */
    setStatus(text, showSpinner = true) {
      this.ensureContainer();
      const statusEl = this.container.querySelector("#yt-gemini-hud-status-text");
      const spinner = this.container.querySelector("#yt-gemini-hud-spinner");
      if (statusEl) statusEl.textContent = text;
      if (spinner) spinner.style.display = showSpinner ? "inline-block" : "none";
    }
    /**
     * Updates playback state and control buttons.
     * @param {{ isPlaying: boolean, isPaused: boolean, finished?: boolean }} state
     */
    setPlaybackState({ isPlaying, isPaused, finished }) {
      this.ensureContainer();
      const controls = this.container.querySelector("#yt-gemini-hud-controls");
      const progressWrap = this.container.querySelector("#yt-gemini-hud-progress-wrap");
      const pausePlayBtn = this.container.querySelector("#yt-gemini-btn-pause-play");
      const spinner = this.container.querySelector("#yt-gemini-hud-spinner");
      if (controls) controls.style.display = isPlaying || finished ? "flex" : "none";
      if (progressWrap) progressWrap.style.display = isPlaying ? "block" : "none";
      if (spinner) spinner.style.display = isPlaying ? "none" : "inline-block";
      if (pausePlayBtn) {
        if (isPaused) {
          pausePlayBtn.dataset.paused = "true";
          pausePlayBtn.querySelector(".btn-icon").textContent = "\u25B6\uFE0F";
          pausePlayBtn.querySelector(".btn-text").textContent = "Weiter";
          this.setStatus("Vorlesen pausiert.", false);
        } else if (isPlaying) {
          pausePlayBtn.dataset.paused = "false";
          pausePlayBtn.querySelector(".btn-icon").textContent = "\u23F8\uFE0F";
          pausePlayBtn.querySelector(".btn-text").textContent = "Pause";
          this.setStatus("Lese Zusammenfassung vor...", false);
        } else if (finished) {
          this.setStatus("Vorlesen abgeschlossen. \u2728", false);
        }
      }
    }
    /**
     * Updates speech progress bar.
     * @param {number} percent
     */
    setProgress(percent) {
      this.ensureContainer();
      const bar = this.container.querySelector("#yt-gemini-hud-progress-bar");
      if (bar) {
        bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      }
    }
    /**
     * Sets the summary text.
     * @param {string} text
     */
    setSummaryText(text) {
      this.summaryText = text;
      this.ensureContainer();
      const content = this.container.querySelector("#yt-gemini-hud-summary-content");
      if (content) {
        content.textContent = text;
      }
    }
    /**
     * Hides the HUD.
     */
    hide() {
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
    }
  };

  // src/ui/modal-geofencing.js
  function showGeofencingModal({ onReload, onClose, onOpenOptions } = {}) {
    const existing = document.getElementById("yt-gemini-geofencing-modal");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "yt-gemini-geofencing-modal";
    overlay.className = "yt-gemini-modal-overlay";
    overlay.innerHTML = `
    <div class="yt-gemini-modal-card" role="dialog" aria-modal="true" aria-labelledby="yt-gemini-modal-title">
      <div class="yt-gemini-modal-header">
        <div class="yt-gemini-modal-icon">\u{1F30D}</div>
        <div>
          <h2 id="yt-gemini-modal-title">YouTube Gemini-Funktion nicht verf\xFCgbar</h2>
          <span class="yt-gemini-modal-subtitle">Geofencing / Regionale Einschr\xE4nkung erkannt</span>
        </div>
        <button class="yt-gemini-modal-close" id="yt-gemini-modal-close-btn" aria-label="Schlie\xDFen">&times;</button>
      </div>

      <div class="yt-gemini-modal-body">
        <p>
          Google stellt die in YouTube integrierte <strong>Gemini AI-Funktion</strong> (der \u201EAsk / Fragen\u201C-Button) aktuell prim\xE4r Nutzern mit <strong>US-Standort</strong> zur Verf\xFCgung.
        </p>

        <div class="yt-gemini-vpn-guide">
          <h3>\u{1F4A1} So schaltest du die Funktion frei:</h3>
          <ol>
            <li>
              <strong>US-VPN aktivieren:</strong> Verbinde dich \xFCber ein VPN mit einem Server in den <strong>USA</strong> (z. B. New York, Chicago, San Francisco).
            </li>
            <li>
              <strong>Seite neu laden:</strong> Lade dieses YouTube-Video nach dem Verbindungsaufbau neu (<kbd>F5</kbd> oder <kbd>Strg</kbd>+<kbd>R</kbd>).
            </li>
            <li>
              <strong>1-Klick Zusammenfassung:</strong> Klicke erneut auf das Plugin-Icon. Der Gemini-Button unter dem Video wird nun automatisch bedient und vorgelesen!
            </li>
          </ol>
        </div>

        <div class="yt-gemini-modal-hint">
          \u2139\uFE0F <em>Hinweis:</em> Manche Videos (z. B. ohne Transkript oder f\xFCr Kinder) unterst\xFCtzen generell keine KI-Zusammenfassungen.
        </div>
      </div>

      <div class="yt-gemini-modal-actions">
        <button class="yt-gemini-btn-secondary" id="yt-gemini-btn-options">\u2699\uFE0F Plugin-Optionen</button>
        <div class="yt-gemini-actions-right">
          <button class="yt-gemini-btn-secondary" id="yt-gemini-btn-dismiss">Schlie\xDFen</button>
          <button class="yt-gemini-btn-primary" id="yt-gemini-btn-reload">\u{1F504} Seite neu laden</button>
        </div>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);
    const closeModal = () => {
      overlay.classList.add("yt-gemini-fade-out");
      setTimeout(() => overlay.remove(), 250);
      if (onClose) onClose();
    };
    overlay.querySelector("#yt-gemini-modal-close-btn")?.addEventListener("click", closeModal);
    overlay.querySelector("#yt-gemini-btn-dismiss")?.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector("#yt-gemini-btn-reload")?.addEventListener("click", () => {
      closeModal();
      if (onReload) {
        onReload();
      } else {
        window.location.reload();
      }
    });
    overlay.querySelector("#yt-gemini-btn-options")?.addEventListener("click", () => {
      closeModal();
      if (onOpenOptions) {
        onOpenOptions();
      } else if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: "OPEN_OPTIONS" });
      }
    });
    return overlay;
  }

  // src/utils/storage.js
  var DEFAULT_SETTINGS = {
    // Voice selection (empty string means auto-select Google voice for current language)
    voiceName: "",
    // Preferred language ('auto', 'de-DE', 'en-US', etc.)
    lang: "auto",
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

  // content.js
  var controller = null;
  var speechEngine = null;
  var hud = null;
  var currentSettings = null;
  var isProcessing = false;
  async function init() {
    currentSettings = await getSettings();
    controller = new GeminiController();
    hud = new SummaryHUD({
      onPause: () => speechEngine?.pause(),
      onResume: () => speechEngine?.resume(),
      onStop: () => {
        speechEngine?.stop();
        if (currentSettings.resumeVideoAfterTTS) {
          controller.resumeVideo();
        }
      },
      onReplay: (text) => {
        if (currentSettings.autoPauseVideo) {
          controller.pauseVideo();
        }
        speechEngine?.speak(text);
      },
      onOpenOptions: () => {
        chrome.runtime.sendMessage({ action: "OPEN_OPTIONS" });
      }
    });
    speechEngine = new SpeechEngine({
      chromeInstance: chrome,
      settings: currentSettings,
      onStateChange: (state) => {
        hud.setPlaybackState(state);
        if (state.finished && currentSettings.resumeVideoAfterTTS) {
          controller.resumeVideo();
        }
      },
      onProgress: (prog) => {
        hud.setProgress(prog.percent);
      }
    });
    if (currentSettings.showInPageButton) {
      injectInPageButton();
    }
    window.addEventListener("yt-navigate-finish", () => {
      if (speechEngine?.isPlaying) {
        speechEngine.stop();
      }
      hud?.hide();
      if (currentSettings.showInPageButton) {
        injectInPageButton();
      }
    });
  }
  function injectInPageButton() {
    if (document.getElementById("yt-gemini-injected-summary-btn")) return;
    const tryInject = () => {
      if (document.getElementById("yt-gemini-injected-summary-btn")) return true;
      const actionsContainer = document.querySelector(
        "#top-level-buttons-computed, ytd-watch-metadata #actions, #actions-inner"
      );
      if (!actionsContainer) return false;
      const btn = document.createElement("button");
      btn.id = "yt-gemini-injected-summary-btn";
      btn.className = "yt-gemini-injected-btn";
      btn.title = "Video mit Gemini zusammenfassen & per Google TTS vorlesen";
      btn.innerHTML = `
      <span class="sparkle">\u2728</span>
      <span>Gemini Zusammenfassung</span>
    `;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        executeWorkflow();
      });
      actionsContainer.appendChild(btn);
      return true;
    };
    if (!tryInject()) {
      let retries = 0;
      const interval = setInterval(() => {
        retries++;
        if (tryInject() || retries > 20) {
          clearInterval(interval);
        }
      }, 500);
    }
  }
  async function executeWorkflow() {
    if (isProcessing) return;
    isProcessing = true;
    try {
      currentSettings = await getSettings();
      speechEngine.updateSettings(currentSettings);
      if (!controller.isWatchPage()) {
        alert("Bitte \xF6ffne zuerst ein YouTube-Video.");
        isProcessing = false;
        return;
      }
      hud.setStatus("Suche integrierte YouTube Gemini-Funktion...", true);
      const detection = await controller.detectGemini();
      if (detection.isGeofenced) {
        hud.hide();
        showGeofencingModal({
          onReload: () => window.location.reload(),
          onOpenOptions: () => chrome.runtime.sendMessage({ action: "OPEN_OPTIONS" })
        });
        isProcessing = false;
        return;
      }
      if (!detection.available || !detection.button) {
        hud.setStatus("Gemini-Funktion auf diesem Video nicht gefunden.", false);
        isProcessing = false;
        return;
      }
      hud.setStatus("\xD6ffne Gemini-Panel...", true);
      const panel = await controller.openPanel(detection.button);
      if (!panel) {
        hud.setStatus("Konnte das Gemini-Panel nicht \xF6ffnen.", false);
        isProcessing = false;
        return;
      }
      hud.setStatus("Starte Video-Zusammenfassung...", true);
      const triggered = await controller.triggerSummaryChip(panel);
      if (!triggered) {
        hud.setStatus("Konnte den Zusammenfassen-Befehl nicht senden.", false);
        isProcessing = false;
        return;
      }
      hud.setStatus("Gemini generiert Zusammenfassung...", true);
      const summaryText = await controller.extractSummaryText(panel, (status) => {
        hud.setStatus(status, true);
      });
      if (!summaryText) {
        hud.setStatus("Kein Zusammenfassungstext empfangen.", false);
        isProcessing = false;
        return;
      }
      hud.setSummaryText(summaryText);
      hud.setStatus("Lese Zusammenfassung mit Google TTS vor...", false);
      if (currentSettings.autoPauseVideo) {
        controller.pauseVideo();
      }
      await speechEngine.speak(summaryText);
    } catch (error) {
      console.error("[YT-Gemini-TTS] Workflow error:", error);
      hud.setStatus(`Fehler: ${error.message || error}`, false);
    } finally {
      isProcessing = false;
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "START_SUMMARY") {
      executeWorkflow();
      sendResponse({ received: true });
      return true;
    }
  });
  if (typeof window !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
