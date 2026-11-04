# YouTube Gemini Video-Zusammenfassung & Google TTS 🎙️✨

Eine moderne Google Chrome Extension (Manifest V3), die bei jedem YouTube-Video die **in YouTube integrierte Gemini-Funktion** („Ask YouTube / Fragen“) per **1-Klick** nutzt, um den Inhalt zusammenzufassen, und das Ergebnis anschließend mit **Google Text-to-Speech (TTS)** flüssig vorliest.

Entwickelt und optimiert für **Ubuntu / Linux**, Windows und macOS.

---

## ✨ Features im Überblick

- 🖱️ **Echter 1-Klick-Workflow:**
  Ein Klick auf das Plugin-Icon in der Chrome-Symbolleiste auf einer YouTube-Videoseite startet die Zusammenfassung und das Vorlesen automatisch.
- 🤖 **Native YouTube Gemini Automation:**
  Erkennt und steuert den nativen YouTube „Ask / Fragen“-Button, öffnet das Conversational-AI-Panel, wählt den „Summarize / Zusammenfassen“-Chip und extrahiert das generierte Ergebnis in Echtzeit.
- 🔊 **Google Text-to-Speech (TTS):**
  Liest die Zusammenfassung mit Google-Stimmen (z. B. *Google Deutsch*, *Google US English*) vor.
  - Automatisches Pausieren des YouTube-Videos während des Vorlesens.
  - Aufteilung langer Zusammenfassungen in Satz-Chunks zur Vermeidung von Browser-TTS-Timeouts.
  - Bereinigung von Markdown-Artefakten, Zeitstempeln (`02:30` &rarr; `2 Minuten und 30 Sekunden`) und Emojis für natürliche Aussprache.
- 🌍 **Intelligente Geofencing-Erkennung & US-VPN Hinweis:**
  Da Google die native Gemini-Funktion auf YouTube derzeit primär in den USA ausrollt, erkennt das Plugin automatisch, ob die Funktion aufgrund von Geofencing fehlt, und blendet eine verständliche Schritt-für-Schritt-Anleitung zur Aktivierung eines US-VPN ein.
- ⚙️ **Umfangreiche Plugin-Konfiguration (Optionen-Seite):**
  Alle Einstellungen liegen sauber in der Plugin-Konfiguration:
  - Auswahl der Google TTS-Stimme mit Vorhörfunktion („Stimme testen“).
  - Sprechgeschwindigkeit (0.5x bis 2.0x), Tonhöhe und Lautstärke.
  - Automatisches Video-Pausieren / Fortsetzen nach Sprachausgabe.
  - Ein-/Ausschalten des Schnellstart-Buttons unter dem YouTube-Player.
  - Optional: Google Cloud TTS API Unterstützung für Neural2- und Journey-Stimmen.
- 🎛️ **Floating Heads-Up-Display (HUD):**
  Dezentes Overlay auf YouTube mit Play/Pause, Stopp, Wiederholen, Textansicht und Zwischenablage-Kopierfunktion.

---

## 🚀 Installation in Google Chrome (Ubuntu / Linux)

### 1. Repository vorbereiten & bauen
Öffne ein Terminal auf deinem Ubuntu-System:

```bash
git clone https://github.com/dein-benutzername/SummarizeVideoAndReadAloud.git
cd SummarizeVideoAndReadAloud

# Abhängigkeiten installieren
npm install

# Extension bauen (erzeugt ./dist und ./content.bundle.js)
npm run build
```

*(Hinweis: Node.js ab v18 oder v20/v22 wird empfohlen)*

### 2. In Google Chrome laden
1. Öffne Google Chrome und navigiere in der Adressleiste zu:
   ```text
   chrome://extensions/
   ```
2. Aktiviere oben rechts den Schalter **„Entwicklermodus“** (*Developer mode*).
3. Klicke oben links auf den Button **„Entpackte Erweiterung laden“** (*Load unpacked*).
4. Wähle entweder den Projektordner `SummarizeVideoAndReadAloud` oder den Unterordner `dist/` aus.
5. Die Erweiterung **YouTube Gemini Video-Zusammenfassung & TTS** ist nun aktiv!
6. *(Empfohlen)* Klicke auf das Puzzle-Symbol in der Chrome-Symbolleiste und pinne das Plugin fest.

---

## 🎯 Bedienung (1-Klick Workflow)

1. Öffne ein beliebiges YouTube-Video (z. B. `https://www.youtube.com/watch?v=...`).
2. Klicke einfach auf das **Plugin-Icon** in der Chrome-Symbolleiste:
   - Das Plugin verbindet sich mit der YouTube-Seite.
   - Sucht den Gemini „Ask“-Button.
   - Öffnet das AI-Panel und triggert „Summarize this video“.
   - Pausiert das Video und liest die Zusammenfassung über Google TTS vor.
3. Alternativ: Du kannst auch den vom Plugin eingefügten Button **„✨ Gemini Zusammenfassung“** direkt unter dem Videoplayer anklicken.

---

## 🌍 Geofencing & US-VPN Hinweis

Google rollt die native Gemini-Funktion („Ask YouTube“) serverseitig gestaffelt aus und beschränkt sie aktuell überwiegend auf IP-Adressen aus den **USA**.

### Was passiert, wenn du ohne US-IP auf YouTube bist?
Das Plugin prüft, ob die YouTube-Aktionsleiste geladen ist, der Gemini-Button jedoch fehlt. In diesem Fall erscheint ein Hinweisfenster:

> 🌍 **YouTube Gemini-Funktion nicht verfügbar (Geofencing)**  
> Google stellt die in YouTube integrierte Gemini-Funktion aktuell primär Nutzern mit US-Standort zur Verfügung.

