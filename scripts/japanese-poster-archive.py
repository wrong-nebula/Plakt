"""Japanese poster archive: catalog open museum/community sources, then download images.

  python3 -I scripts/japanese-poster-archive.py catalog [--sources moma,vam,commons,japansearch,pgda] [--moma-csv PATH]
  python3 -I scripts/japanese-poster-archive.py download [--sources ...] [--limit N]
  python3 -I scripts/japanese-poster-archive.py gallery     # local browse page: output/japanese-posters/index.html

Writes output/japanese-posters/{catalog.json,dataset.json,images/<source>/...}. Every image host's
robots.txt is checked before downloading; disallowed files are recorded as failures, not fetched.
Image rights stay with their holders; see JAPANESE-POSTERS.md.
"""
import argparse, csv, datetime, hashlib, html, io, json, re, struct, sys, threading, time, unicodedata
import urllib.error, urllib.parse, urllib.request, urllib.robotparser
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

UA = 'PosterLab/1.0 (personal graphic-design research)'
ROOT = Path('output/japanese-posters')
RAW = ROOT / 'raw'
SOURCES = ['moma', 'vam', 'commons', 'japansearch', 'pgda']
OPTIONAL = ['flickr']  # needs FLICKR_API_KEY in the environment
ALL_SOURCES = SOURCES + OPTIONAL
PRINT_MEDIA = ['offset', 'screen', 'silkscreen', 'lithograph', 'letterpress', 'print', 'paper', 'gravure']

# Designers searched by name where a source has no reliable "made in Japan" filter (V&A).
DESIGNERS = [
    'Hisui Sugiura', 'Ayao Yamana', 'Hiromu Hara', 'Takashi Kono', 'Yusaku Kamekura', 'Hiroshi Ohchi',
    'Yoshio Hayakawa', 'Ryuichi Yamashiro', 'Ikko Tanaka', 'Kazumasa Nagai', 'Shigeo Fukuda',
    'Tadanori Yokoo', 'Kiyoshi Awazu', 'Masuteru Aoba', 'Mitsuo Katsui', 'Kohei Sugiura',
    'Takenobu Igarashi', 'Makoto Saito', 'Shin Matsunaga', 'Koichi Sato', 'U. G. Sato', 'Katsumi Asaba',
    'Eiko Ishioka', 'Masayoshi Nakajo', 'Tsuguya Inoue', 'Takahisa Kamijyo', 'Shigeo Okamoto',
    'Akio Okumura', 'Kenya Hara', 'Taku Satoh', 'Kashiwa Sato', 'Hideki Nakajima', 'Kazunari Hattori',
    'Shinnoske Sugisaki', 'Ken Miki', 'Toshiyasu Nanbu', 'Norito Shinmura',
]

# Canonical "Given Family" names for grouping across sources' spellings ("Fukuda, Shigeo", "Fukuda Shigeo (福田繁雄)").
CANONICAL = DESIGNERS + [
    'Hokuu Tada', 'Yumeji Takehisa', 'Keiichi Tanaami', 'Mitsuhiro Kushida', 'Seiichi Hayashi', 'Isao Nishijima',
    'Akihiko Tsukamoto', 'Shichiro Imatake', 'Hiroyuki Tazawa', 'Takao Yamada', 'Masatoshi Toda', 'Munetsugu Satomi',
    'Yumiko Yokoyama', 'Aijiro Wakita', 'Akira Inada', 'Tamotsu Arikawa', 'Kenjiro Sano', 'Yuni Yoshida',
]

_last = {}
_lock = threading.Lock()


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s or '').lower() if c.isalnum())


def strip_tags(s):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', str(s or '')))).strip()


def fetch(url, delay=1.0, timeout=60, headers=None, attempts=4):
    """GET with a per-host minimum interval and retry/backoff on transient errors."""
    host = urllib.parse.urlsplit(url).netloc
    for attempt in range(attempts):
        with _lock:
            wait = _last.get(host, 0) + delay - time.monotonic()
            _last[host] = time.monotonic() + max(wait, 0)
        if wait > 0:
            time.sleep(wait)
        try:
            request = urllib.request.Request(url, headers={'User-Agent': UA, **(headers or {})})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read(), response.headers.get('content-type', '')
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == attempts - 1:
                raise
            retry_after = error.headers.get('Retry-After', '')
            if error.code == 429:
                # Back off hard on rate limits and space this request's remaining retries further apart.
                time.sleep(max(int(retry_after) if retry_after.isdigit() else 0, 30 * (attempt + 1)))
                delay *= 2
                continue
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == attempts - 1:
                raise
        time.sleep(3 * (attempt + 1))


