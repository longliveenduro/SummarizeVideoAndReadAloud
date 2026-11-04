import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Chrome Extension Manifest V3', () => {
  const manifestPath = path.resolve(__dirname, '../manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('should be a valid Manifest V3 format', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should declare necessary permissions', () => {
    expect(manifest.permissions).toContain('tts');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
  });

  it('should declare youtube.com host permission', () => {
    expect(manifest.host_permissions).toContain('https://www.youtube.com/*');
  });

  it('should configure 1-click action without a default_popup', () => {
    expect(manifest.action).toBeDefined();
    // No popup, so chrome.action.onClicked fires directly for 1-click action!
    expect(manifest.action.default_popup).toBeUndefined();
    expect(manifest.action.default_icon).toBeDefined();
  });

  it('should reference valid icon files', () => {
    for (const size of [16, 32, 48, 128]) {
      const iconFile = path.resolve(__dirname, '..', manifest.icons[size]);
      expect(fs.existsSync(iconFile)).toBe(true);
    }
  });

  it('should register content scripts and background service worker', () => {
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.content_scripts[0].matches).toContain('https://www.youtube.com/watch*');
    expect(manifest.content_scripts[0].css).toContain('content.css');
  });
});

