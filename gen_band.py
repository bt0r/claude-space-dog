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
    'N': '#3c9a6c',  # limbe de la Monstera
    'n': '#2b7652',  # ombre de la feuille
    'i': '#93e2b8',  # nervure
    'u': '#4a8a5a',  # tige
    'C': '#7fa8e8',  # gamelle d'eau
    'W': '#5ec2ff',  # eau
    'T': '#c8f0ff',  # reflet de l'eau
    'K': '#ff8fb3',  # cœur
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
# Les pattes, comme celles des chiens d'agents (legs4) : deux au premier plan (4 px de large),
# deux au fond (3 px, plus sombres, dessinées derrière). Au pas, chaque paire se croise d'une colonne.
TECKEL_NB, TECKEL_FB, TECKEL_FF, TECKEL_NF = 3, 6, 20, 23  # arrière-près, arrière-loin, avant-loin, avant-près
NEAR_LEG = ['oddo', 'otto', 'oooo']
FAR_LEG = ['odo', 'odo', 'ooo']


def teckel_legs(frame, lifted=False):
    """Les pattes du teckel, image A ou B ; `lifted` : sans l'arrière-près (levée pour le pipi)."""
    nb, fb, ff, nf = TECKEL_NB, TECKEL_FB, TECKEL_FF, TECKEL_NF
    if frame == 'B':
        nb, fb, ff, nf = nb + 1, fb - 1, ff + 1, nf - 1
    g = [['.'] * 34 for _ in range(3)]
    near = [x for x in (nb, nf) if not (lifted and x == nb)]
    for x0, rows in [(x, FAR_LEG) for x in (fb, ff)] + [(x, NEAR_LEG) for x in near]:
        for y, row in enumerate(rows):
            for i, ch in enumerate(row):
                g[y][x0 + i] = ch
    return [''.join(r) for r in g]


