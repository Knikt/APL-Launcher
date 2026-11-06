"""Build the exact private-font and Home Assistant overlays used by packaging.

Pangram binaries remain in ignored .local/ storage. A public checkout ships
Manrope, Geist and Newsreader. Complete local Pangram pairs are added directly
to the widget ZIP; they are never copied into app/. The personal Home Assistant
client is likewise read from ignored .local/ha.js for private builds only.
"""
from pathlib import Path
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FONT_IDS = ['sf', 'geist', 'newsreader']
PRIVATE_FONTS = [
    {
        'id': 'montreal', 'family': 'Study Montreal', 'folder': 'neue-montreal',
        'files': [('PPNeueMontreal-Light.ttf', 300), ('PPNeueMontreal-Regular.ttf', 400)],
        'metrics': 'size-adjust:100.699301%;ascent-override:105.859722%;descent-override:29.791667%;line-gap-override:0%',
    },
    {
        'id': 'mori', 'family': 'Study Mori', 'folder': 'mori',
        'files': [('PPMori-Extralight.ttf', 200), ('PPMori-Regular.ttf', 400)],
        'metrics': 'size-adjust:102.857143%;ascent-override:103.638889%;descent-override:29.166667%;line-gap-override:0%',
    },
    {
        'id': 'pangram', 'family': 'Study Pangram', 'folder': 'pangram-sans',
        'files': [('PPPangramSans-Light.ttf', 300), ('PPPangramSans-Regular.ttf', 400)],
        'metrics': 'size-adjust:101.408451%;ascent-override:105.119444%;descent-override:29.583333%;line-gap-override:0%',
    },
]
# key, ignored local source, packaged path, public fallback already in app/
PRIVATE_BACKDROPS = [
    ('youtube', '.local/youtube-backdrop.jpg', 'assets/backdrops/youtube.jpg',
     'assets/backdrops/youtube.svg'),
    # The Home tile shows the set's own Home artwork enlarged; the public build
    # keeps CleanFrame's drawing of the same glyph.
    ('homecontrol', '.local/backdrops/home.jpg', 'assets/backdrops/home.jpg',
     'assets/backdrops/home.svg'),
]
# Official service artwork for the wide tvOS dock tiles. The public build ships
# an empty catalogue so it keeps CleanFrame's own drawn marks.
PRIVATE_TILES = [
    ('netflix', '.local/tiles/netflix.jpg', 'assets/tiles/netflix.jpg'),
    ('youtube', '.local/tiles/youtube.jpg', 'assets/tiles/youtube.jpg'),
    ('appletv', '.local/tiles/appletv.jpg', 'assets/tiles/appletv.jpg'),
    ('primevideo', '.local/tiles/primevideo.jpg', 'assets/tiles/primevideo.jpg'),
    ('hotstar', '.local/tiles/jiohotstar.jpg', 'assets/tiles/jiohotstar.jpg'),
    ('sonyliv', '.local/tiles/sonyliv.jpg', 'assets/tiles/sonyliv.jpg'),
    ('spotify', '.local/tiles/spotify.jpg', 'assets/tiles/spotify.jpg'),
    ('alexa', '.local/tiles/alexa.jpg', 'assets/tiles/alexa.jpg'),
    ('moonlight', '.local/tiles/moonlight.jpg', 'assets/tiles/moonlight.jpg'),
    ('nuviotv', '.local/tiles/nuviotv.jpg', 'assets/tiles/nuviotv.jpg'),
    ('stremio', '.local/tiles/stremio.jpg', 'assets/tiles/stremio.jpg'),
    ('internet', '.local/tiles/internet.jpg', 'assets/tiles/internet.jpg'),
    ('applemusic', '.local/tiles/applemusic.jpg', 'assets/tiles/applemusic.jpg'),
    ('youtubetv', '.local/tiles/youtubetv.jpg', 'assets/tiles/youtubetv.jpg'),
    ('youtubekids', '.local/tiles/youtubekids.jpg', 'assets/tiles/youtubekids.jpg'),
    ('samsungtvplus', '.local/tiles/samsungtvplus.jpg', 'assets/tiles/samsungtvplus.jpg'),
    ('tizentube', '.local/tiles/tizentube.jpg', 'assets/tiles/tizentube.jpg'),
    ('homecontrol', '.local/tiles/homecontrol.jpg', 'assets/tiles/homecontrol.jpg'),
    ('disneyplus', '.local/tiles/disneyplus.jpg', 'assets/tiles/disneyplus.jpg'),
    ('amazonmusic', '.local/tiles/amazonmusic.png', 'assets/tiles/amazonmusic.png'),
    ('appstore', '.local/tiles/appstore.png', 'assets/tiles/appstore.png'),
    ('arte', '.local/tiles/arte.png', 'assets/tiles/arte.png'),
    ('beinsports', '.local/tiles/beinsports.png', 'assets/tiles/beinsports.png'),
    ('canalplus', '.local/tiles/canalplus.png', 'assets/tiles/canalplus.png'),
    ('crunchyroll', '.local/tiles/crunchyroll.png', 'assets/tiles/crunchyroll.png'),
    ('dailymotion', '.local/tiles/dailymotion.png', 'assets/tiles/dailymotion.png'),
    ('dazn', '.local/tiles/dazn.png', 'assets/tiles/dazn.png'),
    ('deezer', '.local/tiles/deezer.png', 'assets/tiles/deezer.png'),
    ('emby', '.local/tiles/emby.png', 'assets/tiles/emby.png'),
    ('eurosport', '.local/tiles/eurosport.png', 'assets/tiles/eurosport.png'),
    ('franime', '.local/tiles/franime.png', 'assets/tiles/franime.png'),
    ('geforcenow', '.local/tiles/geforcenow.png', 'assets/tiles/geforcenow.png'),
    ('hbomax', '.local/tiles/hbomax.png', 'assets/tiles/hbomax.png'),
    ('jellyfin', '.local/tiles/jellyfin.png', 'assets/tiles/jellyfin.png'),
    ('jiohotstar', '.local/tiles/jiohotstar.png', 'assets/tiles/jiohotstar.png'),
    ('kodi', '.local/tiles/kodi.png', 'assets/tiles/kodi.png'),
    ('lequipe', '.local/tiles/lequipe.png', 'assets/tiles/lequipe.png'),
    ('ligue1', '.local/tiles/ligue1.png', 'assets/tiles/ligue1.png'),
    ('luna', '.local/tiles/luna.png', 'assets/tiles/luna.png'),
    ('m6plus', '.local/tiles/m6plus.png', 'assets/tiles/m6plus.png'),
    ('microsoft365', '.local/tiles/microsoft365.png', 'assets/tiles/microsoft365.png'),
    ('movix', '.local/tiles/movix.png', 'assets/tiles/movix.png'),
    ('mubi', '.local/tiles/mubi.png', 'assets/tiles/mubi.png'),
    ('netflix-debug', '.local/tiles/netflix-debug.png', 'assets/tiles/netflix-debug.png'),
    ('netflix-small', '.local/tiles/netflix-small.png', 'assets/tiles/netflix-small.png'),
    ('paramountplus', '.local/tiles/paramountplus.png', 'assets/tiles/paramountplus.png'),
    ('plex', '.local/tiles/plex.png', 'assets/tiles/plex.png'),
    ('plutotv', '.local/tiles/plutotv.png', 'assets/tiles/plutotv.png'),
    ('qobuz', '.local/tiles/qobuz.png', 'assets/tiles/qobuz.png'),
    ('rakutentv', '.local/tiles/rakutentv.png', 'assets/tiles/rakutentv.png'),
    ('rmcsport', '.local/tiles/rmcsport.png', 'assets/tiles/rmcsport.png'),
    ('settings', '.local/tiles/settings.png', 'assets/tiles/settings.png'),
    ('smartthings', '.local/tiles/smartthings.png', 'assets/tiles/smartthings.png'),
    ('steam', '.local/tiles/steam.png', 'assets/tiles/steam.png'),
    ('tf1plus', '.local/tiles/tf1plus.png', 'assets/tiles/tf1plus.png'),
    ('tidal', '.local/tiles/tidal.png', 'assets/tiles/tidal.png'),
    ('tiktok', '.local/tiles/tiktok.png', 'assets/tiles/tiktok.png'),
    ('twitch', '.local/tiles/twitch.png', 'assets/tiles/twitch.png'),
    ('vetro', '.local/tiles/vetro.png', 'assets/tiles/vetro.png'),
    ('vimeo', '.local/tiles/vimeo.png', 'assets/tiles/vimeo.png'),
    ('xbox', '.local/tiles/xbox.png', 'assets/tiles/xbox.png'),
    ('youtubemusic', '.local/tiles/youtubemusic.png', 'assets/tiles/youtubemusic.png'),
    ('zoom', '.local/tiles/zoom.png', 'assets/tiles/zoom.png'),
]