### So aktivierst du die Funktion:
1. **US-VPN aktivieren:** Verbinde dich über dein VPN (z. B. ProtonVPN, Mullvad, NordVPN, Wireguard etc.) mit einem Server in den **USA** (z. B. Chicago, New York, San Francisco).
2. **Seite neu laden:** Drücke `F5` oder `Strg`+`R` auf der YouTube-Videoseite.
3. Der native Gemini-Button („Ask“) ist nun unter dem Video sichtbar.
4. Ein Klick auf das Plugin fasst das Video sofort zusammen und liest es vor.

---

## ⚙️ Einstellungen (Plugin Konfig)

Um die Konfiguration anzupassen:
- **Möglichkeit 1:** Rechtsklick auf das Plugin-Icon &rarr; **Optionen** (*Options*).
- **Möglichkeit 2:** Klicke im schwebenden HUD auf YouTube auf das Zahnrad-Symbol (⚙️).

In der Konfiguration kannst du festlegen:
- **Stimme:** Beliebige auf dem Ubuntu-System oder in Chrome registrierte Google-Stimme auswählen (z. B. `Google Deutsch`, `Google US English`).
- **Probe hören:** Ein Klick auf „🔊 Testen“ spielt sofort eine Sprachprobe ab.
- **Sprechtempo & Tonhöhe:** Stufenlos per Schieberegler von 0.5x bis 2.0x anpassen.
- **Video-Verhalten:** Automatisches Pausieren des Videos aktivieren/deaktivieren.
- **Google Cloud TTS (Optional):** Wer eigene Google Cloud WaveNet/Neural2-Stimmen verwenden möchte, kann hier einen optionalen API-Schlüssel eintragen.

---

## 🧪 Tests & Qualitätssicherung

Das Projekt enthält eine vollständige automatisierte Test-Suite mit **Vitest** und **JSDOM**:

```bash
# Tests ausführen
npm test

# Tests im Watch-Modus während der Entwicklung
npm run test:watch
```

### Getestete Bereiche:
- **Manifest V3 Validierung:** Überprüfung von Berechtigungen (`tts`, `storage`, `activeTab`, `scripting`), Host-Permissions und 1-Klick-Action-Konfiguration.
- **YouTube DOM Selektoren & Heuristiken:** Erkennung deutscher und englischer Buttons („Ask“, „Fragen“, „Gemini“, SVG-Sparkles, Overflow-Menü).
- **Geofencing-Logik:** Verifikation, dass fehlende Gemini-Buttons bei geladenen Metadaten zuverlässig als Geofencing erkannt werden.
- **Text-Sanitizer:** Umwandlung von Zeitstempeln (`01:23` &rarr; `1 Minute 23`), Bereinigung von Markdown, Emojis, Bullet Points und Chunking langer Texte.
- **Speech Engine:** Chunk-Verarbeitung, Statusübergänge, Pause/Resume/Stop.
- **Settings & Storage:** Persistenz via `chrome.storage.sync` und Standardwerte.

---

## 🤖 GitHub Actions (CI/CD)

Im Verzeichnis `.github/workflows/test.yml` ist eine automatisierte GitHub Actions Pipeline integriert:

- **Plattform:** `ubuntu-latest`
- **Node.js:** v22
- **Ablauf:**
  1. Repository auschecken
  2. Abhängigkeiten installieren (`npm ci`)
  3. Bundles bauen (`npm run build`)
  4. Testsuite ausführen (`npm test`)
  5. ZIP-Paket für den Chrome Web Store / Release erstellen (`npm run build:zip`)
  6. Fertiges ZIP-Artefakt hochladen (`actions/upload-artifact@v4`)

---

## 📂 Projektstruktur

```
SummarizeVideoAndReadAloud/
├── .github/
│   └── workflows/
│       └── test.yml             # GitHub Actions CI Workflow auf Ubuntu
├── icons/                       # Extension Icons (16, 32, 48, 128 px)
├── options/                     # Plugin-Konfigurationsseite
│   ├── options.html
│   ├── options.css
│   ├── options.js
│   └── options.bundle.js
├── src/
│   ├── dom/
│   │   ├── selectors.js         # Heuristiken für YouTube-Buttons & Engagement-Panels
│   │   └── gemini-controller.js # DOM-Automation & Geofencing-Erkennung
│   ├── tts/
│   │   ├── speech-engine.js     # Orchestrierung der Sprachausgabe
│   │   └── text-sanitizer.js    # Bereinigung, Zeitstempel, Chunking
│   ├── ui/
│   │   ├── hud.js               # Schwebendes Player-Overlay auf YouTube
│   │   └── modal-geofencing.js  # VPN-Hinweis-Dialog
│   └── utils/
│       └── storage.js           # Settings-Management (chrome.storage.sync)
├── tests/                       # Vitest / JSDOM Testsuite (40 Tests)
├── scripts/
│   ├── build.js                 # Esbuild-Bundler für Content & Options
│   ├── generate-icons.js        # Generiert die PNG-Icons
│   └── package-extension.js     # Packt die Extension als ZIP
├── background.js                # Service Worker (1-Klick Action & chrome.tts)
├── content.js                   # Content Script Einstiegspunkt
├── content.bundle.js            # Gebündeltes Content Script (IIFE)
├── content.css                  # HUD, Button & Modal Styling
├── manifest.json                # Chrome Manifest V3 Konfiguration
├── vitest.config.js             # Test-Konfiguration
├── package.json
└── README.md
```

---

## 📜 Lizenz

MIT License – Open Source.

