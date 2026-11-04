/**
 * Background Service Worker (Manifest V3)
 * Handles action click (1-click trigger), chrome.tts orchestration, and options page opening.
 */

// Handle extension icon click in toolbar
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || !tab.url) return;

  const url = new URL(tab.url);
  const isYouTubeWatch = url.hostname.includes('youtube.com') && url.pathname === '/watch';

  if (!isYouTubeWatch) {
    // Visual feedback that the user needs to be on a YouTube watch page
    chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#f44336' });

    setTimeout(() => {
      chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    }, 3000);

    return;
  }

  // 1-Click trigger: Send start message to content script
  try {
    chrome.action.setBadgeText({ tabId: tab.id, text: 'AI' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#4285f4' });

    await chrome.tabs.sendMessage(tab.id, { action: 'START_SUMMARY' });
  } catch (err) {
    console.warn('[YT-Gemini-TTS] Failed to send message to tab, attempting script injection:', err);
    // If content script was not ready yet (e.g. extension just reloaded), inject and retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.tabs.sendMessage(tab.id, { action: 'START_SUMMARY' });
    } catch (injErr) {
      console.error('[YT-Gemini-TTS] Injection failed:', injErr);
    }
  }
});

// Manage TTS and message dispatch
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.action) {
    case 'TTS_SPEAK': {
      handleTtsSpeak(message.payload, sendResponse);
      return true; // Keep message channel open for async response
    }

    case 'TTS_PAUSE': {
      if (chrome.tts?.pause) {
        chrome.tts.pause();
      }
      sendResponse({ status: 'paused' });
      break;
    }

    case 'TTS_RESUME': {
      if (chrome.tts?.resume) {
        chrome.tts.resume();
      }
      sendResponse({ status: 'resumed' });
      break;
    }

    case 'TTS_STOP': {
      if (chrome.tts?.stop) {
        chrome.tts.stop();
      }
      sendResponse({ status: 'stopped' });
      break;
    }

    case 'TTS_GET_VOICES': {
      chrome.tts.getVoices((voices) => {
        sendResponse({ voices: voices || [] });
      });
      return true;
    }

    case 'OPEN_OPTIONS': {
      chrome.runtime.openOptionsPage();
      sendResponse({ status: 'options_opened' });
      break;
    }

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

/**
 * Handles speaking a chunk with chrome.tts.speak
 */
function handleTtsSpeak(payload, sendResponse) {
  if (!chrome.tts) {
    sendResponse({ error: 'chrome.tts API not available' });
    return;
  }

  const { text, lang, rate, pitch, volume, voiceName } = payload || {};

  const options = {
    lang: lang || 'de-DE',
    rate: Math.min(2.0, Math.max(0.5, rate || 1.0)),
    pitch: Math.min(2.0, Math.max(0.5, pitch || 1.0)),
    volume: Math.min(1.0, Math.max(0.0, volume || 1.0)),
    onEvent: (event) => {
      if (event.type === 'end') {
        sendResponse({ status: 'end' });
      } else if (event.type === 'error') {
        console.warn('[YT-Gemini-TTS] chrome.tts error event:', event.errorMessage);
        sendResponse({ error: event.errorMessage || 'TTS playback error' });
      }
    }
  };

  if (voiceName) {
    options.voiceName = voiceName;
    try {
      chrome.tts.speak(text, options);
    } catch (err) {
      console.error('[YT-Gemini-TTS] chrome.tts.speak exception:', err);
      sendResponse({ error: err.message });
    }
  } else {
    // If no specific voiceName is chosen, prefer official Google voice for this language
    chrome.tts.getVoices((voices) => {
      const targetLang = options.lang || 'de-DE';
      const langPrefix = targetLang.split('-')[0].toLowerCase();
      const googleVoice = voices?.find((v) =>
        v.lang && v.lang.toLowerCase().startsWith(langPrefix) && v.voiceName.toLowerCase().includes('google')
      );

      if (googleVoice) {
        options.voiceName = googleVoice.voiceName;
      }

      try {
        chrome.tts.speak(text, options);
      } catch (err) {
        console.error('[YT-Gemini-TTS] chrome.tts.speak exception:', err);
        sendResponse({ error: err.message });
      }
    });
  }
}

