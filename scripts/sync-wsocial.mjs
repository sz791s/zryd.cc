import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { postUrl, richTextParts, selectPosts } from "../quartz/static/wsocial-feed.js"

export const ACTOR = "did:plc:jaizqvad23fmiexrhvhrc4fh"
export const HANDLE = "simonzryd.wsocial.eu"
const API = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed"
const ROOT = fileURLToPath(new URL("../", import.meta.url))
const MIME_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
])

async function readOptional(filename) {
  try {
    return await readFile(filename, "utf8")
  } catch (error) {
    if (error.code === "ENOENT") return null
    throw error
  }
}

async function writeChanged(filename, content) {
  if ((await readOptional(filename)) === content) return false
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(`${filename}.tmp`, content)
  await rename(`${filename}.tmp`, filename)
  return true
}

export async function fetchOriginalPosts({ fetchImpl = fetch, actor = ACTOR } = {}) {
  const feed = []
  const cursors = new Set()
  let cursor
  for (let page = 0; page < 100; page++) {
    const url = new URL(API)
    url.search = new URLSearchParams({
      actor,
      filter: "posts_no_replies",
      limit: "100",
      ...(cursor ? { cursor } : {}),
    })
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(20000),
      credentials: "omit",
    })
    if (!response.ok) throw new Error(`W Social: HTTP ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.feed)) throw new Error("W Social returned an invalid feed")
    feed.push(...data.feed)
    if (!data.cursor) return selectPosts(feed, actor, Infinity)
    if (typeof data.cursor !== "string" || cursors.has(data.cursor))
      throw new Error("W Social repeated a pagination cursor")
    cursors.add(data.cursor)
    cursor = data.cursor
  }
  throw new Error("W Social pagination exceeded 100 pages; archive left unchanged")
}

export function mergePosts(previous, incoming, actor = ACTOR) {
  const posts = new Map(previous.map((post) => [post.uri, post]))
  for (const post of incoming) posts.set(post.uri, post)
  return selectPosts(
    [...posts.values()].map((post) => ({ post })),
    actor,
    Infinity,
  )
}

function escapeMarkdown(text) {
  return text.replace(/[\\`*_{}\[\]<>]/g, "\\$&")
}

export function postMarkdown(post) {
  const body = richTextParts(post.record.text, post.record.facets ?? [])
    .map((part) =>
      part.href ? `[${escapeMarkdown(part.text)}](<${part.href}>)` : escapeMarkdown(part.text),
    )
    .join("")
  const lines = [
    "---",
    `title: ${JSON.stringify(`Post vom ${post.record.createdAt.slice(0, 10)}`)}`,
    `date: ${JSON.stringify(post.record.createdAt)}`,
    `source: W Social`,
    `url: ${JSON.stringify(postUrl(post.uri))}`,
    `uri: ${JSON.stringify(post.uri)}`,
    "---",
    "",
    body,
    "",
  ]
  if (post.embed?.$type === "app.bsky.embed.images#view") {
    for (const image of post.embed.images) {
      if (image.fullsize.startsWith("media/"))
        lines.push(
          `![${escapeMarkdown(image.alt || "Bild zum Beitrag")}](../../quartz/static/wsocial/${image.fullsize})`,
          "",
        )
    }
  }
  const external = post.embed?.external
  if (external)
    lines.push(`[${escapeMarkdown(external.title || "Verlinkte Seite")}](<${external.uri}>)`, "")
  lines.push(`[Original auf W Social](<${postUrl(post.uri)}>)`, "")
  return lines.join("\n")
}

