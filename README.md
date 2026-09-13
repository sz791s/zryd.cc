# zryd.cc

Eine Website aus Obsidian-Notizen, gebaut mit [Quartz](https://quartz.jzhao.xyz/) und veröffentlicht über GitHub Pages.

## Schreiben

Öffne den Ordner `content/` in Obsidian oder öffne das Repository als Vault. Neue Seiten und Beiträge werden als `.md`-Dateien in `content/` angelegt.

Für einen neuen Beitrag kannst du `content/Vorlage für einen Beitrag.md` kopieren. Solange `draft: true` gesetzt ist, bleibt er auf der Website verborgen.

## Veröffentlichen

Änderungen werden nach dem Synchronisieren mit GitHub automatisch durch den Workflow in `.github/workflows/deploy.yml` gebaut und zu GitHub Pages veröffentlicht.

Die Website ist unter **https://sz791s.github.io/zryd.cc/** erreichbar. GitHub Pages verwendet als Quelle **GitHub Actions**. Für die eigene Domain müssen später die Domain-Einstellungen und `baseUrl` gemeinsam angepasst werden.

## Seiten und Beiträge

- Die Startseite ist `content/index.md`, die Vorstellung `content/Über mich.md`.
- Der Titel steht im Kopfbereich unter `title:`. Im Text ist deshalb keine zusätzliche Überschrift mit einem einzelnen `#` nötig.
- Neue Beiträge erscheinen automatisch auf der Startseite, sortiert nach `date:` (neueste zuerst). `description:` wird als kurzer Vorschautext angezeigt.
- Mit `type: page` bleibt eine feste Seite aus der Beitragsliste ausgeschlossen.
- `draft: true` verhindert die Veröffentlichung; der Vorlagenbeitrag ist ein Entwurf.
- Für Obsidian Git am besten das ganze Repository als Vault öffnen und die Notizen im Ordner `content/` bearbeiten. Vor dem Bearbeiten Änderungen von GitHub abrufen (Pull), nach dem Schreiben committen und pushen.

## W-Social-Feed

Auf der Startseite werden bis zu zehn der neuesten eigenen Beiträge von `simonzryd.wsocial.eu` angezeigt. Der Feed wird bei jedem Seitenaufruf über die öffentliche AT-Protocol-Schnittstelle von `public.api.bsky.app` geladen und bei sichtbarer Seite etwa jede Minute aktualisiert. Bei der Rückkehr zu einem länger inaktiven Tab oder nach Wiederherstellung der Verbindung wird erneut geprüft. Ein Login oder erneutes Veröffentlichen der Website ist dafür nicht nötig. Reposts, Antworten und komplette Quote-Posts (auch mit Bildern oder Videos) werden ausgeschlossen. Eigene Bilder und Linkvorschauen bleiben erhalten; Videos führen zum Original auf W Social.

Unveränderte Beiträge werden beim Aktualisieren nicht neu gezeichnet. Bei einem vorübergehenden Fehler bleiben die zuletzt geladenen Beiträge stehen. Der Feed ist eine Live-Ansicht, kein dauerhaftes Archiv: Es wird keine Kopie der Beiträge im Repository gespeichert.

Die feste Konto-ID steht im `data-actor`-Attribut in `JournalFrame.tsx`, die Darstellung in `quartz/static/wsocial-feed.js`. Wenn der Abruf fehlschlägt oder JavaScript deaktiviert ist, bleibt der Link zum Profil verfügbar. Die Website speichert keine Zugangsdaten und lädt kein Social-Media-Widget.

Prüfung des Feed-Parsers: `node --test tests/wsocial-feed.test.mjs`.

## Gestaltung

Die Seite verwendet lokal gespeicherte **Instrument Sans**, dieselbe Schriftfamilie wie JollyPod. Die Webfonts stammen aus dem offiziellen [Instrument-Sans-Repository](https://github.com/Instrument/instrument-sans); die Lizenz liegt unter `quartz/static/fonts/OFL.txt`.

Das Layout liegt in `quartz/components/frames/JournalFrame.tsx`, die Gestaltung in `quartz/styles/custom.scss`. Das externe Quartz-Theme ist deaktiviert; dadurch entfällt dessen nachträgliche Installation. Obsidian-Markdown, RSS und die Entwurfsfilter bleiben aktiv.

## Lokal prüfen

Nach `npm ci` starten `node quartz/bootstrap-cli.mjs build` und optional `node quartz/bootstrap-cli.mjs build --serve` den Build bzw. die Vorschau.