def fetch_json(url, **kw):
    return json.loads(fetch(url, **kw)[0])


def record(source, sid, **fields):
    return {'id': f'{source}-{sid}', 'source': source, **fields}


def canonical_designers(credit):
    """Known designers named in a free-text credit, as canonical names (every name part as a whole word, any order)."""
    words, initials = set(), ''
    for token in [norm(t) for t in re.split(r'[\s,/()·;:&]+', credit or '')] + ['']:
        if len(token) == 1:
            initials += token  # "U. G. Sato" → "ug"
            continue
        if initials:
            words.add(initials)
            initials = ''
        if token:
            words.add(token)
    found = []
    for name in CANONICAL:
        parts = re.sub(r'\b(\w)\.\s*(?=\w\.)', r'\1', name).replace('.', '').split()
        if all(norm(p) in words for p in parts) and name not in found:
            found.append(name)
    return found


# ---------------------------------------------------------------- MoMA (CC0 catalog CSV)

def catalog_moma(args):
    path = Path(args.moma_csv) if args.moma_csv else RAW / 'moma-Artworks.csv'
    if not path.exists():
        print('Downloading MoMA Artworks.csv …', flush=True)
        data, _ = fetch('https://media.githubusercontent.com/media/MuseumofModernArt/collection/main/Artworks.csv', timeout=300)
        path.write_bytes(data)
    rows = [r for r in csv.DictReader(open(path, encoding='utf-8-sig', newline=''))
            if 'Japanese' in r['Nationality'] and r['ImageURL']]
    printed = lambda r: any(t in r['Medium'].lower() for t in PRINT_MEDIA)
    design = [r for r in rows if r['Classification'] in ('Design', 'Graphic Design') and printed(r)]
    designers = {r['Artist'] for r in design}
    # Prints by the same graphic designers (Yokoo, Tanaka … silkscreen posters are often filed as Print).
    prints = [r for r in rows if r['Classification'] == 'Print' and r['Artist'] in designers and printed(r)]
    out = []
    for r in design + prints:
        out.append(record('moma', r['ObjectID'], title=r['Title'], designer=r['Artist'], designerBio=r['ArtistBio'],
                          date=r['Date'], medium=r['Medium'], dimensions=r['Dimensions'],
                          objectType=r['Classification'], credit=r['CreditLine'], accession=r['AccessionNumber'],
                          institution='The Museum of Modern Art', recordURL=r['URL'], imageURL=r['ImageURL'],
                          metadataLicense='CC0 (MoMA collection data)',
                          imageRights='Artwork/image rights are separate from the CC0 metadata; personal research only.'))
    return out


# ---------------------------------------------------------------- V&A (API v2 + IIIF)

JAPAN_PLACE = re.compile(r'Japan|Tokyo|Osaka|Kyoto|Kobe|Nagoya|Yokohama|Sapporo|Hiroshima|Fukuoka|Nara|Aomori|Yamagata', re.I)


