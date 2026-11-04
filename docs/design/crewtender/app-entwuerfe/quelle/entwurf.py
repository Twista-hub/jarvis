import sys, os
OUT = sys.argv[1]
LOGO = '''<svg viewBox="-540 -540 1080 1080"><rect x="-540" y="-540" width="1080" height="1080" rx="250" fill="#15324b"/><circle r="300" fill="none" stroke="#fff" stroke-width="88" stroke-linecap="round" stroke-dasharray="1450 1885" transform="rotate(40)"/><circle r="300" fill="none" stroke="#ff6b35" stroke-width="88" stroke-linecap="round" stroke-dasharray="1 1884" transform="rotate(40)"/><path d="M-115 5 L-30 90 L130 -85" fill="none" stroke="#ff6b35" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/><circle cx="-130" cy="-120" r="34" fill="#168aad"/><circle cx="-30" cy="-160" r="34" fill="#168aad"/></svg>'''
P = {
 'suche': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 'doc': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 'team': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 5.8"/>',
 'kal': '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
 'uhr': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
 'euro': '<path d="M17.5 6.5A7 7 0 1 0 17.5 17.5"/><path d="M4 10.5h9M4 13.5h9"/>',
 'haus': '<path d="M4 11 12 4l8 7v8.5a1 1 0 0 1-1 1h-4.5V15h-5v5.5H5a1 1 0 0 1-1-1z"/>',
 'glocke': '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
 'mehr': '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
 'pfeil': '<path d="m9 5 7 7-7 7"/>',
 'pin': '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
 'person': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 'filter': '<path d="M4 6h16M7 12h10M10 18h4"/>',
 'nachweis': '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
 'kunde': '<path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6M8 10h.01M16 10h.01"/>',
 'stapel': '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
}
def ic(n, s=22, w=1.8): return f'<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{P[n]}</svg>'

V = {
 'glas': dict(name='A · Glas', bg='linear-gradient(165deg,#eaf5fd 0%,#d6ebf9 45%,#c3e0f4 100%)', text='#13283b', muted='#557089', card='rgba(255,255,255,.62)', cardbrd='rgba(255,255,255,.85)', cardsh='0 8px 30px rgba(31,95,139,.13), inset 0 1px 0 rgba(255,255,255,.9)', blur='blur(14px) saturate(140%)', accent='#1f6fa8', accent2='linear-gradient(180deg,#3a9ee0,#1d6fae)', chip='rgba(31,111,168,.10)', chiptext='#1f5f8b', nav='rgba(255,255,255,.72)', iconbg='linear-gradient(160deg,rgba(255,255,255,.95),rgba(220,238,251,.9))', iconfg='#1f6fa8', radius=22, line='rgba(31,95,139,.12)', warm='#e8692e', heroglas=True),
 'klar': dict(name='B · Klar & strukturiert', bg='#f4f6f8', text='#141c24', muted='#5e6b78', card='#ffffff', cardbrd='#e3e8ee', cardsh='0 1px 2px rgba(16,24,40,.05)', blur='none', accent='#15324b', accent2='#15324b', chip='#eef2f6', chiptext='#2c3e50', nav='#ffffff', iconbg='#eef3f8', iconfg='#15324b', radius=14, line='#e7ecf1', warm='#d9582b', heroglas=False),
 'dunkel': dict(name='C · Dunkel Premium', bg='radial-gradient(120% 70% at 20% 0%,#1d4466 0%,#10263a 45%,#0a1826 100%)', text='#eef4f9', muted='#93a9bd', card='rgba(255,255,255,.06)', cardbrd='rgba(255,255,255,.12)', cardsh='0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08)', blur='blur(16px)', accent='#ff7a45', accent2='linear-gradient(180deg,#ff8a55,#f0612a)', chip='rgba(255,255,255,.08)', chiptext='#cfe0ee', nav='rgba(10,24,38,.82)', iconbg='rgba(255,255,255,.08)', iconfg='#7cc3ea', radius=20, line='rgba(255,255,255,.09)', warm='#ff8a55', heroglas=True),
}

