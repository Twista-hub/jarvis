"""Background motifs for the Facebook/Instagram posts (Benjamin, 26.11.2026: the pictures should show what the post is
about, shimmering through in the background, e.g. window panes for cleaning tenders). Own drawings as inline SVG, no
stock photos, so there is no licence to clear. motiv(name, dunkel) returns the HTML for one post (1080x1350)."""


def _stern(x: float, y: float, r: float) -> str:
    k = r * .22
    return f'<path d="M{x},{y - r} L{x + k},{y - k} L{x + r},{y} L{x + k},{y + k} L{x},{y + r} L{x - k},{y + k} L{x - r},{y} L{x - k},{y - k} Z"/>'


def _tropfen(x: float, y: float, r: float) -> str:
    return f'<path d="M{x},{y - 2.1 * r} C{x + .4 * r},{y - 1.2 * r} {x + r},{y - .6 * r} {x + r},{y} A{r},{r} 0 1 1 {x - r},{y} C{x - r},{y - .6 * r} {x - .4 * r},{y - 1.2 * r} {x},{y - 2.1 * r} Z"/>'


def _fenster(f: str, glas: str) -> str:
    """Window front with reflections, a squeegee and its clean stripe."""
    scheiben, glanz = "", ""
    for i, x in enumerate((30, 300)):
        for j, y in enumerate((20, 230, 440)):
            scheiben += f'<rect x="{x}" y="{y}" width="250" height="190" rx="16" fill="url(#glas)" stroke="{f}" stroke-width="5"/>'
            glanz += (f'<g clip-path="inset(0)"><svg x="{x}" y="{y}" width="250" height="190" viewBox="0 0 250 190">'
                      f'<path d="M{40 + 30 * ((i + j) % 2)},190 L{120 + 30 * ((i + j) % 2)},0 h34 l-80,190 Z" fill="{glas}" opacity=".75"/>'
                      f'<path d="M{150 + 30 * ((i + j) % 2)},190 l80,-190 h14 l-80,190 Z" fill="{glas}" opacity=".55"/></svg></g>')
    return f'''<defs><linearGradient id="glas" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{glas}" stop-opacity=".8"/><stop offset="1" stop-color="{glas}" stop-opacity=".12"/></linearGradient></defs>
{scheiben}{glanz}
<g transform="translate(330 395) rotate(-24)"><rect x="-150" y="-330" width="300" height="330" fill="{glas}" opacity=".5"/>
<rect x="-165" y="-14" width="330" height="28" rx="10" fill="{f}"/><rect x="-150" y="12" width="300" height="12" rx="5" fill="{f}" opacity=".55"/>
<rect x="-14" y="20" width="28" height="170" rx="13" fill="{f}"/></g>
<g fill="{glas}">{_stern(120, 95, 46)}{_stern(505, 300, 30)}{_stern(215, 560, 24)}</g>
<g fill="{f}" opacity=".55">{_tropfen(92, 330, 15)}{_tropfen(520, 520, 12)}{_tropfen(150, 470, 9)}</g>'''


def _haeuser(f: str, glas: str) -> str:
    """Skyline with lit windows and a crane: all trades, construction."""
    teile = ""
    for x, y, b in ((10, 330, 110), (130, 220, 130), (270, 300, 100), (380, 160, 140), (530, 360, 70)):
        teile += f'<rect x="{x}" y="{y}" width="{b}" height="{600 - y}" rx="8" fill="url(#glas)" stroke="{f}" stroke-width="4"/>'
        for yy in range(y + 24, 580, 46):
            for xx in range(x + 16, x + b - 24, 34):
                teile += f'<rect x="{xx}" y="{yy}" width="18" height="24" rx="3" fill="{glas}" opacity="{.8 if (xx + yy) % 3 else .3}"/>'
    return f'''<defs><linearGradient id="glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{glas}" stop-opacity=".5"/><stop offset="1" stop-color="{glas}" stop-opacity=".05"/></linearGradient></defs>
{teile}<g stroke="{f}" stroke-width="6" stroke-linecap="round" fill="none"><path d="M335,300 V40 M250,70 H560 M335,40 L500,70 M335,40 L270,70 M520,70 V140"/><rect x="505" y="140" width="30" height="22" rx="4" fill="{f}"/></g>'''


def _ziel(f: str, glas: str) -> str:
    """Target with a tick: which tenders fit."""
    return f'''<g fill="none" stroke="{f}"><circle cx="300" cy="300" r="270" stroke-width="5" fill="{glas}" fill-opacity=".28"/><circle cx="300" cy="300" r="195" stroke-width="5" fill="{glas}" fill-opacity=".3"/>
<circle cx="300" cy="300" r="120" stroke-width="5" fill="{glas}" fill-opacity=".4"/></g><circle cx="300" cy="300" r="52" fill="{f}"/>
<path d="M272,300 l20,22 l40,-46" fill="none" stroke="{glas}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
<g fill="{glas}">{_stern(80, 90, 36)}{_stern(540, 520, 26)}</g>'''


