import sys, importlib.util
OUT=sys.argv[1]
spec=importlib.util.spec_from_file_location('e', OUT+'/entwurf.py'); 
src=open(OUT+'/entwurf.py').read().split("for k,v in V.items():")[0]
g={'__name__':'x','sys':sys}; sys.argv=[sys.argv[0],OUT]; exec(src,g)
ic=g['ic']; LOGO=g['LOGO']
CSS='''@font-face{font-family:Inter;src:url(schrift/inter-latin.woff2) format("woff2")}
*{box-sizing:border-box;margin:0;padding:0}
body{width:412px;height:915px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#0f1d2b;background:#eef1f4;background-image:linear-gradient(#dfe5eb 1px,transparent 1px),linear-gradient(90deg,#dfe5eb 1px,transparent 1px);background-size:24px 24px;-webkit-font-smoothing:antialiased;position:relative}
.mono{font-family:"JetBrains Mono",monospace;font-feature-settings:"zero"}
.top{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#0f2537;color:#e8f1f8}
.marke{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px} .marke svg{width:28px;height:28px;border-radius:7px}
.marke small{display:block;font-size:10.5px;font-weight:500;color:#8fb0c8}
.status{font-size:10.5px;padding:5px 8px;border:1px solid #2c4a62;border-radius:4px;color:#9fe3c6;display:flex;gap:6px;align-items:center}
.led{width:7px;height:7px;border-radius:50%;background:#35d39a;box-shadow:0 0 8px #35d39a}
.inhalt{padding:14px 14px 100px}
.titel{display:flex;justify-content:space-between;align-items:baseline;margin:2px 2px 10px} .titel h1{font-size:21px;font-weight:750;letter-spacing:-.4px} .titel span{font-size:11px;color:#5d7083}
.panel{background:#fff;border:1px solid #d5dce3;border-radius:6px;margin-bottom:12px;box-shadow:0 1px 0 rgba(16,24,40,.03)}
.phead{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #e3e8ed;font-size:10.5px;letter-spacing:.9px;text-transform:uppercase;color:#5d7083;font-weight:650}
.kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))} .kpi div{padding:10px 10px 11px;border-left:1px solid #e3e8ed} .kpi div:first-child{border-left:0}
.kpi b{display:block;font-size:22px;font-weight:600;letter-spacing:-.5px} .kpi span{display:block;font-size:10.5px;color:#5d7083;margin-top:2px;line-height:1.2} .kpi i{font-style:normal;font-size:10.5px;color:#0e8a64}
.spark{display:flex;align-items:flex-end;gap:5px;height:44px;padding:10px 12px 8px} .spark div{flex:1;background:#cfe3ef;border-radius:2px 2px 0 0} .spark div.h{background:#0e7490}
.tage{display:flex;justify-content:space-between;padding:0 12px 8px;font-size:9.5px;color:#7a8c9c}
.zeit{padding:14px 12px 10px} .leg{display:flex;align-items:center;gap:8px;font-size:12px;margin-top:8px} .leg i{width:8px;height:8px;border-radius:50%} .leg span{color:#5d7083;font-size:11px} .leg b{flex:1;font-weight:600} .leg em{font-style:normal;font-size:11px;color:#33475a}
.achse{position:relative;height:14px;border-bottom:2px solid #cfd8e1} .achse .m{position:absolute;bottom:-6px;width:10px;height:10px;border-radius:50%;border:2px solid #fff;transform:translateX(-5px)}
.achse .l{position:absolute;bottom:12px;font-size:10px;transform:translateX(-50%);white-space:nowrap;color:#33475a}
.skala{display:flex;justify-content:space-between;font-size:9.5px;color:#7a8c9c;margin-top:6px}
.raster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))} .zelle{padding:10px 10px 9px;border-top:1px solid #e3e8ed;border-left:1px solid #e3e8ed;display:flex;flex-direction:column;gap:4px;position:relative}
.zelle:nth-child(3n+1){border-left:0} .zelle:nth-child(-n+3){border-top:0}
.zelle .s{color:#0e7490} .zelle b{font-size:12.5px;font-weight:650} .zelle .n{font-size:17px;font-weight:600} .zelle small{font-size:10px;color:#5d7083}
.zelle .w{position:absolute;top:9px;right:9px;font-size:9.5px;padding:2px 5px;border-radius:3px;background:#fde7dc;color:#c2491b;font-weight:700}
.nav{position:absolute;left:0;right:0;bottom:0;height:64px;display:grid;grid-template-columns:repeat(4,1fr);background:#0f2537;border-top:1px solid #1f3a50}
.nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:10.5px;color:#8fb0c8;font-weight:550} .nav a.an{color:#5fd0f0} .nav a.an::before{content:"";position:absolute;top:0;width:44px;height:2px;background:#5fd0f0}
.nav a{position:relative}
.filter{display:flex;gap:6px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden} .filter span{font-size:11.5px;padding:6px 9px;border:1px solid #c9d2db;background:#fff;border-radius:4px;white-space:nowrap;color:#33475a;font-weight:600} .filter span.an{background:#0f2537;color:#fff;border-color:#0f2537}
.suche{display:flex;align-items:center;gap:8px;height:40px;padding:0 10px;background:#fff;border:1px solid #c9d2db;border-radius:6px;margin-bottom:10px;font-size:13px;color:#7a8c9c}
.row{padding:11px 12px;border-top:1px solid #e3e8ed} .row:first-child{border-top:0}
.r1{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#7a8c9c}
.seg{display:flex;gap:2px;align-items:center} .seg i{width:7px;height:9px;border-radius:1px;background:#d6dee6} .seg i.f{background:#0e8a64} .seg em{font-style:normal;margin-left:6px;color:#0e8a64;font-weight:700;font-size:11px}
.row h3{font-size:14px;font-weight:650;line-height:1.3;margin:6px 0 7px}
.tags{display:flex;gap:5px;flex-wrap:wrap} .tags span{font-size:10.5px;padding:3px 6px;border-radius:3px;background:#eef3f7;color:#33475a;border:1px solid #dde5ec}
.fr{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:11px} .bar{flex:1;height:5px;background:#e3e8ed;border-radius:3px;overflow:hidden} .bar i{display:block;height:100%;background:#0e7490} .bar i.w{background:#e8692e}
.fr .w{color:#c2491b;font-weight:700}
'''
def kopf(): return f'<div class="top"><div class="marke">{LOGO}<div>Crewtender<small>Muster Gebäudeservice GmbH</small></div></div><div class="status mono"><span class="led"></span>ALARM 07:41</div></div>'
def nav(an):
    it=[('haus','Übersicht'),('suche','Treffer'),('glocke','Fristen'),('mehr','Mehr')]
    return '<nav class="nav">'+''.join(f'<a class="{"an" if i==an else ""}">{ic(n,22)}{t}</a>' for i,(n,t) in enumerate(it))+'</nav>'