export async function syncArchive({ root = ROOT, fetchImpl = fetch, now = () => new Date() } = {}) {
  const archiveDir = path.join(root, "quartz/static/wsocial")
  const archiveFile = path.join(archiveDir, "posts.json")
  const previousText = await readOptional(archiveFile)
  const previous = previousText
    ? JSON.parse(previousText)
    : { schemaVersion: 1, actor: ACTOR, posts: [], media: {} }
  if (previous.schemaVersion !== 1 || previous.actor !== ACTOR || !Array.isArray(previous.posts))
    throw new Error("Invalid existing archive; refusing to overwrite it")

  // Finish pagination before changing the archive. Missing remote posts are retained.
  const originals = await fetchOriginalPosts({ fetchImpl })
  const media = { ...previous.media }
  const pendingMedia = new Map()
  let downloaded = 0
  async function saveImage(value) {
    if (!value) return undefined
    const url = new URL(value)
    if (
      url.protocol !== "https:" ||
      !["cdn.bsky.app", "video.bsky.app"].includes(url.hostname) ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      throw new Error(`Unsupported media URL: ${url.origin}`)
    }
    const cached = media[url.href]
    if (cached && /^media\/[a-f0-9]{64}\.(jpg|png|webp|gif|avif)$/.test(cached)) {
      try {
        await readFile(path.join(archiveDir, cached))
        return cached
      } catch (error) {
        if (error.code !== "ENOENT") throw error
      }
    }
    if (pendingMedia.has(url.href)) return pendingMedia.get(url.href)
    const operation = (async () => {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(30000),
        redirect: "error",
        credentials: "omit",
      })
      if (!response.ok) throw new Error(`Media download: HTTP ${response.status}`)
      const extension = MIME_EXTENSIONS.get(
        response.headers.get("content-type")?.split(";")[0].trim(),
      )
      if (!extension) throw new Error("Expected an image from the media server")
      const maxSize = 25 * 1024 * 1024
      if (Number(response.headers.get("content-length")) > maxSize)
        throw new Error("Image exceeds the 25 MB archive limit")
      const chunks = []
      let size = 0
      for await (const chunk of response.body) {
        size += chunk.length
        if (size > maxSize) throw new Error("Image exceeds the 25 MB archive limit")
        chunks.push(chunk)
      }
      if (!size) throw new Error("Empty media response")
      const relative = `media/${createHash("sha256").update(url.href).digest("hex")}${extension}`
      await mkdir(path.join(archiveDir, "media"), { recursive: true })
      await writeFile(path.join(archiveDir, relative), Buffer.concat(chunks))
      media[url.href] = relative
      downloaded++
      return relative
    })()
    pendingMedia.set(url.href, operation)
    return operation
  }

  const incoming = []
  for (const source of originals) {
    const post = {
      uri: source.uri,
      cid: source.cid,
      author: { did: source.author.did, handle: source.author.handle },
      record: structuredClone(source.record),
      originalUrl: postUrl(source.uri),
    }
    const embed = source.embed
    if (embed?.$type === "app.bsky.embed.images#view") {
      post.embed = { $type: embed.$type, images: [] }
      for (const image of embed.images) {
        post.embed.images.push({
          ...image,
          thumb: await saveImage(image.thumb),
          fullsize: await saveImage(image.fullsize),
        })
      }
    } else if (embed?.$type === "app.bsky.embed.external#view") {
      post.embed = {
        $type: embed.$type,
        external: { ...embed.external, thumb: await saveImage(embed.external.thumb) },
      }
    } else if (embed?.$type === "app.bsky.embed.video#view") {
      // Preserve the preview and source record; playback still opens the W Social original.
      post.embed = {
        $type: embed.$type,
        cid: embed.cid,
        alt: embed.alt,
        aspectRatio: embed.aspectRatio,
        thumbnail: await saveImage(embed.thumbnail),
      }
    }
    incoming.push(post)
  }
  const posts = mergePosts(previous.posts, incoming)
  const changed =
    JSON.stringify(posts) !== JSON.stringify(previous.posts) ||
    JSON.stringify(media) !== JSON.stringify(previous.media ?? {})
  const archive = {
    schemaVersion: 1,
    actor: ACTOR,
    handle: HANDLE,
    updatedAt: changed || !previous.updatedAt ? now().toISOString() : previous.updatedAt,
    posts,
    media,
  }
  for (const post of posts) {
    const key = post.uri.split("/").at(-1)
    await writeChanged(
      path.join(root, "archive/wsocial", `${post.record.createdAt.slice(0, 10)}-${key}.md`),
      postMarkdown(post),
    )
  }
  await writeChanged(archiveFile, JSON.stringify(archive, null, 2) + "\n")
  return { fetched: originals.length, archived: posts.length, downloaded, changed }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  syncArchive()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
