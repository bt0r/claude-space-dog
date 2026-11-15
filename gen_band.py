"""Dessine le teckel et ses accessoires en pixel art et les écrit dans hooks/sprites.ts.

Le mod (hooks/dog-svg.ts) compose ensuite les animations à la volée, en partant de la
position et de la direction du chien, pour que chaque animation reprenne là où la
précédente s'arrête. Le teckel est dessiné à 2 px par pixel, avec contour, ombre et
reflet ; les poses sont dérivées du sprite de marche.
"""
import json
import sys

out_path = sys.argv[1]

PX = 2
H = 34  # hauteur du bandeau en pixels
GROUND = H - 2  # bas des pattes

COLORS = {
    'o': '#100e17',  # contour
    'k': '#302a42',  # pelage noir
    's': '#221e30',  # ombre du ventre
    'h': '#5d5579',  # reflet du dos
    'e': '#1d1929',  # oreille
    't': '#cf9152',  # feu
    'd': '#9c6638',  # feu dans l'ombre
    'w': '#ece8ff',  # œil
    'c': '#5ec2ff',  # collier
    'g': '#ffe45c',  # médaille
    'O': '#9ef0c9',  # balle
    'U': '#5b5683',  # boîtier de la console
    'S': '#5ec2ff',  # écran
    'y': '#ffe45c',  # touches
    'B': '#ff7a90',  # gamelle
    'F': '#ffe45c',  # croquettes
    'R': '#ff7a90',  # borne à incendie
    'r': '#ffb3c0',  # reflet de la borne
    'Z': '#b8a6ff',  # Z du sommeil
    'l': '#4fae8a',  # feuille sombre
    'L': '#9ef0c9',  # feuille claire
    'P': '#e8798f',  # pot
    'p': '#ffb3c0',  # bord du pot
    'b': '#a97c55',  # osier
    'v': '#d4a574',  # osier clair
    'x': '#b8a6ff',  # coussin
    'X': '#d6ccff',  # reflet du coussin
    # Pit bull : gris bleuté, plastron blanc
    'A': '#7f8bab', 'a': '#5e6884', 'E': '#eeeaf6',
    # Berger allemand : feu et selle noire
    'G': '#c99650', 'j': '#9c7038', 'J': '#4b3f44',
    # Jack russell : blanc taché de marron
    'Q': '#f1eef8', 'q': '#c9c4da', 'M': '#8a5a3a',
    # Shiba : roux et crème
    'H': '#e08a4a', 'I': '#b8683a', 'V': '#f6e3c3',
}

BODY = [
    "........................oooo......",
    ".......................ohhkko.....",
    ".......................ohkkkkooo..",
    ".......................okkwokkkko.",
    "......................oekkkkttttoo",
    "oo....................oeektttttto.",
    "oho...................oeeokdttoo..",
    ".oko.oooooooooooooooooceeokoo.....",
    "..okohhhhhhhhhhhhhhhhhcgkkko......",
    "...okkkkkkkkkkkkkkkkkkkkkkto......",
    "...oskkkkkkkkkkkkkkkkkkkkdto......",
    "...ossssssssssssssssssssstto......",
]
LEGS_A = [
    "...odo..odo..........odo..odo.....",
    "...ott..ott..........ott..ott.....",
    "...ooo..ooo..........ooo..ooo.....",
]
LEGS_B = [
    ".....odoodo..........odoodo.......",
    ".....ottott..........ottott.......",
    ".....oooooo..........oooooo.......",
]
WALK_A = BODY + LEGS_A
WALK_B = BODY + LEGS_B
HEAD_COL = 22  # colonnes de la tête et du cou


def grid(sprite):
    return [list(r) for r in sprite]


def text(g):
    return [''.join(r) for r in g]


def put(sprite, points, ch):
    g = grid(sprite)
    for y, x in points:
        g[y][x] = ch
    return text(g)


def head_down(sprite, dy):
    """Baisse la tête (colonnes ≥ HEAD_COL, lignes 0-7) de `dy` lignes, par-dessus le corps."""
    g = grid(sprite)
    head = [(y, x, g[y][x]) for y in range(8) for x in range(HEAD_COL, len(g[0])) if g[y][x] != '.']
    for y, x, _ in head:
        g[y][x] = '.'
    for y, x, ch in head:
        g[y + dy][x] = ch
    return text(g)


def mirror(sprite):
    return [r[::-1] for r in sprite]


