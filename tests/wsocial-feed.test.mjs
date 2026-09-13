import assert from "node:assert/strict"
import test from "node:test"
import { postUrl, richTextParts, safeUrl, selectPosts } from "../quartz/static/wsocial-feed.js"

const actor = "did:plc:example"
const entry = (key, date, additions = {}) => ({
  post: {
    uri: `at://${actor}/app.bsky.feed.post/${key}`,
    author: { did: actor },
    record: { text: "A post", createdAt: date },
    ...additions,
  },
})

test("only own original posts, newest first, regardless of pins and duplicates", () => {
  const old = entry("old", "2026-08-01T12:00:00Z")
  const recent = entry("recent", "2026-09-12T12:00:00Z")
  const feed = [
    { ...old, reason: { $type: "app.bsky.feed.defs#reasonPin" } },
    entry("someone-else", "2026-09-13T12:00:00Z", { author: { did: "did:plc:someone" } }),
    entry("reply", "2026-09-13T12:00:00Z", {
      record: { text: "Reply", createdAt: "2026-09-13T12:00:00Z", reply: {} },
    }),
    {
      ...entry("repost", "2026-09-13T12:00:00Z"),
      reason: { $type: "app.bsky.feed.defs#reasonRepost" },
    },
    recent,
    recent,
    entry("bad-date", "invalid"),
    entry("bad-uri", "2026-09-13T12:00:00Z", { uri: "javascript:alert(1)" }),
  ]
  assert.deepEqual(
    selectPosts(feed, actor).map((post) => post.uri.split("/").at(-1)),
    ["recent", "old"],
  )
  assert.equal(selectPosts(feed, actor, 1).length, 1)
  assert.deepEqual(selectPosts([], actor), [])
})

test("rich-text offsets preserve emoji, accents, and link labels", () => {
  const prefix = "Grüezi 👋 "
  const label = "hier"
  const text = `${prefix}${label} & mehr`
  const start = new TextEncoder().encode(prefix).length
  const facets = [
    {
      index: { byteStart: start, byteEnd: start + label.length },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://example.com/post" }],
    },
  ]
  assert.deepEqual(richTextParts(text, facets), [
    { text: prefix },
    { text: label, href: "https://example.com/post" },
    { text: " & mehr" },
  ])
})

test("unsafe URLs and invalid or overlapping facets leave text intact", () => {
  const text = "👋 <script>alert(1)</script>"
  const length = new TextEncoder().encode(text).length
  const facet = (start, end, uri) => ({
    index: { byteStart: start, byteEnd: end },
    features: [{ $type: "app.bsky.richtext.facet#link", uri }],
  })
  const parts = richTextParts(text, [
    facet(0, length, "javascript:alert(1)"),
    facet(1, 3, "https://example.com/split-emoji"),
    facet(0, 4, "https://example.com/valid"),
    facet(2, 8, "https://example.com/overlap"),
    facet(20, 1000, "https://example.com/outside"),
  ])
  assert.equal(parts.map((part) => part.text).join(""), text)
  assert.deepEqual(
    parts.filter((part) => part.href).map((part) => part.href),
    ["https://example.com/valid"],
  )
  for (const url of ["javascript:alert(1)", "data:text/html,test", "/relative", undefined])
    assert.equal(safeUrl(url), null)
})

test("post permalinks stay on W Social and reject unrelated record types", () => {
  assert.equal(
    postUrl(`at://${actor}/app.bsky.feed.post/3abc`),
    "https://wsocial.eu/profile/did%3Aplc%3Aexample/post/3abc",
  )
  assert.equal(postUrl(`at://${actor}/app.bsky.graph.follow/3abc`), null)
  assert.equal(postUrl("https://example.com"), null)
})
