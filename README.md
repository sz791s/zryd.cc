# zryd.cc

Eine Website aus Obsidian-Notizen, gebaut mit [Quartz](https://quartz.jzhao.xyz/) und veröffentlicht über GitHub Pages.

## Schreiben

Öffne den Ordner `content/` in Obsidian oder öffne das Repository als Vault. Neue Seiten und Beiträge werden als `.md`-Dateien in `content/` angelegt.

Für einen neuen Beitrag kannst du `content/Vorlage für einen Beitrag.md` kopieren. Solange `draft: true` gesetzt ist, bleibt er auf der Website verborgen.

## Veröffentlichen

Änderungen werden nach dem Synchronisieren mit GitHub automatisch durch den Workflow in `.github/workflows/deploy.yml` gebaut und zu GitHub Pages veröffentlicht.

Die gewünschte Domain ist in Quartz als `zryd.cc` hinterlegt. In den Repository-Einstellungen muss GitHub Pages als Quelle **GitHub Actions** verwenden; für die eigene Domain muss außerdem der DNS-Eintrag auf GitHub Pages zeigen.