def catalog_vam(args):
    base = 'https://api.vam.ac.uk/v2/objects/search?'
    queries = [('place:Japan', {'id_place': 'x29399', 'q_object_type': 'poster'})]
    queries += [(f'actor:{name}', {'q_actor': name, 'q_object_type': 'poster'}) for name in sorted(set(DESIGNERS))]
    seen, out = set(), []
    for label, query in queries:
        page = 1
        while True:
            params = {**query, 'images_exist': 1, 'page_size': 100, 'page': page}
            data = fetch_json(base + urllib.parse.urlencode(params), delay=0.5)
            matches = 0
            for r in data['records']:
                maker = (r.get('_primaryMaker') or {}).get('name') or ''
                if label.startswith('actor:'):
                    # q_actor and q_object_type only rank (everything is returned): the maker must be this designer.
                    if label[6:] not in canonical_designers(maker):
                        continue
                    matches += 1
                elif not JAPAN_PLACE.search(r.get('_primaryPlace') or 'Japan'):
                    continue  # posters about Japan made elsewhere (e.g. British Hiroshima Day posters)
                if 'poster' not in (r.get('objectType') or '').lower():
                    continue
                if r['systemNumber'] in seen or not r['_images'].get('_iiif_image_base_url'):
                    continue
                seen.add(r['systemNumber'])
                out.append(record('vam', r['systemNumber'], title=r.get('_primaryTitle') or r.get('objectType'),
                                  designer=maker, date=r.get('_primaryDate'), objectType=r.get('objectType'),
                                  accession=r.get('accessionNumber'), place=r.get('_primaryPlace'),
                                  institution='Victoria and Albert Museum', matchedBy=label,
                                  recordURL=f"https://collections.vam.ac.uk/item/{r['systemNumber']}/",
                                  iiifBase=r['_images']['_iiif_image_base_url'],
                                  imageResolution=r['_images'].get('imageResolution'),
                                  imageRights='© Victoria and Albert Museum, London; V&A permits non-commercial personal/educational use.'))
            # Relevance-ranked: stop at the first page without a matching maker.
            if page >= data['info']['pages'] or not matches:
                break
            page += 1
        print(f'  V&A {label}: {len(out)} total', flush=True)
    return out


# ---------------------------------------------------------------- Wikimedia Commons (free-licensed files)

COMMONS_API = 'https://commons.wikimedia.org/w/api.php?'
COMMONS_SKIP = re.compile(r'by location|wanted posters|posters in |logos|poster boards|in the streets', re.I)
POSTER_WORD = re.compile(r'poster|ポスター|affiche|plakat', re.I)
THUMB_WIDTHS = [1920, 1280, 960, 500, 330]


def commons(params):
    return fetch_json(COMMONS_API + urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2}),
                      delay=1.2, attempts=6)


def catalog_commons(args, root='Category:Posters of Japan', max_depth=4):
    cache = RAW / 'commons-files.json'  # the category walk is slow; reuse it on retries
    files, seen_cats, queue = {}, {root}, [(root, 0, root)]
    if cache.exists():
        files, queue = json.loads(cache.read_text()), []
    while queue:
        category, depth, trail = queue.pop(0)
        cont = {}
        while True:
            data = commons({'action': 'query', 'list': 'categorymembers', 'cmtitle': category, 'cmlimit': 500,
                            'cmtype': 'file|subcat', **cont})
            for m in data['query']['categorymembers']:
                if m['ns'] == 6:
                    files.setdefault(m['title'], trail)
                elif m['ns'] == 14 and depth < max_depth and m['title'] not in seen_cats and not COMMONS_SKIP.search(m['title']):
                    seen_cats.add(m['title'])
                    queue.append((m['title'], depth + 1, f"{trail} › {m['title'][9:]}"))
            if 'continue' not in data:
                break
            cont = data['continue']
    cache.write_text(json.dumps(files, ensure_ascii=False))
    print(f'  Commons: {len(files)} files in {len(seen_cats)} categories', flush=True)
    # Artist categories also hold paintings, prints and portraits: keep only files named as posters there.
    titles = [t for t in files if 'Poster artists from Japan' not in files[t] or POSTER_WORD.search(t)]
    infos, out = {}, []
    for i in range(0, len(titles), 20):  # percent-encoded Japanese titles overflow the URL limit at 50
        data = commons({'action': 'query', 'prop': 'imageinfo', 'titles': '|'.join(titles[i:i + 20]),
                        'iiprop': 'url|size|mime|extmetadata|sha1'})
        for page in data['query']['pages']:
            info = (page.get('imageinfo') or [None])[0]
            if info and info['mime'] in ('image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/gif') and max(info['width'], info['height']) >= 500:
                infos[page['title']] = (page, info)
    # Wikimedia asks automated clients for thumbnails at standard widths, not originals
    # (https://www.mediawiki.org/wiki/Common_thumbnail_sizes): take the largest that fits.
    by_width = {}
    for title, (page, info) in infos.items():
        by_width.setdefault(max([w for w in THUMB_WIDTHS if w <= info['width']] or [THUMB_WIDTHS[-1]]), []).append(title)
    thumbs = {}
    for width, group in by_width.items():
        for i in range(0, len(group), 20):
            data = commons({'action': 'query', 'prop': 'imageinfo', 'titles': '|'.join(group[i:i + 20]), 'iiprop': 'url', 'iiurlwidth': width})
            for page in data['query']['pages']:
                if page.get('imageinfo'):
                    thumbs[page['title']] = page['imageinfo'][0].get('thumburl')
    for title, (page, info) in infos.items():
        if not thumbs.get(title):
            continue
        meta = {k: strip_tags(v.get('value', '')) for k, v in (info.get('extmetadata') or {}).items()}
        out.append(record('commons', page['pageid'],
                          title=meta.get('ObjectName') or page['title'][5:].rsplit('.', 1)[0],
                          designer=meta.get('Artist'), date=meta.get('DateTimeOriginal') or meta.get('DateTime'),
                          description=meta.get('ImageDescription', '')[:600], categoryTrail=files[page['title']],
                          institution=meta.get('Credit', '')[:200] or None, recordURL=info['descriptionurl'],
                          imageURL=thumbs[title], license=meta.get('LicenseShortName'), licenseURL=meta.get('LicenseUrl'),
                          sourceSHA1=info['sha1'], width=info['width'], height=info['height']))
    print(f'  Commons: {len(out)} poster files kept of {len(files)} ({len(files) - len(titles)} artist-category files without "poster" in the name)', flush=True)
    return out


