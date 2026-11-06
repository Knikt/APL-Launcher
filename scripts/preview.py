"""Serve the actual TV UI and the retained design gallery on this Mac."""
import argparse
import io
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from font_assets import backdrop_overlay, font_overlay, tile_overlay

ROOT = Path(__file__).resolve().parents[1]


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


class Preview(SimpleHTTPRequestHandler):
    def send_head(self):
        route = unquote(urlsplit(self.path).path)
        # The Lite package carries `lite.js`; this injects the same line into the
        # preview's page so the reduced launcher can be looked at beside the full
        # one. Nothing in app/ is touched.
        if getattr(self.server, 'lite', False) and route in ('/home/', '/home/index.html'):
            html = (ROOT / 'app/index.html').read_text(encoding='utf-8')
            html = html.replace(
                '<script defer src="search.js"></script>',
                '<script defer src="lite.js"></script>\n<script defer src="search.js"></script>', 1)
            body = html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        # Generated package files (fonts, backdrops) are served from the same
        # overlay the widget build uses, so the preview matches the package.
        if route.startswith('/home/'):
            source = self.server.overlay.get(route[len('/home/'):])
            if source is not None:
                content = source.read_bytes() if isinstance(source, Path) else source
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(route))
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                return io.BytesIO(content)
        return super().send_head()

    def translate_path(self, path):
        route = urlsplit(path).path
        # Serve only the packaged UI and offline material-builder inputs.
        if route == '/' or route == '/home':
            return str(ROOT / 'app/index.html')
        if route.startswith('/home/'):
            self.directory = str(ROOT / 'app')
            return super().translate_path(route[5:])
        if route.startswith('/build/'):
            self.directory = str(ROOT / 'scripts/materials')
            return super().translate_path(route[6:])
        self.directory = str(ROOT / 'app')
        return super().translate_path(route)

    def do_GET(self):
        if urlsplit(self.path).path == '/':
            self.send_response(302)
            self.send_header('Location', '/home/')
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4795)
    parser.add_argument('--public-fonts', action='store_true', help='Use only the fonts distributed with the source')
    parser.add_argument('--lite', action='store_true', help='Serve the launcher as the Lite package sees it')
    args = parser.parse_args()
    server = PreviewServer(('127.0.0.1', args.port), Preview)
    server.lite = args.lite
    server.overlay = font_overlay(include_private=not args.public_fonts)
    if args.lite:
        server.overlay['lite.js'] = b'window.CleanFrameLite = true;\n'
    server.overlay.update(backdrop_overlay(include_private=not args.public_fonts))
    server.overlay.update(tile_overlay(include_private=not args.public_fonts))
    print('CleanFrame preview: http://127.0.0.1:' + str(server.server_port) + '/home/', flush=True)
    server.serve_forever()
