/**
 * Floating in-page Heads-Up Display (HUD) for status, playback controls, and summary viewing.
 */
export class SummaryHUD {
  constructor(options = {}) {
    this.container = null;
    this.summaryText = '';
    this.onPlay = options.onPlay || (() => {});
    this.onPause = options.onPause || (() => {});
    this.onResume = options.onResume || (() => {});
    this.onStop = options.onStop || (() => {});
    this.onReplay = options.onReplay || (() => {});
    this.onOpenOptions = options.onOpenOptions || (() => {});
  }

  /**
   * Initializes or gets existing HUD container.
   */
  ensureContainer() {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    // Remove existing if present
    const existing = document.getElementById('yt-gemini-summary-hud');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'yt-gemini-summary-hud';
    this.container.className = 'yt-gemini-hud';

    this.container.innerHTML = `
      <div class="yt-gemini-hud-header">
        <div class="yt-gemini-hud-title-wrap">
          <span class="yt-gemini-hud-sparkle">✨</span>
          <span class="yt-gemini-hud-title">Gemini Video-Zusammenfassung</span>
        </div>
        <div class="yt-gemini-hud-actions">
          <button class="yt-gemini-hud-icon-btn" id="yt-gemini-hud-options-btn" title="Einstellungen" aria-label="Einstellungen">⚙️</button>
          <button class="yt-gemini-hud-icon-btn" id="yt-gemini-hud-minimize-btn" title="Minimieren" aria-label="Minimieren">_</button>
          <button class="yt-gemini-hud-icon-btn" id="yt-gemini-hud-close-btn" title="Schließen" aria-label="Schließen">&times;</button>
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
            <span class="btn-icon">⏸️</span> <span class="btn-text">Pause</span>
          </button>
          <button class="yt-gemini-control-btn" id="yt-gemini-btn-stop" title="Stopp" aria-label="Stopp">
            <span class="btn-icon">⏹️</span> <span class="btn-text">Stopp</span>
          </button>
          <button class="yt-gemini-control-btn" id="yt-gemini-btn-replay" title="Erneut vorlesen" aria-label="Erneut vorlesen">
            <span class="btn-icon">🔄</span> <span class="btn-text">Wiederholen</span>
          </button>
          <button class="yt-gemini-control-btn" id="yt-gemini-btn-toggle-text" title="Text anzeigen" aria-label="Text anzeigen">
            <span class="btn-icon">📜</span> <span class="btn-text">Text</span>
          </button>
        </div>

        <!-- Collapsible text summary -->
        <div class="yt-gemini-hud-text-panel" id="yt-gemini-hud-text-panel" style="display: none;">
          <div class="yt-gemini-hud-text-content" id="yt-gemini-hud-summary-content"></div>
          <div class="yt-gemini-hud-text-actions">
            <button class="yt-gemini-btn-small" id="yt-gemini-btn-copy-summary">📋 Kopieren</button>
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

    // Close button
    this.container.querySelector('#yt-gemini-hud-close-btn')?.addEventListener('click', () => {
      this.onStop();
      this.hide();
    });

    // Minimize button
    this.container.querySelector('#yt-gemini-hud-minimize-btn')?.addEventListener('click', () => {
      this.container.classList.toggle('yt-gemini-minimized');
    });

    // Settings button
    this.container.querySelector('#yt-gemini-hud-options-btn')?.addEventListener('click', () => {
      this.onOpenOptions();
    });

    // Pause / Play toggle
    const pausePlayBtn = this.container.querySelector('#yt-gemini-btn-pause-play');
    pausePlayBtn?.addEventListener('click', () => {
      const isPaused = pausePlayBtn.dataset.paused === 'true';
      if (isPaused) {
        this.onResume();
      } else {
        this.onPause();
      }
    });

    // Stop button
    this.container.querySelector('#yt-gemini-btn-stop')?.addEventListener('click', () => {
      this.onStop();
      this.setStatus('Vorgang gestoppt.', false);
    });

    // Replay button
    this.container.querySelector('#yt-gemini-btn-replay')?.addEventListener('click', () => {
      this.onReplay(this.summaryText);
    });

    // Toggle text panel
    this.container.querySelector('#yt-gemini-btn-toggle-text')?.addEventListener('click', () => {
      const panel = this.container.querySelector('#yt-gemini-hud-text-panel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Copy summary button
    this.container.querySelector('#yt-gemini-btn-copy-summary')?.addEventListener('click', async () => {
      if (this.summaryText && navigator.clipboard) {
        await navigator.clipboard.writeText(this.summaryText);
        const copyBtn = this.container.querySelector('#yt-gemini-btn-copy-summary');
        if (copyBtn) {
          const original = copyBtn.textContent;
          copyBtn.textContent = '✅ Kopiert!';
          setTimeout(() => { copyBtn.textContent = original; }, 2000);
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
    const statusEl = this.container.querySelector('#yt-gemini-hud-status-text');
    const spinner = this.container.querySelector('#yt-gemini-hud-spinner');

    if (statusEl) statusEl.textContent = text;
    if (spinner) spinner.style.display = showSpinner ? 'inline-block' : 'none';
  }

  /**
   * Updates playback state and control buttons.
   * @param {{ isPlaying: boolean, isPaused: boolean, finished?: boolean }} state
   */
  setPlaybackState({ isPlaying, isPaused, finished }) {
    this.ensureContainer();
    const controls = this.container.querySelector('#yt-gemini-hud-controls');
    const progressWrap = this.container.querySelector('#yt-gemini-hud-progress-wrap');
    const pausePlayBtn = this.container.querySelector('#yt-gemini-btn-pause-play');
    const spinner = this.container.querySelector('#yt-gemini-hud-spinner');

    if (controls) controls.style.display = (isPlaying || finished) ? 'flex' : 'none';
    if (progressWrap) progressWrap.style.display = isPlaying ? 'block' : 'none';
    if (spinner) spinner.style.display = isPlaying ? 'none' : 'inline-block';

    if (pausePlayBtn) {
      if (isPaused) {
        pausePlayBtn.dataset.paused = 'true';
        pausePlayBtn.querySelector('.btn-icon').textContent = '▶️';
        pausePlayBtn.querySelector('.btn-text').textContent = 'Weiter';
        this.setStatus('Vorlesen pausiert.', false);
      } else if (isPlaying) {
        pausePlayBtn.dataset.paused = 'false';
        pausePlayBtn.querySelector('.btn-icon').textContent = '⏸️';
        pausePlayBtn.querySelector('.btn-text').textContent = 'Pause';
        this.setStatus('Lese Zusammenfassung vor...', false);
      } else if (finished) {
        this.setStatus('Vorlesen abgeschlossen. ✨', false);
      }
    }
  }

  /**
   * Updates speech progress bar.
   * @param {number} percent
   */
  setProgress(percent) {
    this.ensureContainer();
    const bar = this.container.querySelector('#yt-gemini-hud-progress-bar');
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
    const content = this.container.querySelector('#yt-gemini-hud-summary-content');
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
}