# ---------------------------------------------------------------- Japan Search (documented 簡易Web API; open-licensed posters only)

def catalog_japansearch(args):
    out, seen = [], set()
    base = 'https://jpsearch.go.jp/api/item/search/jps-cross?'
    for rights in ['pdm', 'cc0', 'ccby', 'ccbysa']:
        start = 0
        while True:
            data = fetch_json(base + urllib.parse.urlencode({'f-type': 'poster', 'f-rights': rights, 'f-contents': 'image',
                                                             'size': 100, 'from': start}), delay=2.0)
            for item in data.get('list', []):
                c = item['common']
                if c['id'] in seen or not c.get('contentsUrl'):
                    continue
                seen.add(c['id'])
                out.append(record('japansearch', c['id'], title=c.get('title'),
                                  designer='; '.join(c.get('contributor') or []) or None,
                                  date='; '.join(c.get('temporal') or []) or None, description=(c.get('description') or '')[:600],
                                  institution=c.get('ownerOrg'), database=c.get('database'), recordURL=c.get('linkUrl'),
                                  japanSearchURL=f"https://jpsearch.go.jp/item/{c['id']}", imageURL=c['contentsUrl'][0],
                                  license={'pdm': 'Public Domain Mark', 'cc0': 'CC0', 'ccby': 'CC BY', 'ccbysa': 'CC BY-SA'}[rights]))
            start += 100
            if start >= data.get('hit', 0) or not data.get('list'):
                break
        print(f'  Japan Search {rights}: {len(out)} total', flush=True)
    return out


# ---------------------------------------------------------------- People's Graphic Design Archive (Japan locations, posters)

PGDA = 'https://peoplesgdarchive.org'


PGDA_ROLE = re.compile(r'^(?:(?:Graphic |Creative |Art )?(?:Designer|Director)|Artist|Illustrator|Photographer|Copywriter|'
                       r'Typographer|Calligrapher|Printer|Editor|Author|Producer|Writer|Graphic|Other)\b\s*', re.I)


def pgda_credits(text):
    """'Tadanori Yokoo \xa0 43 Artist Kenji Ito \xa0 2 Designer' → [{'name':…, 'role':…}, …]."""
    parts = re.split(r'\s*\xa0\s*\d*\s*', text or '')
    names, roles = [parts[0]], []
    for part in parts[1:]:
        role = PGDA_ROLE.match(part)
        roles.append(role.group(0).strip() if role else '')
        names.append(part[role.end():] if role else part)
    return [{'name': n.strip(), 'role': r} for n, r in zip(names, roles + ['']) if n.strip()]


