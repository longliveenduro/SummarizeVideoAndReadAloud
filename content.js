import { GeminiController } from './src/dom/gemini-controller.js';
import { SpeechEngine } from './src/tts/speech-engine.js';
import { SummaryHUD } from './src/ui/hud.js';
import { showGeofencingModal } from './src/ui/modal-geofencing.js';
import { getSettings } from './src/utils/storage.js';

let controller = null;
let speechEngine = null;
let hud = null;
let currentSettings = null;
let isProcessing = false;

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
      chrome.runtime.sendMessage({ action: 'OPEN_OPTIONS' });
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

  // Inject in-page button if enabled
  if (currentSettings.showInPageButton) {
    injectInPageButton();
  }

  // Handle YouTube SPA page transitions
  window.addEventListener('yt-navigate-finish', () => {
    if (speechEngine?.isPlaying) {
      speechEngine.stop();
    }
    hud?.hide();
    if (currentSettings.showInPageButton) {
      injectInPageButton();
    }
  });
}

/**
 * Injects a 1-click button directly into YouTube's action bar under the video player.
 */
function injectInPageButton() {
  // Prevent duplicate injection
  if (document.getElementById('yt-gemini-injected-summary-btn')) return;

  const tryInject = () => {
    if (document.getElementById('yt-gemini-injected-summary-btn')) return true;

    const actionsContainer = document.querySelector(
      '#top-level-buttons-computed, ytd-watch-metadata #actions, #actions-inner'
    );
    if (!actionsContainer) return false;

    const btn = document.createElement('button');
    btn.id = 'yt-gemini-injected-summary-btn';
    btn.className = 'yt-gemini-injected-btn';
    btn.title = 'Video mit Gemini zusammenfassen & per Google TTS vorlesen';
    btn.innerHTML = `
      <span class="sparkle">✨</span>
      <span>Gemini Zusammenfassung</span>
    `;

    btn.addEventListener('click', (e) => {
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

/**
 * Main workflow executed on 1-click:
 * 1. Check page & detect Gemini
 * 2. If geofenced -> show VPN advice modal
 * 3. Open panel -> trigger summarize chip
 * 4. Extract summary -> Pause video -> Read aloud with Google TTS
 */
export async function executeWorkflow() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    currentSettings = await getSettings();
    speechEngine.updateSettings(currentSettings);

    if (!controller.isWatchPage()) {
      alert('Bitte öffne zuerst ein YouTube-Video.');
      isProcessing = false;
      return;
    }

    hud.setStatus('Suche integrierte YouTube Gemini-Funktion...', true);

    const detection = await controller.detectGemini();

    if (detection.isGeofenced) {
      hud.hide();
      showGeofencingModal({
        onReload: () => window.location.reload(),
        onOpenOptions: () => chrome.runtime.sendMessage({ action: 'OPEN_OPTIONS' })
      });
      isProcessing = false;
      return;
    }

    if (!detection.available || !detection.button) {
      hud.setStatus('Gemini-Funktion auf diesem Video nicht gefunden.', false);
      isProcessing = false;
      return;
    }

    hud.setStatus('Öffne Gemini-Panel...', true);
    const panel = await controller.openPanel(detection.button);
    if (!panel) {
      hud.setStatus('Konnte das Gemini-Panel nicht öffnen.', false);
      isProcessing = false;
      return;
    }

    hud.setStatus('Starte Video-Zusammenfassung...', true);
    const triggered = await controller.triggerSummaryChip(panel);
    if (!triggered) {
      hud.setStatus('Konnte den Zusammenfassen-Befehl nicht senden.', false);
      isProcessing = false;
      return;
    }

    hud.setStatus('Gemini generiert Zusammenfassung...', true);
    const summaryText = await controller.extractSummaryText(panel, (status) => {
      hud.setStatus(status, true);
    });

    if (!summaryText) {
      hud.setStatus('Kein Zusammenfassungstext empfangen.', false);
      isProcessing = false;
      return;
    }

    hud.setSummaryText(summaryText);
    hud.setStatus('Lese Zusammenfassung mit Google TTS vor...', false);

    // Auto-pause YouTube video if configured
    if (currentSettings.autoPauseVideo) {
      controller.pauseVideo();
    }

    // Read aloud via Google TTS
    await speechEngine.speak(summaryText);

  } catch (error) {
    console.error('[YT-Gemini-TTS] Workflow error:', error);
    hud.setStatus(`Fehler: ${error.message || error}`, false);
  } finally {
    isProcessing = false;
  }
}

// Listen for messages from background script (toolbar icon click)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'START_SUMMARY') {
    executeWorkflow();
    sendResponse({ received: true });
    return true;
  }
});

// Run initialization
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
