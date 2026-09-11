import type { PageFrame } from "./types"
import type { FullSlug } from "../../util/path"
import { resolveRelative } from "../../util/path"

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", year: "numeric" }).format(date)

export const JournalFrame: PageFrame = {
  name: "journal",
  render({ componentData, header, pageBody: Content }) {
    const { fileData, allFiles } = componentData
    const slug = fileData.slug ?? ("index" as FullSlug)
    const home = slug === "index"
    const about = slug === "über-mich"
    const href = (target: string) => resolveRelative(slug, target as FullSlug)
    const notes = allFiles
      .filter(
        (file) =>
          file.filePath?.endsWith(".md") &&
          file.slug &&
          file.slug !== "index" &&
          file.slug !== "über-mich" &&
          file.frontmatter?.type !== "page" &&
          !file.frontmatter?.draft &&
          !file.frontmatter?.unlisted,
      )
      .sort(
        (a, b) =>
          (b.dates?.created?.getTime() ?? 0) - (a.dates?.created?.getTime() ?? 0) ||
          String(a.frontmatter?.title).localeCompare(String(b.frontmatter?.title), "de"),
      )
    const isNote = !home && !about && fileData.frontmatter?.type !== "page" && !!fileData.dates

    return (
      <div class="journal-shell">
        <a class="skip-link" href="#inhalt">
          Zum Inhalt
        </a>
        <header class="journal-header">
          <a class="journal-brand" href={href("index")} aria-label="zryd.cc – Startseite">
            zryd<span>.cc</span>
          </a>
          <nav aria-label="Hauptnavigation">
            <a href={href("index")} aria-current={home ? "page" : undefined}>
              Notizen
            </a>
            <a href={href("über-mich")} aria-current={about ? "page" : undefined}>
              Über mich
            </a>
          </nav>
          <div class="journal-tools">
            {header.map((Component) => (
              <Component {...componentData} />
            ))}
          </div>
        </header>
        <main
          id="inhalt"
          class={home ? "center journal-main journal-home" : "center journal-main"}
          tabIndex={-1}
        >
          <div class="journal-heading">
            <p class="journal-eyebrow">
              {home ? "Ein persönliches Notizbuch" : about ? "Hallo." : "Notizen"}
            </p>
            <h1>{fileData.frontmatter?.title ?? "Seite nicht gefunden"}</h1>
            {isNote && fileData.dates && (
              <time class="journal-date" dateTime={fileData.dates.created.toISOString()}>
                {dateLabel(fileData.dates.created)}
              </time>
            )}
          </div>
          {slug === "404" ? (
            <article>
              <p>
                Diese Seite gibt es hier leider nicht. Vielleicht findest du sie bei den Notizen.
              </p>
            </article>
          ) : (
            <Content {...componentData} />
          )}
          {home && (
            <section class="journal-notes" id="notizen" aria-labelledby="notes-title">
              <div class="section-heading">
                <h2 id="notes-title">Notizen</h2>
                <a href={href("index.xml")} aria-label="Notizen per RSS abonnieren">
                  RSS <span aria-hidden="true">↗</span>
                </a>
              </div>
              {notes.length ? (
                <ul class="note-list">
                  {notes.map((note) => (
                    <li>
                      <a class="note-title" href={href(note.slug!)}>
                        {note.frontmatter?.title}
                      </a>
                      {note.dates && (
                        <time dateTime={note.dates.created.toISOString()}>
                          {dateLabel(note.dates.created)}
                        </time>
                      )}
                      {note.frontmatter?.description && (
                        <p>{String(note.frontmatter.description)}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="empty-notes">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              )}
            </section>
          )}
          {!home && (
            <div class="back-link">
              <a href={href("index")}>← Zurück zu den Notizen</a>
            </div>
          )}
        </main>
        <footer class="journal-footer">
          <span>© {new Date().getFullYear()} Simon Zryd</span>
          <div>
            <a href="https://github.com/sz791s/zryd.cc">GitHub</a>
            <a href={href("index.xml")}>RSS</a>
          </div>
        </footer>
        <script src={href("static/journal.js")} defer />
      </div>
    )
  },
}