def pgda_field(text, label, nxt):
    m = re.search(rf'\b{label}\s+(.*?)\s+(?:{nxt})\b', text)
    return re.sub(r'\s+\d+$', '', m.group(1)).strip() if m else None


def catalog_pgda(args):
    items = {}
    for location in ['/location/114/japan', '/location/442119/tokyo']:
        for page in range(1, 200):
            body = fetch(f'{PGDA}{location}?page={page}')[0].decode('utf-8', 'ignore')
            found = dict(re.findall(r'/item/(\d+)/([a-z0-9-]+)', body))
            new = {k: v for k, v in found.items() if k not in items}
            items.update(new)
            if not new:
                break
        print(f'  PGDA {location}: {len(items)} items', flush=True)
    out, skipped = [], 0
    cache = RAW / 'pgda-items.json'
    pages = json.loads(cache.read_text()) if cache.exists() else {}
    for n, (item_id, slug) in enumerate(sorted(items.items(), key=lambda x: int(x[0]))):
        if item_id not in pages:
            body = fetch(f'{PGDA}/item/{item_id}/{slug}')[0].decode('utf-8', 'ignore')
            meta = dict(re.findall(r'<meta property="og:(\w+)" content="([^"]*)"', body))
            body = re.sub(r'(?s)<(script|style).*?</\1>', '', body)
            text = strip_tags(body)
            pages[item_id] = {'meta': meta, 'formats': re.findall(r'href="/format/\d+/([a-z0-9-]+)"', body),
                              'date': pgda_field(text, 'Date', 'Credits|Format|Clients|Locations'),
                              'credits': pgda_field(text, 'Credits', 'Format|Clients|Locations|Links'),
                              'clients': pgda_field(text, 'Clients', 'Locations|Links|Tags'),
                              'tags': re.findall(r'href="/tag/\d+/([a-z0-9-]+)"', body)}
            if n % 25 == 0:
                cache.write_text(json.dumps(pages, ensure_ascii=False))
                print(f'  PGDA items {n + 1}/{len(items)}', flush=True)
        p = pages[item_id]
        image = p['meta'].get('image', '')
        if not any(f in ('poster', 'posters') for f in p['formats']) or 'fit-512x512' not in image:
            skipped += 1
            continue
        credits = pgda_credits(p['credits'])
        out.append(record('pgda', item_id, title=html.unescape(p['meta'].get('title', slug)),
                          designer='; '.join(c['name'] for c in credits) or None, credits=credits, date=p['date'],
                          client=p['clients'], description=html.unescape(p['meta'].get('description', ''))[:600],
                          tags=p['tags'], recordURL=p['meta'].get('url') or f'{PGDA}/item/{item_id}/{slug}',
                          imageURL=image.replace('fit-512x512', 'fit-1600x1600'), institution="People's Graphic Design Archive",
                          imageRights='PGDA: non-commercial educational/research use; rights remain with the holders.'))
    cache.write_text(json.dumps(pages, ensure_ascii=False))
    print(f'  PGDA: {len(out)} posters, {skipped} non-poster items skipped', flush=True)
    return out


# ---------------------------------------------------------------- Flickr albums (official API; opt-in)

FLICKR_ALBUMS = [  # (owner path alias, album id) — collector uploads of Japanese graphic design
    ('xendaths', '72157640338783835'),               # Vintage Japanese Graphic Design, 1920s–30s
    ('sandiv999', '72157624602034987'),              # Vintage Japan Illustrations, 1930s–70s
    ('japanese-movie-posters', '72157614318017928'), # Japanese movie posters (original theatrical)
    ('pinkponk', '72157600267969060'),               # 1950s–1970s Advertising (many Yokoo; mixed)
    ('nerdcoreblog', '72157628246543997'),           # Vintage Japanese Advertising (Misc)
]


