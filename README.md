# Bautagebuch-App

Eine einfache, lokale Web-App zum Erfassen von Bautagebuch-Einträgen für mehrere Baustellen als Generalunternehmer.

## Nutzung

1. Datei `index.html` im Browser (Chrome, Edge, Firefox) öffnen – kein Server, keine Installation notwendig.
2. Baustelle anlegen ("+ Neue Baustelle") und dabei unter "Standort für automatischen Wetterabruf" den Ort/PLZ des Bauvorhabens eingeben und über "Standort suchen" bestätigen.
3. In der Baustelle Tagebucheinträge für einzelne Tage erfassen: Wetter, Nachunternehmer/Gewerke, Tätigkeiten, besondere Vorkommnisse und Fotos.
4. Einzelne Einträge oder einen Sammelbericht über einen Zeitraum als PDF exportieren.

## Automatischer Wetterabruf

Ist einer Baustelle ein Standort hinterlegt, wird beim Anlegen eines neuen Tagebucheintrags das Wetter (Wetterlage, Temperatur min/max, Untergrund) automatisch für das gewählte Datum über die kostenlose [Open-Meteo](https://open-meteo.com/)-API geladen (kein API-Schlüssel nötig). Über den Button "Wetter aktualisieren" lässt es sich jederzeit erneut abrufen, z.B. nach einer Datumsänderung. Die vorausgefüllten Werte können danach frei angepasst werden.

Hinweise:
- Für den automatischen Abruf ist eine Internetverbindung erforderlich; schlägt er fehl (kein Internet, kein Standort hinterlegt), bleibt das Wetter einfach manuell auswählbar – die App funktioniert dann wie zuvor.
- Für Tage weit in der Vergangenheit wird automatisch die Wetter-Archiv-Schnittstelle von Open-Meteo verwendet, für aktuelle/zukünftige Tage die Vorhersage-Schnittstelle.
- Der Untergrundzustand (trocken/feucht/nass/gefroren) wird heuristisch aus Niederschlag und Mindesttemperatur abgeleitet und sollte bei Bedarf vor Ort korrigiert werden.

## Als App aufs Smartphone installieren (PWA)

Die App ist eine Progressive Web App (PWA): Sie lässt sich auf dem Smartphone-Homescreen installieren, startet dann wie eine normale App (ohne Browser-Adressleiste) und funktioniert offline.

**Voraussetzung:** Dafür muss die App über **HTTPS** erreichbar sein (Ausnahme: `localhost` auf dem PC selbst). Ein direktes Öffnen der `index.html` per Doppelklick (`file://…`) oder ein einfacher lokaler HTTP-Server im WLAN reicht für die Installation auf dem Handy **nicht**, weil Smartphone-Browser den dafür nötigen Service Worker nur bei einer sicheren Verbindung zulassen.

Empfohlener Weg, um schnell eine HTTPS-Adresse zu bekommen:
1. Den Inhalt des `App`-Ordners zu einem kostenlosen Static-Hosting-Dienst hochladen, z.B. [GitHub Pages](https://pages.github.com/), [Netlify](https://www.netlify.com/) oder [Cloudflare Pages](https://pages.cloudflare.com/) (einfach den Ordner per Drag&Drop hochladen, kein eigener Server nötig).
2. Die erzeugte `https://…`-Adresse auf dem Smartphone im Browser öffnen (Chrome/Android oder Safari/iOS).
3. **Android/Chrome:** Menü → "Zum Startbildschirm hinzufügen" bzw. es erscheint automatisch ein Installationshinweis.
   **iPhone/Safari:** Teilen-Button → "Zum Home-Bildschirm".
4. Die App erscheint danach als eigenes Icon auf dem Homescreen und startet im Vollbild.

Hinweise:
- Da jede Installation eine eigene, isolierte IndexedDB besitzt, sind Daten aus der Desktop-Nutzung nicht automatisch auf dem Handy vorhanden (und umgekehrt) – die App ist bewusst lokal und ohne Cloud-Sync gebaut. Für einen Abgleich zwischen Geräten aktuell PDF-Export/-Import bzw. manuelles Übertragen nutzen.
- Der automatische Wetterabruf benötigt weiterhin eine Internetverbindung; alle anderen Funktionen laufen nach der Installation auch offline.
- Der Service Worker (`sw.js`) cached die App selbst (HTML/CSS/JS/Icons). Nach einer Aktualisierung der App-Dateien auf dem Hosting reicht ein erneuter Start der App (ggf. zweimal), damit die neue Version geladen wird.

## Daten & Speicherung

Alle Daten (Baustellen, Einträge, Fotos) werden **lokal im Browser** in einer IndexedDB-Datenbank gespeichert (`bautagebuch-db`). Es gibt keinen Server und keine Cloud-Synchronisation.

Wichtig:
- Die Daten sind an den jeweiligen Browser **und** dieses Verzeichnis gebunden. Löschen des Browser-Verlaufs/Website-Daten für diese Seite löscht auch die Bautagebücher.
- Es empfiehlt sich, regelmäßig PDF-Berichte zu exportieren, um die Daten dauerhaft zu sichern bzw. weiterzugeben.
- Fotos werden direkt in der Datenbank gespeichert; bei sehr vielen/großen Fotos kann der Speicherbedarf im Browser wachsen.

## Ordnerstruktur

```
App/
  index.html          Einstiegspunkt der App
  manifest.json        PWA-Manifest (Name, Icons, Startverhalten)
  sw.js                 Service Worker (Offline-Cache für die App selbst)
  icons/                App-Icons für Homescreen/Store (192/512/maskable)
  css/styles.css       Styles
  js/db.js             IndexedDB-Datenzugriff (Baustellen, Einträge)
  js/weather.js        Automatischer Wetterabruf (Geocoding & Wetterdaten via Open-Meteo)
  js/pdf.js            PDF-Export (Einzeleintrag & Sammelbericht)
  js/app.js            Anwendungslogik, Routing, UI
  vendor/jspdf.umd.min.js   PDF-Bibliothek (lokal eingebunden, läuft offline)
```

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Framework. PDF-Erstellung erfolgt clientseitig mit [jsPDF](https://github.com/parallax/jsPDF) (MIT-Lizenz), lokal im Ordner `vendor/` abgelegt.
