from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import json

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class ReaderTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db = Path(self.directory.name) / 'test.db'
        conn = sqlite3.connect(self.db)
        common = 'source_id TEXT, title TEXT, title_zh TEXT, summary TEXT, summary_zh TEXT, url TEXT, published_date TEXT, fetched_at TEXT, relevant INTEGER, importance TEXT, category TEXT'
        conn.execute('CREATE TABLE seen_releases (' + common + ', vendor TEXT, product TEXT)')
        conn.execute('CREATE TABLE seen_blog_articles (' + common + ', blog_name TEXT, ai_category TEXT, notify_as TEXT)')
        def insert(table, sid, url, relevant=1, **kwargs):
            value = dict(source_id=sid, title='<b>Original</b>', title_zh='中文标题', summary='<p>First</p><script>bad()</script><p>Second</p>', summary_zh='中文摘要', url=url, published_date=None, fetched_at='2026-11-17T01:00:00+00:00', relevant=relevant, importance='high', category='Model')
            value.update(kwargs)
            conn.execute('INSERT INTO '+table+' ('+','.join(value)+') VALUES ('+','.join('?' for _ in value)+')',list(value.values()))
        insert('seen_releases','public','https://example.com/a',vendor='Test',product='Model')
        insert('seen_releases','unrelated','https://example.com/no',relevant=0,vendor='Hidden')
        insert('seen_releases','badurl','javascript:alert(1)',vendor='Invalid')
        insert('seen_releases','brokenurl','http://[oops',vendor='Invalid')
        insert('seen_blog_articles','blog','https://example.com/blog',blog_name='Blog',ai_category='Agent',notify_as='blog')
        insert('seen_blog_articles','blog-release','https://example.com/release',blog_name='Official',ai_category='Tool',notify_as='release')
        conn.commit()
        conn.close()

    def tearDown(self):
        self.directory.cleanup()

    def test_only_relevant_safe_public_fields_and_no_database_changes(self):
        original = self.db.read_bytes()
        result = server.read_feed(self.db)
        self.assertEqual(len(result['items']), 3)
        self.assertEqual(self.db.read_bytes(), original)
        release = next(x for x in result['items'] if x['source'] == 'Test')
        self.assertEqual(release['summary'], 'First\nSecond')
        self.assertNotIn('source_id', release)
        self.assertEqual(len(release['id']), 24)
        self.assertEqual(next(x for x in result['items'] if x['source']=='Official')['kind'],'release')
        self.assertEqual(next(x for x in result['items'] if x['source']=='Blog')['category'],'Agent')

    def test_missing_database_is_never_created(self):
        target = Path(self.directory.name) / 'missing.db'
        with self.assertRaises(sqlite3.OperationalError):
            server.read_feed(target)
        self.assertFalse(target.exists())

    def test_http_routes_security_headers_and_failure(self):
        previous = server.DB_PATH
        server.DB_PATH = self.db
        server.CACHE = server.FeedCache()
        http = server.Server(('127.0.0.1',0),server.Handler)
        thread=threading.Thread(target=http.serve_forever,daemon=True)
        thread.start()
        base='http://127.0.0.1:'+str(http.server_port)
        try:
            with urllib.request.urlopen(base+'/ai-sub/api/feed?q=%27%20OR%201=1') as response:
                self.assertEqual(len(json.load(response)['items']),3)
                self.assertEqual(response.headers['X-Content-Type-Options'],'nosniff')
                self.assertIn("script-src 'self'",response.headers['Content-Security-Policy'])
            for path in ('/ai-sub/../../server.py','/ai-sub/.env','/ai-sub/api/write'):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(base+path)
                self.assertEqual(error.exception.code,404)
            req=urllib.request.Request(base+'/ai-sub/api/feed',data=b'{}',method='POST')
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(req)
            self.assertEqual(error.exception.code,501)
            server.DB_PATH=Path(self.directory.name)/'missing.db'
            server.CACHE=server.FeedCache()
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(base+'/ai-sub/api/feed')
            self.assertEqual(error.exception.code,503)
        finally:
            server.DB_PATH=previous
            server.CACHE=server.FeedCache()
            http.shutdown()
            http.server_close()


if __name__ == '__main__':
    unittest.main()