def _blaetter(f: str, glas: str) -> str:
    """Stack of document sheets with marked lines: fact sheet."""
    def blatt(dx: float, dy: float, w: float, o: float) -> str:
        zeilen = "".join(f'<rect x="{60 + dx}" y="{150 + dy + 52 * i}" width="{(250, 310, 200, 290, 230, 300, 170)[i]}" height="16" rx="8" fill="{f}" opacity="{.75 if i in (1, 4) else .35}"/>' for i in range(7))
        return (f'<g transform="rotate({w} 300 300)" opacity="{o}"><rect x="{20 + dx}" y="{30 + dy}" width="400" height="520" rx="22" fill="url(#glas)" stroke="{f}" stroke-width="5"/>'
                f'<rect x="{60 + dx}" y="{80 + dy}" width="190" height="28" rx="10" fill="{f}"/>{zeilen}</g>')
    return f'''<defs><linearGradient id="glas" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{glas}" stop-opacity=".85"/><stop offset="1" stop-color="{glas}" stop-opacity=".25"/></linearGradient></defs>
{blatt(150, 10, 9, .6)}{blatt(70, 20, -5, 1)}<g fill="{glas}">{_stern(520, 80, 34)}</g>'''


def _team(f: str, glas: str) -> str:
    """Crew of four, one with a hard hat: staff planning."""
    def person(x: float, y: float, s: float, helm: bool = False) -> str:
        h = f'<path d="M{x - 46 * s},{y - 8 * s} a{46 * s},{46 * s} 0 0 1 {92 * s},0 h{14 * s} v{12 * s} h{-120 * s} v{-12 * s} Z" fill="{f}"/>' if helm else ""
        return (f'<circle cx="{x}" cy="{y}" r="{42 * s}" fill="url(#glas)" stroke="{f}" stroke-width="5"/>{h}'
                f'<path d="M{x - 90 * s},{y + 210 * s} v{-60 * s} a{90 * s},{90 * s} 0 0 1 {180 * s},0 v{60 * s} Z" fill="url(#glas)" stroke="{f}" stroke-width="5"/>')
    return f'''<defs><linearGradient id="glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{glas}" stop-opacity=".85"/><stop offset="1" stop-color="{glas}" stop-opacity=".2"/></linearGradient></defs>
{person(120, 250, .85)}{person(480, 250, .85)}{person(300, 330, 1.15, True)}<g fill="{glas}">{_stern(300, 120, 30)}</g>'''


def _lupe(f: str, glas: str) -> str:
    """Magnifier over a map with pins: search."""
    def nadel(x: float, y: float, s: float) -> str:
        return f'<path d="M{x},{y} c{-34 * s},{-44 * s} {-34 * s},{-84 * s} 0,{-84 * s} c{34 * s},0 {34 * s},{40 * s} 0,{84 * s} Z" fill="{f}"/><circle cx="{x}" cy="{y - 54 * s}" r="{11 * s}" fill="{glas}"/>'
    return f'''<defs><linearGradient id="glas" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{glas}" stop-opacity=".75"/><stop offset="1" stop-color="{glas}" stop-opacity=".2"/></linearGradient></defs>
<g fill="none" stroke="{f}" stroke-width="4" opacity=".5"><path d="M0,140 C150,90 260,210 420,150 S600,170 600,170 M0,330 C120,300 300,400 600,320 M0,500 C200,450 330,560 600,470 M150,0 C110,200 230,350 170,600 M400,0 C460,220 350,380 430,600"/></g>
{nadel(110, 250, 1)}{nadel(500, 150, .8)}{nadel(480, 470, .9)}
<circle cx="270" cy="290" r="165" fill="url(#glas)" stroke="{f}" stroke-width="18"/><path d="M392,412 L520,548" stroke="{f}" stroke-width="40" stroke-linecap="round"/>
<path d="M180,250 a100,100 0 0 1 80,-70" fill="none" stroke="{glas}" stroke-width="14" stroke-linecap="round" opacity=".9"/>'''


