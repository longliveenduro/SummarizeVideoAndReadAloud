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
    'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]'
  ],

  // Response text container inside the panel
  responseContent: [
    'ytd-engagement-panel-section-list-renderer [slot="content"] yt-formatted-string',
    '.clarity-summary-renderer',
    'ytd-conversational-message-renderer[is-response] #message',
    'ytd-conversational-message-renderer[is-response] yt-formatted-string',
    'ytd-ai-summary-renderer yt-formatted-string',
    'ytd-engagement-panel-section-list-renderer #content yt-formatted-string'
  ],

  // Loading/Shimmer indicators when Gemini is thinking
  loadingIndicator: [
    'ytd-engagement-panel-section-list-renderer [slot="content"] tp-yt-paper-spinner',
    'ytd-engagement-panel-section-list-renderer [slot="content"] .loading-shimmer',
    'ytd-engagement-panel-section-list-renderer [slot="content"] yt-activity-indicator',
    'ytd-engagement-panel-section-list-renderer [slot="content"] [aria-busy="true"]',
    'ytd-engagement-panel-section-list-renderer .typing-indicator'
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
 * Finds the "Summarize" chip or prompt button inside the Ask panel.
 * @param {Element} panelElement
 * @returns {HTMLElement | null}
 */
export function findSummarizeChip(panelElement) {
  if (!panelElement) return null;

  // Search chips and buttons inside the panel
  const candidates = panelElement.querySelectorAll('yt-chip-cloud-chip-renderer, button, ytd-button-renderer, yt-button-view-model');
  const chipKeywords = [
    'summarize the video',
    'summarize this video',
    'summarize video',
    'summarize',
    'video zusammenfassen',
    'dieses video zusammenfassen',
    'zusammenfassen',
    'summary'
  ];

  for (const candidate of candidates) {
    const text = (candidate.textContent || '').trim().toLowerCase();
    for (const kw of chipKeywords) {
      if (text.includes(kw)) {
        return candidate.querySelector('button') || candidate;
      }
    }
  }

  return null;
}
