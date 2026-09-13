import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  ACTOR,
  fetchOriginalPosts,
  mergePosts,
  postMarkdown,
  syncArchive,
} from "../scripts/sync-wsocial.mjs"
import { mediaUrl } from "../quartz/static/wsocial-feed.js"

const post = (key, text = key, date = "2026-09-10T12:00:00Z") => ({
  uri: `at://${ACTOR}/app.bsky.feed.post/${key}`,
  cid: `cid-${key}`,
  author: { did: ACTOR, handle: "simonzryd.wsocial.eu" },
  record: { $type: "app.bsky.feed.post", text, createdAt: date },
})
const json = (value) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })

test("import traverses every page and excludes reposts, replies, and quotes", async () => {
  const own = post("own")
  const older = post("older", "Older post", "2026-08-01T12:00:00Z")
  const quote = { ...post("quote"), embed: { $type: "app.bsky.embed.record#view" } }
  const calls = []
  const imported = await fetchOriginalPosts({
    fetchImpl: async (url) => {
      calls.push(url.searchParams.get("cursor"))
      return calls.length === 1
        ? json({
            feed: [
              { post: own },
              { post: quote },
              { post: older, reason: { $type: "app.bsky.feed.defs#reasonRepost" } },
            ],
            cursor: "next",
          })
        : json({ feed: [{ post: older }, { post: own }] })
    },
  })
  assert.deepEqual(calls, [null, "next"])
  assert.deepEqual(
    imported.map((p) => p.uri),
    [own.uri, older.uri],
  )
  await assert.rejects(
    fetchOriginalPosts({ fetchImpl: async () => json({ feed: [], cursor: "same" }) }),
    /repeated/,
  )
  await assert.rejects(
    fetchOriginalPosts({ fetchImpl: async () => json({ unexpected: [] }) }),
    /invalid feed/,
  )
})

test("merging keeps archived posts absent from the source and updates matching originals", () => {
  const old = post("old")
  const updated = post("old", "Edited text")
  const other = post("other")
  assert.deepEqual(
    mergePosts([old, other], [updated]).map((p) => p.record.text),
    ["Edited text", "other"],
  )
  assert.deepEqual(mergePosts([old], []), [old])
})

test("archive stores Markdown and local images, is idempotent, and survives empty or failed imports", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "zryd-archive-test-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const picture = post("picture")
  picture.record.embed = { $type: "app.bsky.embed.images", images: [] }
  picture.embed = {
    $type: "app.bsky.embed.images#view",
    images: [
      {
        thumb: "https://cdn.bsky.app/img/thumb",
        fullsize: "https://cdn.bsky.app/img/full",
        alt: "A picture",
        aspectRatio: { width: 1, height: 1 },
      },
    ],
  }
  const article = post("article")
  article.embed = {
    $type: "app.bsky.embed.external#view",
    external: {
      uri: "https://example.com/story",
      title: "Article",
      description: "Description",
      thumb: "https://cdn.bsky.app/img/article",
    },
  }
  let feed = [{ post: picture }, { post: article }]
  let imageRequests = 0
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=",
    "base64",
  )
  const fetchImpl = async (url) => {
    if (url.hostname === "public.api.bsky.app") return json({ feed })
    imageRequests++
    return new Response(png, { headers: { "content-type": "image/png" } })
  }
  const filename = path.join(root, "quartz/static/wsocial/posts.json")
  const first = await syncArchive({ root, fetchImpl, now: () => new Date("2026-09-13T12:00:00Z") })
  assert.deepEqual(first, { fetched: 2, archived: 2, downloaded: 3, changed: true })
  const initialText = await readFile(filename, "utf8")
  const archive = JSON.parse(initialText)
  const savedPicture = archive.posts.find((p) => p.uri === picture.uri)
  assert.match(savedPicture.embed.images[0].thumb, /^media\/[a-f0-9]{64}\.png$/)
  assert.equal(archive.posts[0].originalUrl.startsWith("https://wsocial.eu/profile/"), true)
  assert.equal((await readdir(path.join(root, "archive/wsocial"))).length, 2)
  for (const relative of Object.values(archive.media)) {
    assert.deepEqual(await readFile(path.join(root, "quartz/static/wsocial", relative)), png)
  }
  const markdown = await readFile(path.join(root, "archive/wsocial/2026-09-10-picture.md"), "utf8")
  assert(markdown.includes("../../quartz/static/wsocial/media/"))
  assert(markdown.includes("Original auf W Social"))
  imageRequests = 0
  const second = await syncArchive({ root, fetchImpl, now: () => new Date("2026-09-14T12:00:00Z") })
  assert.equal(second.changed, false)
  assert.equal(imageRequests, 0)
  assert.equal(await readFile(filename, "utf8"), initialText)
  feed = []
  assert.equal((await syncArchive({ root, fetchImpl })).archived, 2)
  assert.equal(await readFile(filename, "utf8"), initialText)
  let calls = 0
  await assert.rejects(
    syncArchive({
      root,
      fetchImpl: async () =>
        ++calls === 1
          ? json({ feed: [{ post: post("uncommitted") }], cursor: "next" })
          : new Response("error", { status: 503 }),
    }),
    /HTTP 503/,
  )
  assert.equal(await readFile(filename, "utf8"), initialText)
  assert.equal((await readdir(path.join(root, "archive/wsocial"))).length, 2)

  await writeFile(filename, "broken archive")
  await assert.rejects(syncArchive({ root, fetchImpl }))
  assert.equal(await readFile(filename, "utf8"), "broken archive")
})

test("unexpected media servers and HTML responses cannot enter the archive", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "zryd-archive-invalid-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const picture = post("picture")
  picture.embed = {
    $type: "app.bsky.embed.images#view",
    images: [{ thumb: "http://localhost/private", fullsize: "https://cdn.bsky.app/full" }],
  }
  const fetchImpl = async (url) =>
    url.hostname === "public.api.bsky.app"
      ? json({ feed: [{ post: picture }] })
      : new Response("<html>error</html>", { headers: { "content-type": "text/html" } })
  await assert.rejects(syncArchive({ root, fetchImpl }), /Unsupported media URL/)
  picture.embed.images[0].thumb = "https://cdn.bsky.app/thumb"
  await assert.rejects(syncArchive({ root, fetchImpl }), /Expected an image/)
})

test("Markdown preserves full rich-text links; local media paths cannot escape the archive", () => {
  const entry = post("links", "👋 hier")
  entry.record.facets = [
    {
      index: { byteStart: 5, byteEnd: 9 },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://example.com/full" }],
    },
  ]
  assert(postMarkdown(entry).includes("👋 [hier](<https://example.com/full>)"))
  const relative = `media/${"a".repeat(64)}.png`
  assert(new URL(mediaUrl(relative)).pathname.endsWith(`/wsocial/${relative}`))
  assert.equal(mediaUrl("media/../../private.json"), null)
  assert.equal(mediaUrl("javascript:alert(1)"), null)
})
