/**
 * DOM Selectors and query helpers for YouTube's watch page and native Gemini ("Ask") feature.
 */

export const SELECTORS = {
  // Main container for YouTube video page actions
  actionsBar: [
    '#actions',
    '#actions-inner',
    '#top-level-buttons-computed',
    'ytd-watch-metadata #actions',
    'ytd-menu-renderer.ytd-watch-metadata'
  ],

  // Overflow menu button ("..." more actions)
  overflowButton: [
    'button[aria-label="More actions"]',
    'button[aria-label="Weitere Aktionen"]',
    'yt-icon-button[aria-label*="More"]',
    'yt-icon-button[aria-label*="Aktionen"]',
    '#top-level-buttons-computed ytd-menu-renderer button'
  ],

  // Conversational AI / Ask engagement panel
  engagementPanel: [
    'ytd-engagement-panel-section-list-renderer[target-id*="conversational"]',
    'ytd-engagement-panel-section-list-renderer[target-id*="ask"]',
    'ytd-engagement-panel-section-list-renderer[target-id*="search-summary"]',
    'ytd-engagement-panel-section-list-renderer[target-id*="summary"]',
    'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]',
    'ytd-engagement-panel-section-list-renderer'
  ],

  // Response text container inside the panel
  responseContent: [
    'ytd-engagement-panel-section-list-renderer [slot="content"] yt-formatted-string',
    'ytd-conversational-message-renderer[is-response] #message',
    'ytd-conversational-message-renderer[is-response] yt-formatted-string',
    'ytd-conversational-message-renderer[is-response]',
    'yt-conversational-message-renderer',
    'yt-conversational-response-view-model',
    'ytd-conversational-response-view-model',
    '.clarity-summary-renderer',
    '.yt-clarity-summary-view-model',
    'ytd-ai-summary-renderer yt-formatted-string',
    'ytd-engagement-panel-section-list-renderer #content yt-formatted-string',
    '[role="log"] yt-formatted-string',
    '#chat-history yt-formatted-string'
  ],

  // Loading/Shimmer indicators when Gemini is thinking
  loadingIndicator: [
    'ytd-engagement-panel-section-list-renderer [slot="content"] tp-yt-paper-spinner',
    'ytd-engagement-panel-section-list-renderer [slot="content"] .loading-shimmer',
    'ytd-engagement-panel-section-list-renderer [slot="content"] yt-activity-indicator',
    'ytd-engagement-panel-section-list-renderer [slot="content"] [aria-busy="true"]',
    'ytd-engagement-panel-section-list-renderer .typing-indicator',
    'tp-yt-paper-spinner',
    '.typing-indicator',
    '[aria-busy="true"]'
  ],

  // YouTube's main HTML5 video element
  videoPlayer: 'video.html5-main-video, .html5-video-player video'
};

/**
 * Checks if an element or its label matches Gemini / Ask terminology.
 * @param {Element} element
 * @returns {boolean}
 */