# Poses dérivées
CARRY_A = put(WALK_A, [(5, 33), (6, 32), (6, 33)], 'O')
CARRY_B = put(WALK_B, [(5, 33), (6, 32), (6, 33)], 'O')
EAT_A = head_down(WALK_A, 4)
EAT_B = head_down(WALK_A, 3)
CONSOLE = head_down(WALK_A, 2)
# Patte arrière levée : la patte du fond disparaît, une patte part en arrière vers le haut.
PEE = put(WALK_A, [(y, x) for y in (12, 13, 14) for x in (3, 4, 5)], '.')
PEE = put(PEE, [(9, 0), (10, 0), (11, 1)], 'o')
PEE = put(PEE, [(9, 1), (9, 2), (10, 1), (10, 2)], 'd')
PEE = put(PEE, [(8, 0), (8, 1)], 'o')
# Couché : sans pattes, l'œil fermé ; la respiration soulève le dos.
SLEEP_A = put(['.' * 34] * 3 + BODY, [(6, 26), (6, 27)], 'o')
SLEEP_B = grid(SLEEP_A)
for x in range(6, 21):
    SLEEP_B[9][x], SLEEP_B[10][x] = 'o', 'h'
    SLEEP_B[11][x] = 'k'
SLEEP_B = text(SLEEP_B)

# Assis, la tête haute, qui attend (la queue remue).
SIT_A = [
    "..............oooo......",
    ".............ohhkko.....",
    ".............ohkkkkooo..",
    ".............okkwokkkko.",
    "............oekkkkttttoo",
    "............oeektttttto.",
    "............oeeokdttoo..",
    "...........occeokoo.....",
    "..........okcgkkto......",
    ".........ohkkkkkto......",
    "........ohkkkkkkdo......",
    ".......ohkkkkkkoto......",
    "oo...ohkkkkkkkkoto......",
    "ohooskkkkkkkkksoto......",
    ".ossssssssssssoott......",
    "..oooooooooooooooo......",
]
SIT_B = put(put(SIT_A, [(12, 0), (12, 1), (13, 0), (13, 1), (13, 2)], '.'), [(13, 0), (13, 1), (14, 0)], 'o')
SIT_B = put(SIT_B, [(13, 2)], 'h')


CONSOLE_DEVICE = [
    "oooooooooooo",
    "oUUUUUUUUUUo",
    "oUSSSSSSSSUo",
    "oUSSSSSSSSUo",
    "oUSSSSSSSSUo",
    "oUUUUUUUUUUo",
    "oUyUyUyUyUUo",
    "oooooooooooo",
]
BOWL = [
    ".FFFFFFFF.",
    "oBBBBBBBBo",
    ".oBBBBBBo.",
    "..oooooo..",
]
HYDRANT = [
    "..oooo..",
    ".orrRRo.",
    "ooRRRRoo",
    "oRrRRRRo",
    ".oRrRRo.",
    "ooRrRRoo",
    "oRRrRRRo",
    ".oRrRRo.",
    ".oRrRRo.",
    ".oRrRRo.",
    "oooooooo",
    "oRRRRRRo",
    "oooooooo",
]
ZED = [
    "ZZZ",
    "..Z",
    ".Z.",
    "ZZZ",
]


# --- Décor ---
PLANT = [
    "....l..l.....",
    "...lL.lLl....",
    ".l.lLllL..l..",
    ".lLlLLlLl.lL.",
    "..lLLlLLLlL..",
    ".l.lLLlLLl.l.",
    ".lLllLLlLLLl.",
    "..lLlLLLlLl..",
    "...llLLLll...",
    "..ppppppppp..",
    "..oPPPPPPPo..",
    "...oPPPPPo...",
    "...oPPPPPo...",
    "....ooooo....",
]


def wicker(n, phase):
    return ''.join('v' if (i + phase) % 3 == 0 else 'b' for i in range(n))


BASKET_W = 42
BASKET = [
    "..o" + "o" * (BASKET_W - 6) + "o..",
    ".o" + wicker(BASKET_W - 4, 0) + "o.",
    "o" + wicker(BASKET_W - 2, 1) + "o",
    "o" + "bb" + "X" * 6 + "x" * (BASKET_W - 12) + "bb" + "o",
    "o" + "b" + "x" * (BASKET_W - 4) + "b" + "o",
    "o" + wicker(BASKET_W - 2, 2) + "o",
    "o" + wicker(BASKET_W - 2, 0) + "o",
    ".o" + wicker(BASKET_W - 4, 1) + "o.",
    "..o" + "o" * (BASKET_W - 6) + "o..",
]
# Le rebord avant, redessiné par-dessus le chien quand il dort dedans.
BASKET_FRONT = ['.' * BASKET_W] * 5 + BASKET[5:]

# --- Les autres chiens (un par agent), tournés vers la droite ---