def css(v):
    return f'''@font-face{{font-family:Inter;src:url(schrift/inter-latin.woff2) format("woff2")}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:412px;height:915px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:{v['text']};background:{v['bg']};-webkit-font-smoothing:antialiased;position:relative}}
.top{{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 6px}}
.marke{{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;letter-spacing:-.2px}} .marke svg{{width:32px;height:32px;border-radius:9px}}
.marke small{{display:block;font-size:11px;font-weight:500;color:{v['muted']};letter-spacing:0}}
.profil{{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:{v['card']};border:1px solid {v['cardbrd']};box-shadow:{v['cardsh']};backdrop-filter:{v['blur']};color:{v['iconfg']}}}
.inhalt{{padding:8px 20px 110px}}
h1{{font-size:26px;line-height:1.15;letter-spacing:-.6px;font-weight:750;margin:10px 0 4px}}
.unter{{color:{v['muted']};font-size:14px;margin-bottom:16px}}
.karte{{background:{v['card']};border:1px solid {v['cardbrd']};border-radius:{v['radius']}px;box-shadow:{v['cardsh']};backdrop-filter:{v['blur']};-webkit-backdrop-filter:{v['blur']}}}
.zahlen{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}}
.zahl{{padding:13px 12px}} .zahl b{{display:block;font-size:24px;font-weight:750;letter-spacing:-.5px}} .zahl span{{font-size:12px;color:{v['muted']};line-height:1.25;display:block;margin-top:2px}}
.zahl.akz b{{color:{v['accent'] if v is not V['klar'] else v['warm']}}}
.naechst{{padding:16px;margin-bottom:18px}} .naechst .kopf{{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:{v['muted']};text-transform:uppercase;letter-spacing:.6px;font-weight:600}}
.naechst h3{{font-size:16.5px;line-height:1.3;margin:8px 0 10px;font-weight:650;letter-spacing:-.2px}}
.chips{{display:flex;flex-wrap:wrap;gap:6px}} .chip{{font-size:12px;padding:5px 9px;border-radius:999px;background:{v['chip']};color:{v['chiptext']};font-weight:550;display:inline-flex;gap:4px;align-items:center}}
.chip.warn{{background:{'rgba(232,105,46,.12)' if v is not V['dunkel'] else 'rgba(255,122,69,.16)'};color:{v['warm']}}}
.knopf{{display:flex;justify-content:center;align-items:center;gap:8px;height:48px;border-radius:{min(v['radius'],16)}px;background:{v['accent2']};color:#fff;font-weight:650;font-size:15px;margin-top:14px;box-shadow:{'0 6px 18px rgba(29,111,174,.35), inset 0 1px 0 rgba(255,255,255,.35)' if v is V['glas'] else '0 6px 18px rgba(240,97,42,.35)' if v is V['dunkel'] else 'none'}}}
h2{{font-size:13px;text-transform:uppercase;letter-spacing:.7px;color:{v['muted']};font-weight:650;margin:4px 2px 10px}}
.liste{{overflow:hidden}} .zeile{{display:flex;align-items:center;gap:13px;padding:13px 14px;border-top:1px solid {v['line']}}} .zeile:first-child{{border-top:0}}
.symbol{{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:{v['iconbg']};color:{v['iconfg']};flex:none;{'box-shadow:inset 0 1px 0 #fff,0 2px 6px rgba(31,95,139,.12);' if v is V['glas'] else ''}}}
.zeile .t{{flex:1}} .zeile b{{font-weight:600;font-size:15px;display:block}} .zeile small{{font-size:12.5px;color:{v['muted']}}}
.zeile .pf{{color:{v['muted']};opacity:.7}}
.badge{{min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:{v['warm']};color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center}}
.nav{{position:absolute;left:12px;right:12px;bottom:14px;height:66px;border-radius:22px;display:grid;grid-template-columns:repeat(4,1fr);background:{v['nav']};border:1px solid {v['cardbrd']};box-shadow:0 10px 30px rgba(0,0,0,{'.10' if v is not V['dunkel'] else '.45'});backdrop-filter:blur(18px)}}
.nav a{{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;color:{v['muted']};font-weight:550;text-decoration:none}}
.nav a.an{{color:{v['accent'] if v is not V['klar'] else '#15324b'}}} .nav a.an svg{{stroke-width:2.2}}
.reiter{{display:flex;gap:8px;margin:0 0 14px;overflow:hidden}} .reiter span{{white-space:nowrap;font-size:13px;padding:8px 13px;border-radius:999px;background:{v['card']};border:1px solid {v['cardbrd']};font-weight:600;color:{v['muted']};backdrop-filter:{v['blur']}}}
.reiter span.an{{background:{v['accent'] if v is not V['glas'] else '#1f6fa8'};color:#fff;border-color:transparent}}
.treffer{{padding:15px 16px;margin-bottom:12px}} .treffer .oben{{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}}
.punkte{{font-size:12px;font-weight:700;padding:5px 9px;border-radius:999px;background:{'rgba(22,138,90,.12)' if v is not V['dunkel'] else 'rgba(94,214,160,.15)'};color:{'#127a50' if v is not V['dunkel'] else '#7fe0b4'}}}
.stand{{font-size:12px;color:{v['muted']};font-weight:550}}
.treffer h3{{font-size:16px;line-height:1.3;font-weight:650;letter-spacing:-.2px;margin-bottom:6px}}
.treffer p{{font-size:13.5px;color:{v['muted']};line-height:1.4;margin:8px 0 10px}}
.frist{{display:flex;justify-content:space-between;align-items:center;border-top:1px solid {v['line']};padding-top:10px;margin-top:4px;font-size:13px}} .frist b{{font-weight:650}} .frist .warn{{color:{v['warm']};font-weight:650}}
body::before,body::after{{content:'';position:absolute;border-radius:50%;filter:blur(40px);z-index:-1;display:{'block' if v['heroglas'] else 'none'}}}
body::before{{width:300px;height:300px;left:-90px;top:220px;background:{'#9fd2f5' if v is V['glas'] else '#1f6fa8'};opacity:{'.75' if v is V['glas'] else '.45'}}}
body::after{{width:260px;height:260px;right:-80px;top:560px;background:{'#bfe6ff' if v is V['glas'] else '#ff6b35'};opacity:{'.8' if v is V['glas'] else '.18'}}}
.kacheln{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}}
.kachel{{padding:13px 11px 12px;position:relative;min-height:104px;display:flex;flex-direction:column;gap:7px}}
.kachel .symbol{{width:34px;height:34px;border-radius:10px}}
.kachel b{{font-size:13px;font-weight:650;line-height:1.2;hyphens:auto;overflow-wrap:anywhere}} .kachel small{{font-size:11.5px;color:{v['muted']};line-height:1.25;margin-top:-3px}}
.kachel .badge{{position:absolute;top:10px;right:10px;min-width:20px;height:20px;font-size:11px}}
.suche{{display:flex;align-items:center;gap:10px;height:46px;padding:0 14px;margin-bottom:12px;color:{v['muted']};font-size:14.5px}}
'''

