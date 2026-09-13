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

Die eigenen Originalposts von `simonzryd.wsocial.eu` werden automatisch nach GitHub kopiert. Auf der Website erscheinen weiterhin die zehn neuesten Beiträge im gleichen Layout, mit Bildern, Linkvorschauen und Links zu W Social. Reposts, Antworten und komplette Quote-Posts werden ausgeschlossen.

Der Workflow `.github/workflows/deploy.yml` läuft bei Änderungen, manuell und ungefähr alle 15 Minuten. Er importiert alle erreichbaren Originalposts über die öffentliche AT-Protocol-Schnittstelle, speichert nur tatsächliche Änderungen als Commit und veröffentlicht das gespeicherte Archiv im selben Durchlauf. Dafür sind keine W-Social-Zugangsdaten und kein persönlicher GitHub-Token nötig. Der Mac kann ausgeschaltet bleiben.

- `archive/wsocial/`: ein Markdown-Dokument pro Post, auch in Obsidian lesbar. Diese automatisch erzeugten Dateien am besten nicht direkt bearbeiten; der nächste Import übernimmt wieder den Text von W Social.
- `quartz/static/wsocial/posts.json`: alle gespeicherten Posts, Datumsangaben, Linkvorschauen und Quellen für die Website.
- `quartz/static/wsocial/media/`: lokale Bilddateien und Vorschaubilder. Videos werden als Text, Metadaten und Vorschaubild gesichert; die eigentliche Videodatei bleibt bei W Social.
- `scripts/sync-wsocial.mjs`: Importer mit vollständiger Seitennavigation und Wiederverwendung bereits gespeicherter Bilder.

Bereits archivierte Posts werden nicht automatisch gelöscht, wenn sie bei W Social verschwinden. Updates eines weiterhin vorhandenen Originalposts werden übernommen; frühere Fassungen stehen in der Git-Historie. Bei einem fehlgeschlagenen Import bleibt die zuvor veröffentlichte Website verfügbar. Ein Fehler oder eine leere Antwort leert das bestehende Archiv nicht.

Der Browser lädt den Feed und die Bilder von der eigenen Website und prüft bei sichtbarer Seite etwa jede Minute auf ein neues veröffentlichtes Archiv. Er benötigt dafür keine direkte Verbindung zu W Social. Unveränderte Posts behalten ihre Darstellung; nach einem vorübergehenden Ladefehler bleiben vorhandene Beiträge stehen. Die feste Konto-ID steht in `scripts/sync-wsocial.mjs` und im `data-actor`-Attribut in `JournalFrame.tsx`.

[GitHub kann geplante Läufe verzögern und deaktiviert sie nach 60 Tagen ohne Repository-Aktivität](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). In diesem Fall den Workflow unter Actions wieder aktivieren; gespeicherte Inhalte bleiben verfügbar. Ein manueller Lauf ist dort jederzeit möglich.

Lokal importieren: `node scripts/sync-wsocial.mjs`. Prüfungen: `node --test tests/wsocial-feed.test.mjs tests/wsocial-archive.test.mjs`.

## Gestaltung

Die Seite verwendet lokal gespeicherte **Instrument Sans**, dieselbe Schriftfamilie wie JollyPod. Die Webfonts stammen aus dem offiziellen [Instrument-Sans-Repository](https://github.com/Instrument/instrument-sans); die Lizenz liegt unter `quartz/static/fonts/OFL.txt`.

Das Layout liegt in `quartz/components/frames/JournalFrame.tsx`, die Gestaltung in `quartz/styles/custom.scss`. Das externe Quartz-Theme ist deaktiviert; dadurch entfällt dessen nachträgliche Installation. Obsidian-Markdown, RSS und die Entwurfsfilter bleiben aktiv.

## Lokal prüfen

Nach `npm ci` starten `node quartz/bootstrap-cli.mjs build` und optional `node quartz/bootstrap-cli.mjs build --serve` den Build bzw. die Vorschau.
