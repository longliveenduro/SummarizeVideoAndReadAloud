import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showGeofencingModal } from '../src/ui/modal-geofencing.js';

describe('Geofencing Modal UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders geofencing modal with US VPN advice', () => {
    const modal = showGeofencingModal();
    expect(document.getElementById('yt-gemini-geofencing-modal')).toBeTruthy();
    expect(modal.textContent).toContain('YouTube Gemini-Funktion nicht verfügbar');
    expect(modal.textContent).toContain('US-VPN aktivieren');
    expect(modal.textContent).toContain('USA');
  });

  it('calls onReload callback when reload button is clicked', () => {
    const onReload = vi.fn();
    showGeofencingModal({ onReload });

    const reloadBtn = document.getElementById('yt-gemini-btn-reload');
    expect(reloadBtn).toBeTruthy();
    reloadBtn.click();

    expect(onReload).toHaveBeenCalled();
  });

  it('calls onOpenOptions callback when options button is clicked', () => {
    const onOpenOptions = vi.fn();
    showGeofencingModal({ onOpenOptions });

    const optionsBtn = document.getElementById('yt-gemini-btn-options');
    expect(optionsBtn).toBeTruthy();
    optionsBtn.click();

    expect(onOpenOptions).toHaveBeenCalled();
  });

  it('removes modal when dismiss or close button is clicked', () => {
    showGeofencingModal();
    const closeBtn = document.getElementById('yt-gemini-modal-close-btn');
    closeBtn.click();

    // Adds fade-out class immediately
    const modal = document.getElementById('yt-gemini-geofencing-modal');
    expect(modal.classList.contains('yt-gemini-fade-out')).toBe(true);
  });
});