def ueb():
    werte=[3,5,2,6,4,1,3]; bars=''.join(f'<div class="{"h" if i==6 else ""}" style="height:{v*14+6}%"></div>' for i,v in enumerate(werte))
    marken=[(10,'#c2491b','07.11 Reinigung'),(60,'#0e7490','22.11 Leihpersonal'),(80,'#33475a','28.11 Objektschutz')]
    m=''.join(f'<span class="m" style="left:{p}%;background:{c}"></span>' for p,c,t in marken)
    leg=''.join(f'<div class="leg"><i style="background:{c}"></i><span class="mono">{t.split(" ",1)[0]}</span><b>{t.split(" ",1)[1]}</b><em class="mono">{r}</em></div>' for (p,c,t),r in zip(marken,["3 T","18 T","24 T"]))
    zellen=[('suche','Ausschreib.','3','neu heute','3 NEU'),('doc','Angebote','2','1 Freigabe',''),('team','Team','24','Einsatzkräfte',''),('kal','Schichten','38','diese Woche',''),('uhr','Stunden','5','zur Freigabe','5'),('euro','Rechnungen','4.280 €','2 offen',''),('glocke','Fristen','2','≤ 7 Tage',''),('nachweis','Nachweise','2','laufen ab','2'),('kunde','Kunden','12','aktiv','')]
    z=''.join(f'<div class="zelle">{f"<span class=w>{w}</span>" if w else ""}<span class="s">{ic(n,17)}</span><b>{t}</b><span class="n mono">{x}</span><small>{u}</small></div>' for n,t,x,u,w in zellen)
    return f'''{kopf()}<div class="inhalt"><div class="titel"><h1>Lage heute</h1><span class="mono">MI 04.11.2026 · 07:41</span></div>
<div class="panel kpi"><div><b class="mono">3</b><span>neue Treffer</span><i class="mono">▲ +2</i></div><div><b class="mono">12</b><span>passend gesamt</span><i class="mono">ø 7,8/10</i></div><div><b class="mono">2</b><span>Fristen ≤ 7 T.</span><i class="mono" style="color:#c2491b">⚠ 07.11</i></div><div><b class="mono">1,2M</b><span>Auftrags&shy;wert €</span><i class="mono">offen</i></div></div>
<div class="panel"><div class="phead"><span>Neue Treffer · 7 Tage</span><span class="mono">Σ 24</span></div><div class="spark">{bars}</div><div class="tage mono"><span>DO</span><span>FR</span><span>SA</span><span>SO</span><span>MO</span><span>DI</span><span>MI</span></div></div>
<div class="panel"><div class="phead"><span>Fristen · 30 Tage</span><span class="mono">3 offen</span></div><div class="zeit"><div class="achse">{m}</div><div class="skala mono"><span>04.11</span><span>14.11</span><span>24.11</span><span>04.12</span></div>{leg}</div></div>
<div class="panel"><div class="phead"><span>Firma auf einen Blick</span><span class="mono">9 Module</span></div><div class="raster">{z}</div></div></div>{nav(0)}'''
def tre():
    t=[(9,'TED 2026/S 214-661245','Rahmenvereinbarung Leihpersonal für die Gastronomie',['16 Lose','~10.800 h','12 km','AÜG'],'22.11.2026','18 T',40,False),
       (8,'BKS 2026-11-03-0187','Unterhaltsreinigung Schulen und Verwaltung Musterstadt',['6 Lose','ab 02/2027','24 km'],'07.11.2026','3 T',90,True),
       (7,'BKS 2026-11-02-0412','Objektschutz Rathaus und Bürgerbüro',['2 Lose','36 Mon.','8 km','24/7'],'28.11.2026','24 T',20,False),
       (7,'TED 2026/S 213-659901','Glas- und Fassadenreinigung Klinikum',['1 Los','12 Mon.','31 km'],'01.12.2026','27 T',12,False)]
    rows=''.join(f'''<div class="row"><div class="r1"><span class="mono">{q}</span><span class="seg">{''.join(f'<i class="{"f" if i<p else ""}"></i>' for i in range(10))}<em class="mono">{p}/10</em></span></div><h3>{h}</h3><div class="tags mono">{''.join(f'<span>{x}</span>' for x in tg)}</div><div class="fr mono"><span>{f}</span><span class="bar"><i class="{"w" if w else ""}" style="width:{pr}%"></i></span><span class="{"w" if w else ""}">{r}</span></div></div>''' for p,q,h,tg,f,r,pr,w in t)
    return f'''{kopf()}<div class="inhalt"><div class="titel"><h1>Ausschreibungen</h1><span class="mono">12 PASSEND · 3 NEU</span></div>
<div class="suche">{ic("suche",17)}<span style="flex:1">Titel, Auftraggeber, CPV, Ort …</span><span class="mono" style="font-size:11px">⌘K</span></div>
<div class="filter mono"><span class="an">NEU 3</span><span>PRÜFEN 4</span><span>ANGEBOT 2</span><span>≥ 8/10</span><span>≤ 30 KM</span></div>
<div class="panel"><div class="phead"><span>Treffer · sortiert nach Frist</span><span class="mono">4/12</span></div>{rows}</div></div>{nav(1)}'''
for n,f in (('technik_uebersicht',ueb),('technik_treffer',tre)):
    open(f'{OUT}/{n}.html','w').write(f'<!doctype html><html lang="de"><meta charset="utf-8"><style>{CSS}</style><body>{f()}</body></html>')
print('ok')