def legs4(width, nb, fb, ff, nf, near, far, paw, frame):
    """Quatre pattes épaisses : deux au premier plan (4 px), deux au fond (3 px, plus sombres)."""
    g = [['.'] * width for _ in range(4)]
    if frame == 'B':
        nb, fb, ff, nf = nb + 1, fb - 1, ff + 1, nf - 1
    # Ligne du ventre entre les pattes
    for x in range(min(nb, fb), max(nf + 4, ff + 3)):
        g[0][x] = 'o'
    for x, fill in ((fb, far), (ff, far)):
        for y, row in enumerate(['o' + fill + 'o', 'o' + fill + 'o', 'o' + paw + 'o', 'ooo']):
            for i, ch in enumerate(row):
                g[y][x + i] = ch
    for x in (nb, nf):
        for y, row in enumerate(['o' + near * 2 + 'o', 'o' + near * 2 + 'o', 'o' + paw * 2 + 'o', 'oooo']):
            for i, ch in enumerate(row):
                g[y][x + i] = ch
    return [''.join(r) for r in g]


def head_down_at(sprite, col, nrows, dy):
    """Baisse la tête (colonnes ≥ col, lignes < nrows) de dy lignes, par-dessus le corps."""
    g = grid(sprite)
    head = [(y, x, g[y][x]) for y in range(nrows) for x in range(col, len(g[0])) if g[y][x] != '.']
    for y, x, _ in head:
        g[y][x] = '.'
    for y, x, ch in head:
        g[y + dy][x] = ch
    return text(g)


def sit_sprite(head, main, shade, chest, paw, wag):
    """Assis : la tête à la même hauteur, le dos qui descend jusqu'au sol, les pattes avant droites."""
    left = ["", "", "", "", "", "", "........o", ".......oX", "......oXX"]
    rows = [left[i].ljust(9, '.') + head[i] for i in range(9)] + [
        ".....oXXXXXXXCCo....",
        "....oXXXXXXXXCCo....",
        "...oXXXXXXXXXCCo....",
        "..oXXXXXXXXoXXXo....",
        ("ooxXXXXXXXXoXXXo...." if wag else "..oXXXXXXXXoXXXo...."),
        ("oXxxxxxxxxxoPPPo...." if wag else ".oxxxxxxxxxoPPPo...."),
        ".ooooooooooooooo....",
    ]
    table = {'X': main, 'x': shade, 'C': chest, 'P': paw}
    # Seuls le dos et le bas du corps sont recolorés ; la tête garde ses lettres.
    out = []
    for y, row in enumerate(rows):
        cut = 9 if y < 9 else len(row)
        out.append(''.join(table.get(ch, ch) for ch in row[:cut]) + row[cut:])
    return out


def make_breed(left, head, lower, lw, legs, main, shade, chest, paw, eye):
    """Toutes les poses d'une race, dérivées de son corps et de sa tête de profil."""
    body = [left[i].ljust(lw, '.') + head[i] for i in range(9)] + lower
    w = max(len(r) for r in body)
    body = [r.ljust(w, '.') for r in body]
    nb, fb, ff, nf, near, far, lpaw = legs
    a = body + legs4(w, nb, fb, ff, nf, near, far, lpaw, 'A')
    b = body + legs4(w, nb, fb, ff, nf, near, far, lpaw, 'B')
    ball = [(5, lw + 10), (6, lw + 10)]
    asleep = put(['.' * w] * 4 + body, [(4 + y, lw + x) for y, x in eye], 'o')
    return {
        'A': a, 'B': b,
        'CarryA': put(a, ball, 'O'), 'CarryB': put(b, ball, 'O'),
        'EatA': head_down_at(a, lw, 9, 3), 'EatB': head_down_at(a, lw, 9, 2),
        'SitA': sit_sprite(head, main, shade, chest, paw, True),
        'SitB': sit_sprite(head, main, shade, chest, paw, False),
        'Sleep': asleep,
    }