def catalog_flickr(args):
    import os
    key = os.environ.get('FLICKR_API_KEY')
    if not key:
        sys.exit('flickr: set FLICKR_API_KEY (free key from https://www.flickr.com/services/apps/create/)')
    api = lambda method, **p: fetch_json('https://api.flickr.com/services/rest/?' + urllib.parse.urlencode(
        {'method': method, 'api_key': key, 'format': 'json', 'nojsoncallback': 1, **p}), delay=1.0)
    licenses = {str(l['id']): l['name'] for l in api('flickr.photos.licenses.getInfo')['licenses']['license']}
    albums = [tuple(a.split('/')) for a in args.flickr_albums.split(',')] if args.flickr_albums else FLICKR_ALBUMS
    out = []
    for owner, album in albums:
        nsid = api('flickr.urls.lookupUser', url=f'https://www.flickr.com/photos/{owner}/')['user']['id']
        page = 1
        while True:
            data = api('flickr.photosets.getPhotos', photoset_id=album, user_id=nsid, per_page=500, page=page,
                       extras='license,owner_name,date_taken,description,url_o,url_k,url_h,url_l')['photoset']
            for p in data['photo']:
                url = next((p[k] for k in ('url_o', 'url_k', 'url_h', 'url_l') if p.get(k)), None)
                if not url:
                    continue
                out.append(record('flickr', p['id'], title=p.get('title'), uploader=data.get('ownername'),
                                  description=strip_tags((p.get('description') or {}).get('_content', ''))[:600],
                                  date=p.get('datetaken'), album=f"{data.get('title')} ({album})",
                                  recordURL=f"https://www.flickr.com/photos/{owner}/{p['id']}/", imageURL=url,
                                  license=licenses.get(str(p.get('license')), str(p.get('license'))),
                                  imageRights='Uploader photo/scan of a poster; poster rights remain with the designer.'))
            if page >= int(data['pages']):
                break
            page += 1
        print(f'  Flickr {owner}/{album}: {len(out)} total', flush=True)
    return out


# ---------------------------------------------------------------- download

_robots, _robots_lock = {}, threading.Lock()


def robots_rules(origin):
    """robots.txt lines for an origin; None when the server errors instead of serving one."""
    try:
        return fetch(origin + '/robots.txt', delay=0.2, timeout=20, attempts=2)[0].decode('utf-8', 'ignore').splitlines()
    except urllib.error.HTTPError as error:
        return [] if error.code in (401, 403, 404, 410) else None
    except Exception:
        return None


def allowed(url):
    parts = urllib.parse.urlsplit(url)
    origin = f'{parts.scheme}://{parts.netloc}'
    with _robots_lock:
        parser = _robots.get(origin)
        if parser is None:
            rules = robots_rules(origin)
            if rules is None and parts.netloc.count('.') >= 2:
                # Image CDNs (e.g. thumbs.peoplesgdarchive.org) can error on /robots.txt; use the parent site's rules.
                rules = robots_rules(f"{parts.scheme}://{parts.netloc.split('.', 1)[1]}")
            parser = urllib.robotparser.RobotFileParser()
            parser.parse(['User-agent: *', 'Disallow: /'] if rules is None else rules)
            _robots[origin] = parser
    return parser.can_fetch(UA, url)