def is_runtime_source(name):
    """Keep retained rendering tools and legacy layout assets out of the widget."""
    if name in ['grid.css', 'optics.js']:
        return False
    if name.startswith(('assets/grid/', 'assets/vendor/')):
        return False
    return not re.fullmatch(r'assets/wallpapers/[^/]+-glass-\d+\.png', name)


def font_overlay(root=ROOT, include_private=True):
    """Return package-relative paths mapped to bytes or allowlisted font files."""
    sources = (root / '.local/research/font-candidates').resolve()
    assets = {}
    private_ids = []
    css = ['/* Local font overlay. Proprietary binaries are not part of app/. */']
    if include_private:
        for font in PRIVATE_FONTS:
            files = [(sources / font['folder'] / name).resolve() for name, _ in font['files']]
            # Exclude incomplete pairs and symlinks that leave the private font folder.
            if not all(path.is_relative_to(sources) and path.is_file() for path in files):
                continue
            private_ids.append(font['id'])
            for (name, weight), source in zip(font['files'], files):
                relative = font['folder'] + '/' + name
                assets['assets/private-fonts/' + relative] = source
                css.append("@font-face{font-family:'" + font['family'] + "';font-style:normal;"
                           'font-weight:' + str(weight) + ";src:url('private-fonts/" + relative + "') format('truetype');"
                           'font-display:block;' + font['metrics'] + '}')
        # Personal HA client, rooms and token stay in ignored .local/; the
        # public app/ha.js stub is used for public builds and previews.
        ha = (root / '.local/ha.js').resolve()
        ha_root = (root / '.local').resolve()
        if ha.is_relative_to(ha_root) and ha.is_file():
            assets['ha.js'] = ha
        # The assistant's Gemini key is personal in the same way: it is read
        # from ignored .local/ai.js and only ever travels inside a private
        # build, while the public checkout keeps the keyless stub in app/.
        ai = (root / '.local/ai.js').resolve()
        if ai.is_relative_to(ha_root) and ai.is_file():
            assets['ai.js'] = ai
    assets['assets/private-fonts.css'] = ('\n'.join(css) + '\n').encode()
    assets['assets/font-catalog.js'] = ('window.CleanFramePrivateFontIDs = '
                                       + json.dumps(private_ids + PUBLIC_FONT_IDS) + ';\n').encode()
    return assets


