const ARCHIVE = new URL("./wsocial/posts.json", import.meta.url)
const SOCIAL = "https://wsocial.eu"
export const REFRESH_INTERVAL = 60_000
const feedStates = new WeakMap()

function isQuote(post) {
  // Check both the original record and the resolved view, including quotes with media.
  return [post.record?.embed?.$type, post.embed?.$type].some((type) =>
    /^app\.bsky\.embed\.record(?:WithMedia)?(?:#view)?$/.test(type ?? ""),
  )
}

export function safeUrl(value) {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

export function mediaUrl(value) {
  if (typeof value === "string" && /^media\/[a-f0-9]{64}\.(jpg|png|webp|gif|avif)$/.test(value)) {
    return new URL(value, ARCHIVE).href
  }
  return safeUrl(value)
}

export function postUrl(uri) {
  const match = /^at:\/\/(did:[^/]+)\/app\.bsky\.feed\.post\/([a-zA-Z0-9._~-]+)$/.exec(uri ?? "")
  return match ? `${SOCIAL}/profile/${encodeURIComponent(match[1])}/post/${match[2]}` : null
}

// AT Protocol facet offsets count UTF-8 bytes, including emoji and accented letters.
export function richTextParts(text, facets = []) {
  const bytes = new TextEncoder().encode(text)
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const parts = []
  let cursor = 0
  for (const facet of [...facets].sort((a, b) => a.index?.byteStart - b.index?.byteStart)) {
    const start = facet.index?.byteStart
    const end = facet.index?.byteEnd
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < cursor ||
      end <= start ||
      end > bytes.length
    )
      continue
    const feature = facet.features?.find((item) =>
      ["app.bsky.richtext.facet#link", "app.bsky.richtext.facet#mention"].includes(item.$type),
    )
    let href = null
    if (feature?.$type === "app.bsky.richtext.facet#link") href = safeUrl(feature.uri)
    if (feature?.$type === "app.bsky.richtext.facet#mention" && typeof feature.did === "string") {
      href = `${SOCIAL}/profile/${encodeURIComponent(feature.did)}`
    }
    if (!href) continue
    try {
      const before = decoder.decode(bytes.slice(cursor, start))
      const label = decoder.decode(bytes.slice(start, end))
      parts.push({ text: before }, { text: label, href })
      cursor = end
    } catch {
      // Ignore malformed facets without dropping or changing the original text.
    }
  }
  parts.push({ text: decoder.decode(bytes.slice(cursor)) })
  return parts
}

export function selectPosts(feed, actor, limit = 10) {
  const seen = new Set()
  return feed
    .filter(({ post, reason }) => {
      if (
        !post ||
        reason?.$type === "app.bsky.feed.defs#reasonRepost" ||
        post.author?.did !== actor ||
        post.record?.reply ||
        isQuote(post)
      )
        return false
      if (
        typeof post.record?.text !== "string" ||
        !postUrl(post.uri) ||
        !Number.isFinite(Date.parse(post.record.createdAt)) ||
        seen.has(post.uri)
      )
        return false
      seen.add(post.uri)
      return true
    })
    .map(({ post }) => post)
    .sort((a, b) => Date.parse(b.record.createdAt) - Date.parse(a.record.createdAt))
    .slice(0, limit)
}

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function link(href, text, className) {
  const node = element("a", className, text)
  node.href = href
  node.target = "_blank"
  node.rel = "noopener noreferrer"
  return node
}

function richText(record) {
  const paragraph = element("p", "social-text")
  const text = typeof record?.text === "string" ? record.text : ""
  for (const part of richTextParts(text, Array.isArray(record?.facets) ? record.facets : [])) {
    paragraph.append(part.href ? link(part.href, part.text) : document.createTextNode(part.text))
  }
  return paragraph
}

function renderMedia(embed, original) {
  const fragment = document.createDocumentFragment()
  if (!embed) return fragment
  if (embed.$type === "app.bsky.embed.images#view") {
    const gallery = element("div", "social-images")
    for (const media of (embed.images ?? []).slice(0, 4)) {
      const src = mediaUrl(media.thumb)
      const fullsize = mediaUrl(media.fullsize)
      if (!src || !fullsize) continue
      const anchor = link(fullsize, undefined)
      const image = element("img")
      image.src = src
      image.alt = media.alt || "Bild zum Beitrag"
      image.loading = "lazy"
      image.decoding = "async"
      image.referrerPolicy = "no-referrer"
      if (media.aspectRatio?.width > 0 && media.aspectRatio?.height > 0) {
        image.width = media.aspectRatio.width
        image.height = media.aspectRatio.height
      }
      anchor.append(image)
      gallery.append(anchor)
    }
    fragment.append(gallery)
  } else if (embed.$type === "app.bsky.embed.external#view") {
    const external = embed.external
    const href = safeUrl(external?.uri)
    if (href) {
      const card = link(href, undefined, "social-preview")
      card.append(element("span", "social-domain", new URL(href).hostname.replace(/^www\./, "")))
      const fallbackTitle = /\.gif$/i.test(new URL(href).pathname) ? "GIF ansehen" : "Link ansehen"
      card.append(element("strong", undefined, external.title || fallbackTitle))
      if (external.description)
        card.append(element("span", "social-description", external.description))
      fragment.append(card)
    }
  } else if (embed.$type === "app.bsky.embed.video#view") {
    const videoLink = link(original, undefined, "social-video")
    const thumbnail = mediaUrl(embed.thumbnail)
    if (thumbnail) {
      const image = element("img")
      image.src = thumbnail
      image.alt = embed.alt || ""
      image.loading = "lazy"
      image.referrerPolicy = "no-referrer"
      videoLink.append(image)
    }
    videoLink.append(element("span", undefined, "Video auf W Social ansehen ↗"))
    fragment.append(videoLink)
  }
  return fragment
}

function renderPost(post) {
  const item = element("li")
  const article = element("article", "social-post")
  const date = new Date(post.record.createdAt)
  const dateLabel = new Intl.DateTimeFormat("de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(date)
  const original = postUrl(post.uri)
  article.setAttribute("aria-label", `Beitrag vom ${dateLabel}`)
  const meta = element("div", "social-meta")
  const dateLink = link(original, undefined)
  dateLink.setAttribute("aria-label", `Beitrag vom ${dateLabel} auf W Social öffnen`)
  const time = element("time", undefined, dateLabel)
  time.dateTime = date.toISOString()
  dateLink.append(time)
  meta.append(dateLink, link(original, "W Social ↗", "social-original"))
  article.append(meta, richText(post.record), renderMedia(post.embed, original))
  item.append(article)
  return item
}

export async function loadFeed(root) {
  let state = feedStates.get(root)
  if (!state) {
    state = { loading: false, loaded: false, items: new Map() }
    feedStates.set(root, state)
  }
  if (state.loading) return
  state.loading = true
  const status = root.querySelector("[data-feed-status]")
  const list = root.querySelector("[data-feed-posts]")
  const retry = root.querySelector("[data-feed-retry]")
  root.setAttribute("aria-busy", "true")
  if (!state.loaded) {
    status.hidden = false
    status.textContent = "Beiträge werden geladen …"
  }
  retry.hidden = true
  try {
    const response = await fetch(ARCHIVE, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error(`Feed HTTP ${response.status}`)
    const data = await response.json()
    if (data.schemaVersion !== 1 || data.actor !== root.dataset.actor || !Array.isArray(data.posts))
      throw new Error("Invalid archive response")
    const posts = selectPosts(
      data.posts.map((post) => ({ post })),
      root.dataset.actor,
    )
    // Reuse unchanged posts so periodic checks preserve focus and already loaded images.
    const nextItems = new Map()
    posts.forEach((post, index) => {
      const signature = JSON.stringify([post.record, post.embed])
      let item = state.items.get(post.uri)
      if (item?.signature !== signature) item = { signature, node: renderPost(post) }
      nextItems.set(post.uri, item)
      if (list.children[index] !== item.node)
        list.insertBefore(item.node, list.children[index] ?? null)
    })
    while (list.children.length > posts.length) list.lastElementChild.remove()
    state.items = nextItems
    state.loaded = true
    status.textContent = posts.length ? "" : "Noch keine eigenen Beiträge vorhanden."
    status.hidden = posts.length > 0
  } catch {
    status.hidden = false
    status.textContent = state.loaded
      ? "Die Aktualisierung ist gerade nicht möglich. Wir versuchen es automatisch erneut."
      : "Die Beiträge sind gerade nicht erreichbar. Du findest sie direkt auf W Social."
    retry.hidden = false
  } finally {
    root.setAttribute("aria-busy", "false")
    state.loading = false
  }
}

export function startFeed(root) {
  let timer
  let running = false
  let paused = false
  let lastAttempt = -Infinity
  const active = () => !paused && !document.hidden && navigator.onLine !== false

  async function refresh(force = false) {
    clearTimeout(timer)
    if (running || !active()) return
    if (force || Date.now() - lastAttempt >= REFRESH_INTERVAL) {
      running = true
      lastAttempt = Date.now()
      try {
        await loadFeed(root)
      } finally {
        running = false
      }
    }
    if (active()) {
      timer = setTimeout(refresh, Math.max(1, REFRESH_INTERVAL - (Date.now() - lastAttempt)))
    }
  }

  const onVisibility = () => refresh()
  const onOnline = () => refresh(true)
  const onOffline = () => clearTimeout(timer)
  const onPageHide = () => {
    paused = true
    clearTimeout(timer)
  }
  const onPageShow = () => {
    paused = false
    refresh()
  }
  const onRetry = () => refresh(true)
  document.addEventListener("visibilitychange", onVisibility)
  window.addEventListener("online", onOnline)
  window.addEventListener("offline", onOffline)
  window.addEventListener("pagehide", onPageHide)
  window.addEventListener("pageshow", onPageShow)
  root.querySelector("[data-feed-retry]").addEventListener("click", onRetry)
  refresh(true)

  return () => {
    paused = true
    clearTimeout(timer)
    document.removeEventListener("visibilitychange", onVisibility)
    window.removeEventListener("online", onOnline)
    window.removeEventListener("offline", onOffline)
    window.removeEventListener("pagehide", onPageHide)
    window.removeEventListener("pageshow", onPageShow)
    root.querySelector("[data-feed-retry]").removeEventListener("click", onRetry)
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector("[data-wsocial-feed]")
  if (root) startFeed(root)
}