def _kalender(f: str, glas: str) -> str:
    """Calendar sheet with a marked day and a clock: deadlines."""
    tage = "".join(f'<rect x="{70 + 68 * i}" y="{210 + 68 * j}" width="50" height="50" rx="12" fill="{f if (i, j) == (4, 2) else glas}" opacity="{1 if (i, j) == (4, 2) else .75}"/>' for i in range(6) for j in range(4))
    return f'''<defs><linearGradient id="glas" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{glas}" stop-opacity=".8"/><stop offset="1" stop-color="{glas}" stop-opacity=".2"/></linearGradient></defs>
<rect x="30" y="70" width="490" height="450" rx="30" fill="url(#glas)" stroke="{f}" stroke-width="5"/><path d="M30,170 H520" stroke="{f}" stroke-width="5"/>
<g stroke="{f}" stroke-width="16" stroke-linecap="round"><path d="M140,40 V110 M410,40 V110"/></g>{tage}
<circle cx="400" cy="460" r="110" fill="{glas}" fill-opacity=".85" stroke="{f}" stroke-width="12"/><path d="M400,390 V460 L450,490" fill="none" stroke="{f}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'''


# Motif -> drawing, distance from the right edge, from the top, width. Placed so the solid parts sit right of the text.
MOTIVE = {"fenster": (_fenster, -120, -110, 600), "haeuser": (_haeuser, -70, 20, 620), "ziel": (_ziel, -120, 60, 600), "blaetter": (_blaetter, -200, 50, 600),
          "team": (_team, -130, 70, 520), "lupe": (_lupe, -150, 150, 520), "kalender": (_kalender, -110, 60, 600)}


def motiv(name: str, dunkel: bool = False) -> str:
    """The motif as a layer behind the text, top right, fading out towards the text on the left and at the bottom."""
    zeichnung, rechts, oben, breite = MOTIVE[name]
    f, glas, deck = ("#ffffff", "#ffffff", .38) if dunkel else ("#1f6fa8", "#ffffff", .55)
    maske = "linear-gradient(95deg,transparent 0%,rgba(0,0,0,.5) 16%,#000 42%),linear-gradient(180deg,#000 66%,transparent 100%)"
    return (f'<div style="position:absolute;right:{rechts}px;top:{oben}px;width:{breite}px;height:{breite}px;opacity:{deck};'
            f'-webkit-mask-image:{maske};-webkit-mask-composite:source-in;mask-image:{maske};mask-composite:intersect">'
            f'<svg viewBox="0 0 600 600" width="{breite}" height="{breite}" xmlns="http://www.w3.org/2000/svg">{zeichnung(f, glas)}</svg></div>')


# Photos (Benjamin, 26.11.2026: he chose photos over the drawings). Generated with Canva's image generation in his
# account (AI pictures, no stock photos, no real persons), stored in fotos/. Name -> width, distance from the right
# edge and from the top for the light posts; for the dark posts whether the photo is mirrored (subject to the right).
FOTOS = {"fenster": (800, 0, 0, False), "haeuser": (800, 0, 0, False), "checkliste": (800, -130, -60, False), "unterlagen": (800, 0, 0, True),
         "team": (620, -110, 0, False), "lupe": (800, 0, 0, True), "wecker": (800, -60, -100, False)}
# Dark posts only: enlarged and moved so the subject sits top right, as CSS background size and position.
AUSSCHNITT = {"lupe": "1242px auto", }
AUSSCHNITT_LAGE = {"lupe": "-124px -143px"}


def foto(name: str, dunkel: bool = False, ordner: str = "../fotos") -> str:
    """The photo as a layer behind the text. Light posts: top right, fading out towards the text on the left and
    above the cards. Dark posts: over the whole picture under a blue veil."""
    breite, rechts, oben, spiegeln = FOTOS[name]
    bild = f"url('{ordner}/{name}.jpg')"
    if dunkel:
        lage = f"{AUSSCHNITT_LAGE[name]}/{AUSSCHNITT[name]} no-repeat" if name in AUSSCHNITT else "center/cover"
        return (f'<div style="position:absolute;inset:0;background:{bild} {lage};{"transform:scaleX(-1);" if spiegeln else ""}"></div>'
                '<div style="position:absolute;inset:0;background:linear-gradient(170deg,rgba(31,111,168,.80) 0%,rgba(31,111,168,.62) 30%,rgba(21,80,126,.86) 62%,rgba(15,58,90,.96) 100%)"></div>')
    hoehe = round(breite * 1.25)
    voll, weg = round(100 * (480 - oben) / hoehe), round(100 * (660 - oben) / hoehe)
    maske = f"linear-gradient(90deg,transparent 2%,rgba(0,0,0,.55) 26%,#000 52%),linear-gradient(180deg,#000 {voll}%,transparent {weg}%)"
    return (f'<div style="position:absolute;right:{rechts}px;top:{oben}px;width:{breite}px;height:{hoehe}px;background:{bild} center top/cover;opacity:.62;'
            f'-webkit-mask-image:{maske};-webkit-mask-composite:source-in;mask-image:{maske};mask-composite:intersect"></div>')