def kopf(v):
    return f'<div class="top"><div class="marke">{LOGO}<div>Crewtender<small>Muster Gebäudeservice GmbH</small></div></div><div class="profil">{ic("person",20)}</div></div>'
def nav(an):
    items=[('haus','Übersicht'),('suche','Treffer'),('glocke','Fristen'),('mehr','Mehr')]
    return '<nav class="nav">'+''.join(f'<a class="{"an" if i==an else ""}">{ic(n,23)}{t}</a>' for i,(n,t) in enumerate(items))+'</nav>'

def uebersicht(v):
    zeilen=[('suche','Ausschreibungen','3 neue Treffer heute','3'),('doc','Angebote','1 in Arbeit · 1 wartet auf Freigabe',''),('team','Firma & Team','24 Einsatzkräfte · 2 Nachweise laufen ab',''),('kal','Schichtplan','Diese Woche 38 Schichten',''),('uhr','Stundenzettel','5 zur Freigabe','5'),('euro','Rechnungen','2 offen · 4.280 €','')]
    liste=''.join(f'<div class="zeile"><div class="symbol">{ic(n,20)}</div><div class="t"><b>{t}</b><small>{s}</small></div>{f"<span class=badge>{b}</span>" if b else ""}<span class="pf">{ic("pfeil",18)}</span></div>' for n,t,s,b in zeilen)
    kz=[('suche','Ausschreibungen','3 neu','3'),('doc','Angebote','1 in Arbeit',''),('team','Team','24 Kräfte',''),('kal','Schichtplan','38 diese Woche',''),('uhr','Stunden','5 freigeben','5'),('euro','Rechnungen','2 offen',''),('glocke','Fristen','2 diese Woche',''),('nachweis','Nachweise','2 laufen ab','2'),('kunde','Kunden','12 aktiv','')]
    kacheln=''.join(f'<div class="karte kachel">{f"<span class=badge>{b}</span>" if b else ""}<div class="symbol">{ic(n,19)}</div><b>{t}</b><small>{x}</small></div>' for n,t,x,b in kz)
    return f'''{kopf(v)}<div class="inhalt"><h1>Guten Morgen, Benjamin</h1><div class="unter">Mittwoch, 4. November · 3 neue passende Aufträge</div>
<div class="zahlen"><div class="karte zahl akz"><b>3</b><span>neue Treffer</span></div><div class="karte zahl"><b>2</b><span>Fristen diese Woche</span></div><div class="karte zahl"><b>1,2 Mio.</b><span>Auftragswert offen</span></div></div>
<div class="karte naechst"><div class="kopf"><span>Nächste Frist</span><span class="chip warn">{ic("uhr",13,2.2)} in 3 Tagen</span></div><h3>Unterhaltsreinigung Schulen und Verwaltung Musterstadt</h3><div class="chips"><span class="chip">9/10 passend</span><span class="chip">{ic("stapel",13)} 6 Lose</span><span class="chip">{ic("pin",13)} 24 km</span></div><div class="knopf">Angebot weiterschreiben {ic("pfeil",18,2.2)}</div></div>
<h2>Firma auf einen Blick</h2><div class="kacheln">{kacheln}</div></div>{nav(0)}'''