export function isAskButtonElement(element) {
  if (!element) return false;

  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const title = (element.getAttribute('title') || '').toLowerCase();
  const text = (element.textContent || '').trim().toLowerCase();

  const keywords = ['ask', 'ask youtube', 'ask gemini', 'fragen', 'ai summary', 'zusammenfassen', 'gemini'];

  // Check aria-label or title
  for (const kw of keywords) {
    if (ariaLabel.includes(kw) || title.includes(kw)) {
      return true;
    }
  }

  // Exact or close text match (avoid matching unrelated buttons that happen to contain letters)
  if (['ask', 'fragen', 'ask youtube', 'ask gemini'].includes(text)) {
    return true;
  }

  // Check SVG icons for sparkle icon characteristic of Gemini
  const svg = element.querySelector('svg');
  if (svg) {
    const svgContent = svg.innerHTML.toLowerCase();
    if (svgContent.includes('sparkle') || svgContent.includes('gemini') || svgContent.includes('m19 9l1.25')) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the "Ask" / Gemini button on the page.
 * Scans top-level action buttons, shadow roots, and custom components.
 * @param {Document} [doc=document]
 * @returns {HTMLElement | null}
 */
export function findAskButton(doc = document) {
  // 1. Direct query by aria-label
  const ariaMatches = doc.querySelectorAll('button[aria-label*="Ask" i], button[aria-label*="Fragen" i], button[aria-label*="Gemini" i]');
  for (const btn of ariaMatches) {
    if (isAskButtonElement(btn)) return btn;
  }

  // 2. Scan buttons inside the actions container
  for (const selector of SELECTORS.actionsBar) {
    const bar = doc.querySelector(selector);
    if (!bar) continue;

    const candidateButtons = bar.querySelectorAll('button, yt-button-view-model, ytd-button-renderer');
    for (const el of candidateButtons) {
      if (isAskButtonElement(el)) {
        return el.querySelector('button') || el;
      }
    }
  }

  // 3. Fallback: Scan all action buttons on watch metadata
  const allMetadataButtons = doc.querySelectorAll('ytd-watch-metadata button, #actions button');
  for (const btn of allMetadataButtons) {
    if (isAskButtonElement(btn)) {
      return btn;
    }
  }

  return null;
}

/**
 * Checks whether a given string corresponds to a summary chip label.
 * Handles British English (Summarise), American English (Summarize), German (Zusammenfassen), and generic summary words.
 * @param {string} text
 * @returns {boolean}
 */
export function isSummaryChipKeyword(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase();

  // Primary pattern matching both 'summarise' (UK) and 'summarize' (US) and 'summary'
  if (clean.includes('summar') || clean.includes('zusammenfass')) {
    return true;
  }

  // Secondary synonyms
  const synonyms = [
    'overview',
    'tldr',
    'tl;dr',
    'key points',
    'kernaussagen',
    'überblick'
  ];

  for (const syn of synonyms) {
    if (clean.includes(syn)) return true;
  }

  return false;
}

/**
 * Finds the "Summarize" chip or prompt button inside the Ask panel.
 * @param {Element} panelElement
 * @returns {HTMLElement | null}
 */
export function findSummarizeChip(panelElement) {
  if (!panelElement) return null;

  // Search through all button and chip candidates in the panel
  const candidateSelectors = [
    'yt-suggestion-chip-view-model',
    'yt-chip-cloud-chip-renderer',
    'button',
    '[role="button"]',
    'yt-button-view-model',
    'yt-button-shape',
    '.yt-spec-button-shape-next',
    'ytd-button-renderer',
    'yt-formatted-string'
  ];

  const candidates = panelElement.querySelectorAll(candidateSelectors.join(', '));

  for (const candidate of candidates) {
    const text = (candidate.textContent || '').trim();
    if (isSummaryChipKeyword(text)) {
      // Return clickable element (inner button, closest button or the element itself)
      const clickable = candidate.querySelector('button, [role="button"]')
        || candidate.closest('button, [role="button"], yt-suggestion-chip-view-model, yt-chip-cloud-chip-renderer, yt-button-view-model')
        || candidate;
      return clickable;
    }
  }

  // Deep fallback: scan all leaf elements containing summary keywords
  const allElements = panelElement.querySelectorAll('*');
  for (const el of allElements) {
    // Only check elements with direct text or few children
    if (el.children.length <= 2) {
      const text = (el.textContent || '').trim();
      if (isSummaryChipKeyword(text)) {
        return el.closest('button, [role="button"], yt-suggestion-chip-view-model, yt-chip-cloud-chip-renderer') || el;
      }
    }
  }

  return null;
}

/**
 * Dispatches full user interaction event sequence to ensure Polymer/Lit components trigger.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function simulateClick(element) {
  if (!element) return false;

  const target = element.querySelector('button, [role="button"]') || element;
  const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];

  for (const name of events) {
    try {
      const event = new MouseEvent(name, {
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(event);
    } catch {
      // Ignore if event construction fails in mock environment
    }
  }

  if (typeof target.click === 'function') {
    target.click();
  }

  return true;
}
