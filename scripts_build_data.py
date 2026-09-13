#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, re, sys

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; TERR=DATA/'territories'; DATA.mkdir(exist_ok=True); TERR.mkdir(exist_ok=True)
UA='GlobalAtlasBuilder/1.0 (+https://github.com/)'

def get_json(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=90) as r:
        return json.load(r)

def compact(obj): return json.dumps(obj,separators=(',',':'),ensure_ascii=False)

world_url='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
world=get_json(world_url)
from shapely.geometry import shape, mapping
features=[]
for f in world.get('features',[]):
    p=f.get('properties') or {}; geom=f.get('geometry')
    if not geom: continue
    try: geom=mapping(shape(geom).simplify(0.10,preserve_topology=True))
    except Exception: pass
    name=p.get('ADMIN') or p.get('NAME') or p.get('NAME_EN') or 'Unknown'
    iso=p.get('ADM0_A3') or p.get('ISO_A3') or p.get('SOV_A3') or '-99'
    cont=p.get('CONTINENT') or 'Other'
    pop=p.get('POP_EST')
    gdp=p.get('GDP_MD') or p.get('GDP_MD_EST')
    features.append({'type':'Feature','properties':{'name':name,'iso_a3':iso,'continent':cont,'pop_est':pop,'gdp_md_est':gdp},'geometry':geom})
(DATA/'world-data.js').write_text('window.ATLAS_WORLD='+compact({'type':'FeatureCollection','features':features})+';',encoding='utf8')

from countryinfo import CountryInfo
from babel import Locale
from babel.numbers import get_currency_name,get_currency_symbol
import pycountry
ru=Locale('ru'); meta={}
for key,d in CountryInfo.all().items():
    iso=d.get('ISO') if isinstance(d.get('ISO'),dict) else {}
    a3=iso.get('alpha3'); a2=iso.get('alpha2')
    if not a3: continue
    curr=[]
    for code in (d.get('currencies') or [])[:4]:
        try: curr.append({'code':code,'name':get_currency_name(code,locale='ru_RU'),'symbol':get_currency_symbol(code,locale='ru_RU')})
        except Exception: curr.append({'code':code,'name':code,'symbol':code})
    langs=[]
    for code in (d.get('languages') or [])[:6]:
        try:
            row=pycountry.languages.get(alpha_2=code) or pycountry.languages.get(alpha_3=code)
            langs.append(row.name if row else code)
        except Exception: langs.append(code)
    try: name_ru=ru.territories.get(a2) if a2 else None
    except Exception: name_ru=None
    meta[a3]={'name':d.get('name') or key.title(),'nameRu':name_ru or d.get('name') or key.title(),'nativeName':d.get('nativeName'),'alpha2':a2,'alpha3':a3,'capital':d.get('capital'),'region':d.get('region'),'subregion':d.get('subregion'),'population':d.get('population'),'area':d.get('area'),'currencies':curr,'languages':langs,'latlng':d.get('latlng'),'borders':d.get('borders') or [],'timezones':d.get('timezones') or []}
aliases={'United States of America':'USA','Russia':'RUS','Dem. Rep. Congo':'COD','Congo':'COG','Central African Rep.':'CAF','S. Sudan':'SSD','Dominican Rep.':'DOM','Bosnia and Herz.':'BIH','Macedonia':'MKD','Czechia':'CZE','Korea':'KOR','North Korea':'PRK','W. Sahara':'ESH','Eq. Guinea':'GNQ','eSwatini':'SWZ','Solomon Is.':'SLB','Timor-Leste':'TLS','Trinidad and Tobago':'TTO','The Bahamas':'BHS','Falkland Is.':'FLK','Fr. S. Antarctic Lands':'ATF','Greenland':'GRL','Puerto Rico':'PRI','Palestine':'PSE','Taiwan':'TWN'}
for f in features:
    p=f['properties']; iso=p.get('iso_a3'); target=meta.get(iso) or meta.get(aliases.get(p.get('name')))
    if target:
        target['mapPopulation']=p.get('pop_est'); target['gdpMdEst']=p.get('gdp_md_est'); target['continent']=p.get('continent')
(DATA/'country-meta.js').write_text('window.ATLAS_META='+compact(meta)+';\nwindow.ATLAS_ALIASES='+compact(aliases)+';',encoding='utf8')

adm1_url='https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/UKR/ADM1/geoBoundaries-UKR-ADM1_simplified.geojson'
adm1=get_json(adm1_url)
wanted=[('Крым',['crimea','krym']),('Севастополь',['sevastopol']),('Донецкая область',['donetsk','donetska']),('Луганская область',['luhansk','lugansk','luhanska']),('Запорожская область',['zaporiz','zaporizka']),('Херсонская область',['kherson','khersonska'])]
selected=[]
for display,keys in wanted:
    hit=None
    for f in adm1.get('features',[]):
        p=f.get('properties') or {}; nm=' '.join(str(p.get(k,'')) for k in ['shapeName','name','NAME_1','shapeISO']).lower()
        if any(key in nm for key in keys):
            hit=f; break
    if hit:
        obj={'type':'Feature','properties':{'name':display,'classification':'RU-constitutional-layer'},'geometry':hit.get('geometry')}
        selected.append({'name':display,'geojson':obj})
        slug=re.sub(r'[^a-z0-9]+','-',keys[0]).strip('-')
        (TERR/f'{slug}.geojson').write_text(compact(obj),encoding='utf8')
    else:
        print('WARNING: territory not found:',display,file=sys.stderr)
special={'label':'Российская конституционная классификация','note':'Крым, Севастополь, Донецкая, Луганская, Запорожская и Херсонская территории визуально объединяются с Россией. Международный статус этих территорий оспаривается.','features':selected}
(DATA/'special-territories.js').write_text('window.ATLAS_SPECIAL='+compact(special)+';',encoding='utf8')
print(f'Generated: {len(features)} country geometries, {len(meta)} country records, {len(selected)} special territories')