def treffer(v):
    t=[('9/10','Angebot in Arbeit','Rahmenvereinbarung Leihpersonal für die Gastronomie','Servicekräfte und Köche für Kantine und Bankett. Arbeitnehmerüberlassung ist euer Kerngeschäft.',['16 Lose','ca. 10.800 Std.','12 km'],'22.11.2026','in 18 Tagen',False),
       ('8/10','Prüfen','Unterhaltsreinigung Schulen und Verwaltung Musterstadt','Unterhalts- und Glasreinigung in 6 Gebäuden, passend zu eurem Reinigungsbereich.',['6 Lose','ab 01.02.2027','24 km'],'07.11.2026','in 3 Tagen',True),
       ('7/10','Neu','Objektschutz Rathaus und Bürgerbüro','Empfangs- und Revierdienst, 24/7, zwei Objekte.',['2 Lose','36 Monate','8 km'],'28.11.2026','in 24 Tagen',False)]
    karten=''.join(f'''<div class="karte treffer"><div class="oben"><span class="punkte">{p} passend</span><span class="stand">{s}</span></div><h3>{h}</h3><div class="chips">{''.join(f'<span class="chip">{c}</span>' for c in cs)}</div><p>{d}</p><div class="frist"><span>Abgabefrist <b>{f}</b></span><span class="{"warn" if w else ""}">{rest}</span></div></div>''' for p,s,h,d,cs,f,rest,w in t)
    return f'''{kopf(v)}<div class="inhalt"><h1>Ausschreibungen</h1><div class="unter">12 passende · 3 neu seit gestern</div>
<div class="karte suche">{ic("suche",19)}<span style="flex:1">Titel, Auftraggeber, Ort …</span>{ic("filter",19)}</div>
<div class="reiter"><span class="an">Neu · 3</span><span>Prüfen · 4</span><span>Angebot · 2</span><span>Abgegeben</span></div>{karten}</div>{nav(1)}'''

for k,v in V.items():
    for nm,fn in (('uebersicht',uebersicht),('treffer',treffer)):
        open(f'{OUT}/{k}_{nm}.html','w').write(f'<!doctype html><html lang="de"><meta charset="utf-8"><style>{css(v)}</style><body>{fn(v)}</body></html>')
print('ok')