WALK_A = BODY + teckel_legs('A')
WALK_B = BODY + teckel_legs('B')
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
PEE = BODY + teckel_legs('A', lifted=True)
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
# La gamelle d'eau, posée près du panier ; un reflet qui glisse à la surface.
WATER_A = [
    ".TWWWWWWW.",
    "oCCCCCCCCo",
    ".oCCCCCCo.",
    "..oooooo..",
]
WATER_B = [
    ".WWWWWTWW.",
    "oCCCCCCCCo",
    ".oCCCCCCo.",
    "..oooooo..",
]
# Un petit cœur qui monte pendant les caresses.
HEART = [
    ".K.K.",
    "KKKKK",
    ".KKK.",
    "..K..",
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

# --- La Monstera : un pot et ses tiges, fixes, et des feuilles qui bougent chacune de leur côté ---
# Chaque feuille est un calque à part, de la taille de la plante, dessiné en plusieurs poses.
MON_W, MON_H = 26, 16
MON_POT = [
    (11, "ppppppppp"),
    (12, "oPPPPPPPo"),
    (13, ".oPPPPPo."),
    (14, ".oPPPPPo."),
    (15, "..ooooo.."),
]
MON_POT_X = 8  # colonne du bord gauche du pot ; son centre est en 12
# Une feuille tournée vers la droite, attachée en bas à gauche : contour, limbe, ombre,
# nervure claire et fenestrations (les fentes qui partent du bord).
LEAF_RIGHT = [
    "...oooo...",
    "..oNNNNoo.",
    ".oNNNiNNNo",
    ".oNNiNoooo",
    "oNNiNNNNNo",
    "oNiNnNoooo",
    "oinnnnno..",
    "oooooo....",
]
LEAF_LEFT = [r[::-1] for r in LEAF_RIGHT]
LEAF_UP = [
    "...ooo...",
    "..oNNNo..",
    ".oNNiNNo.",
    "ooNNiNNoo",
    "oNNNiNNNo",
    "ooNNiNNoo",
    ".oNninNo.",
    "..onino..",
    "...ooo...",
]
# Les feuilles, dessinées dans cet ordre (celle du haut devant) : (motif, coin haut-gauche
# (ligne, colonne), pétiole (ligne, colonne)) et la tige qui va du pot au pétiole.
# Chaque feuille plie depuis son pétiole (voir `bend`) : le mod alterne ses poses à son propre rythme.
MON_LEAVES = [
    (LEAF_LEFT, (2, 0), (9, 9), [(10, 11), (9, 10)]),
    (LEAF_RIGHT, (1, 16), (8, 16), [(10, 13), (9, 14), (9, 15)]),
    (LEAF_UP, (0, 8), (8, 12), [(10, 12), (9, 12)]),
]


def mon_canvas():
    return [['.'] * MON_W for _ in range(MON_H)]


def mon_put(g, rows, top, left):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.' and 0 <= top + y < MON_H and 0 <= left + x < MON_W:
                g[top + y][left + x] = ch


pot = mon_canvas()
for _, _, _, stem in MON_LEAVES:
    for y, x in stem:
        pot[y][x] = 'u'
for y, row in MON_POT:
    mon_put(pot, [row], y, MON_POT_X)
MONSTERA_POT = [''.join(r) for r in pot]


def bend(rows, top, left, pivot, k):
    """La feuille pliée depuis son pétiole : son bout bouge de `k` pixels, son milieu de moitié.

    Une feuille de côté monte (k < 0) ou descend (k > 0) ; celle du haut penche à droite (k > 0)
    ou à gauche (k < 0). Le pétiole, lui, ne bouge jamais.
    """
    g = mon_canvas()
    h, w = len(rows), len(rows[0])
    prow, pcol = pivot
    upright = top + h - 1 <= prow and left <= pcol < left + w and rows is LEAF_UP
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            gy, gx = top + y, left + x
            if upright:
                gx += round(k * (prow - gy) / (h - 1))
            else:
                gy += round(k * abs(gx - pcol) / (w - 1))
            if 0 <= gy < MON_H and 0 <= gx < MON_W:
                g[gy][gx] = ch
    return [''.join(r) for r in g]


# Chaque feuille : ses poses, du repos à pliée de 2 px, et légèrement relevée.
LEAF_BENDS = (-1, 0, 1, 2)
MONSTERA_LEAVES = [{k: bend(rows, top, left, pivot, k) for k in LEAF_BENDS} for rows, (top, left), pivot, _ in MON_LEAVES]


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


def breed_belly(body, legs, lw):
    """Sur le dos, comme le teckel : le dos au sol, les pattes en l'air, la tête renversée posée par terre."""
    neck = lw + 7  # le torse va jusqu'au cou, sous la tête
    torso = [r[:neck] for r in body[6:]][::-1]  # le dos en bas, le ventre en haut
    head = [r[lw:] for r in body[:7]][::-1]  # le crâne en bas, la mâchoire en haut
    legs = [r[:neck] for r in legs][::-1]  # les pattes en l'air
    width = lw + 5 + max(len(r) for r in head)
    rows = len(torso) + len(legs) - 1
    g = [['.'] * width for _ in range(rows)]

    def paint(sprite, top, left):
        for y, row in enumerate(sprite):
            for x, ch in enumerate(row):
                if ch != '.' and 0 <= top + y < rows and 0 <= left + x < width:
                    g[top + y][left + x] = ch

    paint(torso, rows - len(torso), 0)
    paint(head, rows - len(head), lw + 5)
    paint(legs, 0, 0)
    return [''.join(r) for r in g]


def make_breed(left, head, lower, lw, legs, main, shade, chest, paw, eye):
    """Toutes les poses d'une race, dérivées de son corps et de sa tête de profil."""
    body = [left[i].ljust(lw, '.') + head[i] for i in range(9)] + lower
    w = max(len(r) for r in body)
    body = [r.ljust(w, '.') for r in body]
    nb, fb, ff, nf, near, far, lpaw = legs
    a = body + legs4(w, nb, fb, ff, nf, near, far, lpaw, 'A')
    b = body + legs4(w, nb, fb, ff, nf, near, far, lpaw, 'B')
    legs_a = legs4(w, nb, fb, ff, nf, near, far, lpaw, 'A')
    legs_b = legs4(w, nb, fb, ff, nf, near, far, lpaw, 'B')
    ball = [(5, lw + 10), (6, lw + 10)]
    asleep = put(['.' * w] * 4 + body, [(4 + y, lw + x) for y, x in eye], 'o')
    return {
        'A': a, 'B': b,
        'CarryA': put(a, ball, 'O'), 'CarryB': put(b, ball, 'O'),
        'EatA': head_down_at(a, lw, 9, 3), 'EatB': head_down_at(a, lw, 9, 2),
        'SitA': sit_sprite(head, main, shade, chest, paw, True),
        'SitB': sit_sprite(head, main, shade, chest, paw, False),
        'Sleep': asleep,
        'BellyA': breed_belly(body, legs_a, lw), 'BellyB': breed_belly(body, legs_b, lw),
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

# Sur le dos pour une caresse : le dos au sol, le ventre en l'air, les quatre pattes qui pédalent,
# la tête renversée posée par terre. Construit à partir du teckel debout, retourné.
def belly_up(frame):
    flipped_body = BODY[8:12][::-1]  # le ventre en haut, le dos en bas
    legs = teckel_legs(frame)[::-1]  # les pattes en l'air
    head = [r[HEAD_COL:] for r in BODY[0:8]][::-1]  # la tête à l'envers, posée au sol
    width, rows, shift = 37, 8, 3
    g = [['.'] * width for _ in range(rows)]

    def paint(sprite, top, left):
        for y, row in enumerate(sprite):
            for x, ch in enumerate(row):
                if ch != '.' and 0 <= top + y < rows and 0 <= left + x < width:
                    g[top + y][left + x] = ch

    paint(head, 0, HEAD_COL + shift)
    paint(flipped_body, rows - 4, 0)
    paint([r[:HEAD_COL + 3] for r in legs], rows - 7, 0)
    return [''.join(r) for r in g]


BELLY_A = belly_up('A')
BELLY_B = belly_up('B')

SPRITES = {
    'walkA': WALK_A, 'walkB': WALK_B, 'carryA': CARRY_A, 'carryB': CARRY_B,
    'eatA': EAT_A, 'eatB': EAT_B, 'console': CONSOLE, 'pee': PEE,
    'sleepA': SLEEP_A, 'sleepB': SLEEP_B, 'sitA': SIT_A, 'sitB': SIT_B, 'sitBlink': SIT_BLINK,
    'bellyA': BELLY_A, 'bellyB': BELLY_B, 'heart': HEART, 'waterA': WATER_A, 'waterB': WATER_B,
    'consoleDevice': CONSOLE_DEVICE, 'bowl': BOWL, 'hydrant': HYDRANT, 'zed': ZED,
    'monsteraPot': MONSTERA_POT,
    **{f'monsteraLeaf{i}{"m" if k < 0 else ""}{abs(k)}': pose
       for i, poses in enumerate(MONSTERA_LEAVES) for k, pose in poses.items()},
    'basket': BASKET, 'basketFront': BASKET_FRONT,
}
for _name, _poses in BREED_SPRITES.items():
    for _pose, _sprite in _poses.items():
        SPRITES[_name + _pose] = _sprite

with open(out_path, 'w') as f:
    f.write('// Généré par gen_band.py : les sprites du teckel et de ses accessoires (2 px par pixel).\n')
    f.write('export const COLORS: Readonly<Record<string, string>> = ' + json.dumps(COLORS, indent=2) + '\n\n')
    f.write('export const SPRITES = ' + json.dumps(SPRITES, indent=2) + ' as const\n')
print('sprites :', ', '.join(f'{k} {len(v[0])}x{len(v)}' for k, v in SPRITES.items()))
