#!/usr/bin/env python3
"""Static dev server with caching disabled — ES modules always revalidate.
Usage: python3 dev-server.py [port]  (serves the current working directory)"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8741


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print(f'serving {PORT} (no-cache)')
    http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler).serve_forever()