def image_size(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', data[16:24])
    if data[:2] == b'\xff\xd8':
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker, length = data[i + 1], struct.unpack('>H', data[i + 2:i + 4])[0]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack('>HH', data[i + 5:i + 9])
                return w, h
            i += 2 + length
    return None, None


EXT = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/tiff': 'tif'}
DELAY = {'moma': 0.3, 'vam': 0.5, 'commons': 1.5, 'japansearch': 1.5, 'pgda': 1.0, 'flickr': 0.5}


def image_url(work):
    if 'iiifBase' not in work:
        return work['imageURL']
    info = fetch_json(work['iiifBase'] + 'info.json', delay=DELAY['vam'])
    region = 'full/!2400,2400' if max(info['width'], info['height']) > 2400 else 'full/full'
    return f"{work['iiifBase']}{region}/0/default.jpg"


def download_one(work):
    folder = ROOT / 'images' / work['source']
    existing = list(folder.glob(f"{work['id']}.*"))
    if existing:
        data = existing[0].read_bytes()
        return {**work, 'localPath': str(existing[0]), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                **dict(zip(('pixelWidth', 'pixelHeight'), image_size(data)))}
    url = image_url(work)
    if not allowed(url):
        raise RuntimeError(f'robots.txt disallows {url}')
    data, kind = fetch(url, delay=DELAY.get(work['source'], 1.0), timeout=90)
    kind = kind.split(';')[0].strip()
    if kind not in EXT:
        raise RuntimeError(f'not an image ({kind or "no content-type"})')
    if len(data) < 2000:
        raise RuntimeError('image too small')
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{work['id']}.{EXT[kind]}"
    path.write_bytes(data)
    w, h = image_size(data)
    return {**work, 'downloadedFrom': url, 'localPath': str(path), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest(), 'pixelWidth': w, 'pixelHeight': h}


def download(args):
    catalog = json.loads((ROOT / 'catalog.json').read_text())
    works = [w for w in catalog['works'] if w['source'] in args.sources][:args.limit or None]
    done, failures, lock = [], [], threading.Lock()

    def run(group):
        refusals = {}  # consecutive 403s per host; a host that keeps refusing is not asked again
        for work in group:
            host = urllib.parse.urlsplit(work.get('imageURL') or work.get('iiifBase', '')).netloc
            try:
                if refusals.get(host, 0) >= 5 and not any((ROOT / 'images' / work['source']).glob(f"{work['id']}.*")):
                    raise RuntimeError(f'{host} refuses automated requests (HTTP 403); not retried')
                result = download_one(work)
                refusals[host] = 0
                with lock:
                    done.append(result)
            except Exception as error:
                if isinstance(error, urllib.error.HTTPError) and error.code == 403:
                    refusals[host] = refusals.get(host, 0) + 1
                with lock:
                    failures.append({'id': work['id'], 'source': work['source'], 'recordURL': work.get('recordURL'),
                                     'error': f'{type(error).__name__}: {error}'[:300]})
            with lock:
                total = len(done) + len(failures)
                if total % 50 == 0:
                    print(f'{total}/{len(works)}: {len(done)} downloaded · {len(failures)} failures', flush=True)

    groups = {}
    for work in works:
        groups.setdefault(work['source'], []).append(work)
    with ThreadPoolExecutor(len(groups) or 1) as pool:
        list(pool.map(run, groups.values()))
    # Keep earlier runs' results for sources not downloaded in this run.
    if (ROOT / 'dataset.json').exists():
        old = json.loads((ROOT / 'dataset.json').read_text())
        done += [w for w in old['works'] if w['source'] not in args.sources]
        failures += [f for f in old['failures'] if f['source'] not in args.sources]
    by_hash = {}
    for w in done:
        w.pop('duplicateOf', None)
    for w in sorted(done, key=lambda w: (ALL_SOURCES.index(w['source']), w['id'])):
        if w['sha256'] in by_hash:
            w['duplicateOf'] = by_hash[w['sha256']]
        else:
            by_hash[w['sha256']] = w['id']
    dataset = {'version': 'japanese-posters-v1', 'downloadedAt': now(), 'userAgent': UA,
               'counts': {s: sum(w['source'] == s for w in done) for s in ALL_SOURCES},
               'works': sorted(done, key=lambda w: w['id']), 'failures': failures}
    (ROOT / 'dataset.json').write_text(json.dumps(dataset, indent=1, ensure_ascii=False))
    print(f'Complete: {len(done)} images, {len(failures)} failures,', sum('duplicateOf' in w for w in done), 'exact duplicates')


GALLERY = """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Japanese poster archive</title>
<style>
:root{--bg:#f4f2ee;--fg:#1b1b1b;--muted:#6b6862;--card:#fff;--line:#dedad3}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--fg:#ece9e4;--muted:#9a968f;--card:#1d1d1d;--line:#333}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 -apple-system,system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
h1{font-size:16px;margin:0 12px 0 0}input,select{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg)}
input{flex:1;min-width:160px}#count{color:var(--muted)}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;padding:16px}
a.card{display:block;color:inherit;text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
a.card img{display:block;width:100%;aspect-ratio:3/4;object-fit:contain;background:var(--line)}
.meta{padding:8px}.t{font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.d{color:var(--muted);font-size:12px;margin-top:2px}
</style>
<header><h1>Japanese poster archive</h1><input id="q" type="search" placeholder="Search title, designer, date…"><select id="src"></select><select id="who"></select><span id="count"></span></header>
<main id="grid"></main>
<script>
const works=__DATA__;
const q=document.getElementById('q'),src=document.getElementById('src'),who=document.getElementById('who'),grid=document.getElementById('grid'),count=document.getElementById('count');
const opts=(el,label,values)=>{el.innerHTML=`<option value="">${label}</option>`+values.map(([v,n])=>`<option value="${v.replace(/"/g,'&quot;')}">${v} (${n})</option>`).join('')};
const tally=k=>Object.entries(works.reduce((a,w)=>(w[k]&&(a[w[k]]=(a[w[k]]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]);
opts(src,'All sources',tally('source'));opts(who,'All designers',tally('designer').filter(([,n])=>n>1));
const esc=s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function render(){const t=q.value.toLowerCase();const hits=works.filter(w=>(!src.value||w.source===src.value)&&(!who.value||w.designer===who.value)&&(!t||[w.title,w.designer,w.date].join(' ').toLowerCase().includes(t)));
count.textContent=`${hits.length} of ${works.length}`;
grid.innerHTML=hits.map(w=>`<a class="card" href="${esc(w.recordURL)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(w.img)}" alt=""><div class="meta"><div class="t">${esc(w.title)}</div><div class="d">${esc(w.designer)}${w.date?' · '+esc(w.date):''}</div><div class="d">${esc(w.source)}${w.license?' · '+esc(w.license):''}</div></div></a>`).join('')}
[q,src,who].forEach(el=>el.addEventListener('input',render));render();
</script></html>"""


def gallery(args):
    dataset = json.loads((ROOT / 'dataset.json').read_text())
    works = [{'img': str(Path(w['localPath']).relative_to(ROOT)), 'title': (w.get('title') or '')[:160],
              'designer': ', '.join(w.get('designers') or []) or (w.get('designer') or '')[:80],
              'date': (w.get('date') or '')[:40], 'source': w['source'],
              'license': w.get('license'), 'recordURL': w.get('recordURL')}
             for w in dataset['works'] if 'duplicateOf' not in w]
    data = json.dumps(works, ensure_ascii=False).replace('</', '<\\/')
    (ROOT / 'index.html').write_text(GALLERY.replace('__DATA__', data))
    print(f'Wrote {ROOT / "index.html"} with {len(works)} posters')


def catalog(args):
    # Each source keeps its own raw/catalog-<source>.json, so sources can be cataloged in parallel runs;
    # catalog.json is the merge. `catalog --sources ''` only re-merges.
    for source in args.sources:
        print(f'Cataloging {source} …', flush=True)
        found = globals()[f'catalog_{source}'](args)
        (RAW / f'catalog-{source}.json').write_text(json.dumps(found, indent=1, ensure_ascii=False))
        print(f'  {source}: {len(found)} works', flush=True)
    previous = {}
    if (ROOT / 'catalog.json').exists():
        for w in json.loads((ROOT / 'catalog.json').read_text())['works']:
            previous.setdefault(w['source'], []).append(w)
    works = []
    for source in ALL_SOURCES:
        path = RAW / f'catalog-{source}.json'
        works += json.loads(path.read_text()) if path.exists() else previous.get(source, [])
    for w in works:
        w['designers'] = canonical_designers(w.get('designer'))
    manifest = {'version': 'japanese-poster-catalog-v1', 'retrievedAt': now(), 'userAgent': UA,
                'counts': {s: sum(w['source'] == s for w in works) for s in ALL_SOURCES}, 'works': works}
    (ROOT / 'catalog.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    print('Catalog:', manifest['counts'], 'total', len(works))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['catalog', 'download', 'gallery'])
    parser.add_argument('--sources', default=','.join(SOURCES))
    parser.add_argument('--moma-csv')
    parser.add_argument('--flickr-albums', help='comma-separated owner/albumID pairs (default: FLICKR_ALBUMS)')
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()
    args.sources = [s for s in args.sources.split(',') if s]
    unknown = set(args.sources) - set(ALL_SOURCES)
    if unknown:
        sys.exit(f'Unknown sources: {", ".join(sorted(unknown))}')
    RAW.mkdir(parents=True, exist_ok=True)
    globals()[args.command](args)


if __name__ == '__main__':
    main()