def backdrop_overlay(root=ROOT, include_private=True):
    """Return the bundled-backdrop catalogue and any private artwork files.

    Only the private build carries a locally derived service splash: it is a
    screenshot of another company's artwork and is not ours to redistribute.
    The public build keeps the original CleanFrame drawing named below.
    """
    local = (root / '.local').resolve()
    assets = {}
    chosen = {}
    for key, private_name, widget_name, public_url in PRIVATE_BACKDROPS:
        source = (root / private_name).resolve()
        if include_private and source.is_relative_to(local) and source.is_file():
            assets[widget_name] = source
            chosen[key] = widget_name
        else:
            chosen[key] = public_url
    assets['assets/backdrops/catalog.js'] = ('/* Generated by scripts/font_assets.py. */\n'
                                            'window.CleanFrameBundledBackdrops = '
                                            + json.dumps(chosen, sort_keys=True) + ';\n').encode()
    return assets


def tile_overlay(root=ROOT, include_private=True):
    """Return the dock-tile catalogue and any private service artwork.

    Official app icons are third-party trademarks and are not redistributed in
    the public build; its catalogue stays empty and the app draws its own marks.
    """
    local = (root / '.local').resolve()
    assets = {}
    chosen = {}
    for key, private_name, widget_name in PRIVATE_TILES:
        source = (root / private_name).resolve()
        if include_private and source.is_relative_to(local) and source.is_file():
            assets[widget_name] = source
            chosen[key] = widget_name
    assets['assets/tiles/catalog.js'] = ('/* Generated by scripts/font_assets.py. */\n'
                                        'window.CleanFrameAppTiles = '
                                        + json.dumps(chosen, sort_keys=True) + ';\n').encode()
    return assets


def write_widget_archive(output, root=ROOT, include_private=True, extra=None, exclude=None):
    """Create an unsigned archive without reading signing or device settings.

    `extra` adds or replaces package-relative entries with bytes or files. A
    build for a different television uses it for the machine profile, so one
    source tree serves both sets without either one's name being committed.
    `exclude` lists package-relative prefixes left out of this archive: a
    lighter build for a slower set drops artwork it never reads, and the files
    stay in the repository for the build that does.
    """
    dropped = tuple(exclude or ())
    app = root / 'app'
    overlay = font_overlay(root, include_private)
    overlay.update(backdrop_overlay(root, include_private))
    overlay.update(tile_overlay(root, include_private))
    if extra:
        overlay.update(extra)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, allowZip64=False) as package:
        for source in sorted(app.rglob('*')):
            if source.is_symlink():
                raise ValueError('Widget assets must be regular files, not symlinks: ' + str(source.relative_to(app)))
            if not source.is_file():
                continue
            name = source.relative_to(app).as_posix()
            if dropped and name.startswith(dropped):
                continue
            if name.startswith('assets/private-fonts/'):
                raise ValueError('Private font binaries must stay in .local/, not app/.')
            if name not in overlay and is_runtime_source(name):
                package.write(source, name)
        # The overlay is explicit: a Lite build drops the gallery from app/ and
        # then names the one wall it keeps, so these entries always go in.
        for name, source in sorted(overlay.items()):
            if isinstance(source, Path):
                package.write(source, name)
            else:
                package.writestr(name, source)