# Corps court, pattes épaisses, grosse tête de profil qui regarde devant elle (comme le teckel).
BREED_SPRITES = {
    'pit': make_breed([
        "", "", "", "",
        "o",
        "oAo",
        ".oAoooooo",
        "..oAAAAAA",
        "..oAAAAAA",
    ], [
        "..oooooo...",
        ".oaAAAAAo..",
        "oAaAAAAAAo.",
        "oAAAAwoAAEo",
        "oAAAAAAEEEo",
        "oAAAAAEEEoo",
        "oooAAEEEoo.",
        "AAAAEEo....",
        "AAAAEEo....",
    ], [
        "..oAAAAAABEBEBEo....",
        "..oAAAAAAAAEEEAo....",
        "..oaaaaaaaaaEEAo....",
    ], 9, (2, 5, 10, 12, 'A', 'a', 'E'), 'A', 'a', 'E', 'E', [(3, 5)]),
    'shiba': make_breed([
        "", "",
        ".ooo",
        "oHHHo",
        "oHVHHo",
        "oHoVHo",
        ".oHHHoooo",
        "..oHHHHHH",
        "..oHHHHHH",
    ], [
        "..o..o.....",
        ".oHooHo....",
        ".oHHHHHoo..",
        "oHHHHoHHVoo",
        "oHHHHHVVVVo",
        "oHHVVVVVVoo",
        "ooVVVVVooo.",
        "HHVVVVo....",
        "HHVVVVo....",
    ], [
        "..oHHHHHHHHVVVVo....",
        "..oHHHHHHHHVVVVo....",
        "..oIIVVVVVVVVVVo....",
    ], 9, (2, 5, 10, 12, 'H', 'I', 'V'), 'H', 'I', 'V', 'V', []),
    'shep': make_breed([
        "", "", "", "", "", "",
        "...ooooooooo",
        "..oJJJJJJJJJ",
        ".oGJJJJJJJJJ",
    ], [
        "..o..o.....",
        ".oGooGo....",
        ".oGGGGGo...",
        "oGGGGoGGooo",
        "oGGGGGJJJJo",
        "oGGGGGJJJoo",
        "ooGGGGGooo.",
        "GGGGGGo....",
        "GGGGGGo....",
    ], [
        "oGGoGJJJJJJJGGGGGGo....",
        "oGo.oGGGGGGGGGGGGGo....",
        ".o..ojjjjjjjjjjGGGo....",
    ], 12, (4, 7, 13, 15, 'G', 'j', 'j'), 'G', 'j', 'G', 'j', []),
    'jack': make_breed([
        "", "", "",
        ".oo",
        "oQQo",
        "oQMo",
        ".oQMooooo",
        "..oMQQQQQ",
        "..oQQQQQQ",
    ], [
        "..ooooo....",
        ".oMMQQQo...",
        "oMMMQQQQoo.",
        "oMMMQoQQQQo",
        "oMMMQQQQQoo",
        "oMMoQQQQBo.",
        "oooQQQQooo.",
        "QQQQQQo....",
        "QQQQQQo....",
    ], [
        "..oQQQMMQQQQQQQo....",
        "..oQQQMMQQQQQQQo....",
        "..oqqqqqqqqqQQQo....",
    ], 9, (2, 5, 10, 12, 'Q', 'q', 'Q'), 'Q', 'q', 'Q', 'Q', []),
}
PIT_A, PIT_B = BREED_SPRITES['pit']['A'], BREED_SPRITES['pit']['B']
SHEP_A, SHEP_B = BREED_SPRITES['shep']['A'], BREED_SPRITES['shep']['B']
JACK_A, JACK_B = BREED_SPRITES['jack']['A'], BREED_SPRITES['jack']['B']
SHIBA_A, SHIBA_B = BREED_SPRITES['shiba']['A'], BREED_SPRITES['shiba']['B']

SIT_BLINK = put(SIT_A, [(3, 16), (3, 17)], 'o')

SPRITES = {
    'walkA': WALK_A, 'walkB': WALK_B, 'carryA': CARRY_A, 'carryB': CARRY_B,
    'eatA': EAT_A, 'eatB': EAT_B, 'console': CONSOLE, 'pee': PEE,
    'sleepA': SLEEP_A, 'sleepB': SLEEP_B, 'sitA': SIT_A, 'sitB': SIT_B, 'sitBlink': SIT_BLINK,
    'consoleDevice': CONSOLE_DEVICE, 'bowl': BOWL, 'hydrant': HYDRANT, 'zed': ZED,
    'plant': PLANT, 'basket': BASKET, 'basketFront': BASKET_FRONT,
}
for _name, _poses in BREED_SPRITES.items():
    for _pose, _sprite in _poses.items():
        SPRITES[_name + _pose] = _sprite

with open(out_path, 'w') as f:
    f.write('// Généré par gen_band.py : les sprites du teckel et de ses accessoires (2 px par pixel).\n')
    f.write('export const COLORS: Readonly<Record<string, string>> = ' + json.dumps(COLORS, indent=2) + '\n\n')
    f.write('export const SPRITES = ' + json.dumps(SPRITES, indent=2) + ' as const\n')
print('sprites :', ', '.join(f'{k} {len(v[0])}x{len(v)}' for k, v in SPRITES.items()))
