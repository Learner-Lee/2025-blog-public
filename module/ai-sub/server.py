"""AI-Sub public reader. Python standard library only; database is always read-only."""
from __future__ import annotations

from contextlib import closing
from datetime import datetime, timezone
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import os
from pathlib import Path
import sqlite3
import threading
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("AI_SUB_DB", "/storage/Project/ai-sub/data/releases.db"))
MAX_ITEMS = 5000
ASSETS = {"": ("index.html", "text/html; charset=utf-8"),
          "index.html": ("index.html", "text/html; charset=utf-8"),
          "app.js": ("app.js", "application/javascript; charset=utf-8"),
          "style.css": ("style.css", "text/css; charset=utf-8"),
          "cover.svg": ("cover.svg", "image/svg+xml")}


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1
        if tag in {"p", "br", "li", "div"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def clean(value, limit=12000):
    parser = PlainText()
    parser.feed(str(value or "")[:limit * 2])
    return unescape("\n".join(line.strip() for line in "".join(parser.parts).splitlines() if line.strip()))[:limit]


def read_feed(path: Path):
    # mode=ro deliberately fails if the file is missing; it never creates a database.
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=3)) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA query_only=ON")
        rows = conn.execute("""
            SELECT 'release' AS kind, source_id, vendor AS source, product,
                   title, title_zh, summary, summary_zh, url, published_date,
                   fetched_at, importance, category
            FROM seen_releases WHERE relevant = 1
            UNION ALL
            SELECT CASE WHEN notify_as = 'release' THEN 'release' ELSE 'blog' END,
                   source_id, blog_name, '', title, title_zh, summary, summary_zh,
                   url, published_date, fetched_at, importance,
                   COALESCE(NULLIF(ai_category, ''), category)
            FROM seen_blog_articles WHERE relevant = 1
            ORDER BY fetched_at DESC LIMIT ?
        """, (MAX_ITEMS + 1,)).fetchall()
    items = []
    for row in rows[:MAX_ITEMS]:
        item = dict(row)
        try:
            parts = urlsplit(str(item["url"] or ""))
        except ValueError:
            continue
        if parts.scheme not in {"http", "https"} or not parts.netloc or parts.username or parts.password:
            continue
        item["id"] = sha256((row["source_id"] + "|" + row["url"]).encode()).hexdigest()[:24]
        del item["source_id"]
        for key in ("source", "product", "title", "title_zh", "summary", "summary_zh", "category"):
            item[key] = clean(item[key], 12000 if "summary" in key else 500)
        if item["importance"] not in {"high", "medium", "low"}:
            item["importance"] = "low"
        items.append(item)
    return {"items": items, "generated_at": datetime.now(timezone.utc).isoformat(),
            "latest_fetched_at": max((x["fetched_at"] for x in items), default=None),
            "limit": MAX_ITEMS, "truncated": len(rows) > MAX_ITEMS}


class FeedCache:
    def __init__(self):
        self.lock = threading.Lock()
        self.expires = 0
        self.body = None

    def get(self):
        with self.lock:
            if self.body is None or time.monotonic() >= self.expires:
                self.body = json.dumps(read_feed(DB_PATH), ensure_ascii=False).encode()
                self.expires = time.monotonic() + 60
            return self.body


CACHE = FeedCache()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def respond(self, status, body, content_type="application/json; charset=utf-8", cache="no-cache"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/ai-sub":
            self.send_response(308)
            self.send_header("Location", "/ai-sub/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path == "/ai-sub/api/feed":
            try:
                self.respond(200, CACHE.get(), cache="public, max-age=60")
            except (sqlite3.Error, OSError, ValueError):
                logging.exception("Unable to read AI-Sub database")
                self.respond(503, b'{"error":"feed_unavailable"}', cache="no-store")
            return
        key = path.removeprefix("/ai-sub/") if path.startswith("/ai-sub/") else None
        if key in ASSETS:
            filename, content_type = ASSETS[key]
            try:
                self.respond(200, (ROOT / "public" / filename).read_bytes(), content_type)
            except OSError:
                self.respond(503, b'{"error":"asset_unavailable"}')
            return
        self.respond(404, b'{"error":"not_found"}')


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 32
    slots = threading.BoundedSemaphore(24)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    port = int(os.environ.get("PORT", "3032"))
    logging.info("AI-Sub reader: http://127.0.0.1:%s/ai-sub/", port)
    Server(("127.0.0.1", port), Handler).serve_forever()
