/**
 * Creates and displays an in-page modal dialog when YouTube's Gemini feature is unavailable due to Geofencing.
 */
export function showGeofencingModal({ onReload, onClose, onOpenOptions } = {}) {
  // Remove any existing modal
  const existing = document.getElementById('yt-gemini-geofencing-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'yt-gemini-geofencing-modal';
  overlay.className = 'yt-gemini-modal-overlay';

  overlay.innerHTML = `
    <div class="yt-gemini-modal-card" role="dialog" aria-modal="true" aria-labelledby="yt-gemini-modal-title">
      <div class="yt-gemini-modal-header">
        <div class="yt-gemini-modal-icon">🌍</div>
        <div>
          <h2 id="yt-gemini-modal-title">YouTube Gemini-Funktion nicht verfügbar</h2>
          <span class="yt-gemini-modal-subtitle">Geofencing / Regionale Einschränkung erkannt</span>
        </div>
        <button class="yt-gemini-modal-close" id="yt-gemini-modal-close-btn" aria-label="Schließen">&times;</button>
      </div>

      <div class="yt-gemini-modal-body">
        <p>
          Google stellt die in YouTube integrierte <strong>Gemini AI-Funktion</strong> (der „Ask / Fragen“-Button) aktuell primär Nutzern mit <strong>US-Standort</strong> zur Verfügung.
        </p>

        <div class="yt-gemini-vpn-guide">
          <h3>💡 So schaltest du die Funktion frei:</h3>
          <ol>
            <li>
              <strong>US-VPN aktivieren:</strong> Verbinde dich über ein VPN mit einem Server in den <strong>USA</strong> (z. B. New York, Chicago, San Francisco).
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
          ℹ️ <em>Hinweis:</em> Manche Videos (z. B. ohne Transkript oder für Kinder) unterstützen generell keine KI-Zusammenfassungen.
        </div>
      </div>

      <div class="yt-gemini-modal-actions">
        <button class="yt-gemini-btn-secondary" id="yt-gemini-btn-options">⚙️ Plugin-Optionen</button>
        <div class="yt-gemini-actions-right">
          <button class="yt-gemini-btn-secondary" id="yt-gemini-btn-dismiss">Schließen</button>
          <button class="yt-gemini-btn-primary" id="yt-gemini-btn-reload">🔄 Seite neu laden</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  const closeModal = () => {
    overlay.classList.add('yt-gemini-fade-out');
    setTimeout(() => overlay.remove(), 250);
    if (onClose) onClose();
  };

  overlay.querySelector('#yt-gemini-modal-close-btn')?.addEventListener('click', closeModal);
  overlay.querySelector('#yt-gemini-btn-dismiss')?.addEventListener('click', closeModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  overlay.querySelector('#yt-gemini-btn-reload')?.addEventListener('click', () => {
    closeModal();
    if (onReload) {
      onReload();
    } else {
      window.location.reload();
    }
  });

  overlay.querySelector('#yt-gemini-btn-options')?.addEventListener('click', () => {
    closeModal();
    if (onOpenOptions) {
      onOpenOptions();
    } else if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'OPEN_OPTIONS' });
    }
  });

  return overlay;
}

