"""Fyller Excel-filen med testlägenheter, räknar om den i LibreOffice och sparar
indata + Excels resultat i fixture.json. calc.test.js jämför sedan calc.js mot det.

Kör: python3 make_fixture.py <sökväg till originalets .xlsx>
"""
import json, os, shutil, subprocess, sys, tempfile
import openpyxl

src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp()
work = os.path.join(tmp, 'in.xlsx')
shutil.copy(src, work)

KONTANT = 3499200  # = Simulering!B19 med originalets indata
active = [
    # adress, utgångspris, avgift, rum, kvm, slutpris, ränta, underhåll, hyra
    ('Odengatan 12', 4950000, 2400, 1, 32, 5200000, 0.025, 300, 14000),
    ('Sibyllegatan 4', 6200000, 3100, 1, 38, None, 0.03, 0, 16500),
    ('Tulegatan 30', 3995000, 1850, 1, 27, None, 0.025, 0, None),
    ('Karlavägen 88', 7400000, 3600, 2, 44, 7950000, 0.028, 500, 19000),
    ('Upplandsgatan 7', 4500000, 2950, 1, 35, 4380000, 0.025, 0, 13500),
]
soft = [
    # M vatten, N balkong, O pplats, P grön, Q hiss, R trappor, S mat, T tbana, U branta, V vall, W dram, X, Y
    ('Nej', 'Ja', 'Nej', 6, 'Ja', 3, 4, 7, 'Nej', 55, 18, 4, None),
    ('Ja', 'Inglasad', 'Nej', 3, 'Ja', 5, 2, 9, 'Nej', 62, 12, None, 3),
    ('Nej', 'Nej', 'Ja', 20, 'Nej', 2, 12, 4, 'Ja', 45, 25, 2, 2),
    ('Ja', 'Ja', 'Ja', 2, 'Ja', 1, 6, 3, 'Nej', 70, 8, 5, 5),
    (None, None, None, None, 'Nej', 0, 16, 31, None, 40, 35, None, None),
]
archive = [
    # A, B utg, C slut, G avgift, K rum, L kvm, + soft
    ('Arkiv: Surbrunnsgatan 20', 4100000, 4550000, 2200, 1, 30,
     ('Nej', 'Ja', 'Nej', 10, 'Ja', 4, 3, 5, 'Nej', 50, 20, 3, None)),
    ('Arkiv: Rörstrandsgatan 9', 5300000, None, 2700, 1, 36,
     ('Ja', 'Nej', 'Nej', 70, 'Nej', 4, 70, 14, 'Ja', 58, 16, None, 1)),
]

wb = openpyxl.load_workbook(work)
sim, utv = wb['Simulering'], wb['Utvärdering']
utv['F3'] = KONTANT  # gör Utvärdering konsekvent med Simulering
cols = 'BCDEF'
for i, (adr, utg, avg, rum, kvm, slut, r, uh, hyra) in enumerate(active):
    c = cols[i]
    sim[f'{c}30'], sim[f'{c}31'], sim[f'{c}32'] = adr, utg, avg
    sim[f'{c}33'], sim[f'{c}34'] = rum, kvm
    if slut is not None: sim[f'{c}35'] = slut
    sim[f'{c}43'], sim[f'{c}45'] = r, uh
    if hyra is not None: sim[f'{c}56'] = hyra
soft_cols = 'M N O P Q R S T U V W X Y'.split()
for i, vals in enumerate(soft):
    for col, v in zip(soft_cols, vals):
        if v is not None: utv[f'{col}{7 + i}'] = v


def amort(pris):
    lan = max(0, pris - KONTANT)
    ltv = lan / pris
    return lan * (0.02 if ltv > 0.7 else 0.01 if ltv > 0.5 else 0) / 12


for j, (adr, utg, slut, avg, rum, kvm, vals) in enumerate(archive):
    r = 12 + j
    utv[f'A{r}'], utv[f'B{r}'], utv[f'G{r}'] = adr, utg, avg
    if slut is not None: utv[f'C{r}'] = slut
    utv[f'I{r}'] = amort(slut or utg)
    utv[f'K{r}'], utv[f'L{r}'] = rum, kvm
    for col, v in zip(soft_cols, vals):
        if v is not None: utv[f'{col}{r}'] = v
wb.save(work)

subprocess.run(['soffice', '--headless', '--convert-to', 'xlsx', '--outdir', os.path.join(tmp, 'out'), work],
               check=True, capture_output=True)
res = openpyxl.load_workbook(os.path.join(tmp, 'out', 'in.xlsx'), data_only=True)
sim, utv = res['Simulering'], res['Utvärdering']

candidates, expected = [], []
for i, (adr, utg, avg, rum, kvm, slut, r, uh, hyra) in enumerate(active):
    c = cols[i]
    s = soft[i]
    candidates.append(dict(adress=adr, utgangspris=utg, slutpris=slut, avgift=avg, rum=rum, kvm=kvm,
                           ranta=r, underhall=uh, hyra=hyra, vatten=s[0], balkong=s[1], pplats=s[2],
                           gron=s[3], hiss=s[4], trappor=s[5], matbutik=s[6], tbana=s[7], branta=s[8],
                           vallentuna=s[9], dramaten=s[10], eget1=s[11], eget2=s[12]))
    g = lambda row: sim[f'{c}{row}'].value
    expected.append(dict(pris=g(36), lan=g(39), ltv=g(40), amortPct=g(44), rantaMan=g(47), amortMan=g(48),
                         avdragMan=g(49), kassaflode=g(50), verklig=g(51), altkost=g(53), vardeokning=g(54),
                         full=g(55), diffHyra=g(57) if g(57) != '' else None,
                         total=utv[f'AT{7 + i}'].value, rank=utv[f'AU{7 + i}'].value))
for j, (adr, utg, slut, avg, rum, kvm, s) in enumerate(archive):
    r = 12 + j
    candidates.append(dict(adress=adr, utgangspris=utg, slutpris=slut, avgift=avg, rum=rum, kvm=kvm,
                           ranta=None, underhall=0, hyra=None, arkiv=True, vatten=s[0], balkong=s[1],
                           pplats=s[2], gron=s[3], hiss=s[4], trappor=s[5], matbutik=s[6], tbana=s[7],
                           branta=s[8], vallentuna=s[9], dramaten=s[10], eget1=s[11], eget2=s[12]))
    expected.append(dict(pris=utv[f'D{r}'].value, lan=utv[f'F{r}'].value, rantaMan=utv[f'H{r}'].value,
                         boendekostnad=utv[f'J{r}'].value, total=utv[f'AT{r}'].value, rank=utv[f'AU{r}'].value))

bg = {k: sim[f'B{r}'].value for k, r in
      dict(maklarKr=9, reavinst=11, uppskov=14, vinstskatt=15, nettolikvid=16, kontantKarlavagen=18,
           kvarvarande=19).items()}
for c in candidates:
    for k in list(c):
        if c[k] is None: c[k] = ''
json.dump(dict(background=bg, kontant=KONTANT, candidates=candidates, expected=expected),
          open(os.path.join(here, 'fixture.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', bg)
