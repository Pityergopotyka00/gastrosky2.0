"""Inspect the public 2025/26 Sistema Project Italia PDF for real catalogue codes."""
import json,re,urllib.request,io,datetime
from pathlib import Path
from pypdf import PdfReader
URL='https://www.projectsystems.it/wp-content/uploads/2025/05/SistemaProject-Italia-catalogo-2025.pdf'
req=urllib.request.Request(URL,headers={'User-Agent':'GastroSkyCatalogReview/1.0 (public manufacturer catalogue)','Accept':'application/pdf'})
with urllib.request.urlopen(req,timeout=80) as reply:
    if 'pdf' not in (reply.headers.get('Content-Type') or ''):
        raise ValueError('Manufacturer catalog did not return a PDF')
    content=reply.read()
    if len(content)>25000000:raise ValueError('Unexpectedly large catalogue')
reader=PdfReader(io.BytesIO(content))
products=json.loads(Path('data/catalog-products.json').read_text())
have={re.sub(r'[^A-Z0-9]','',str(p['sku']).upper()) for p in products if p['manufacturer']=='Sistema Project Italia'}
found=[]
for index,page in enumerate(reader.pages):
    try:text=page.extract_text(extraction_mode='layout') or ''
    except: text=page.extract_text() or ''
    if index<35:continue
    compact=re.sub(r'\s+',' ',text)
    for m in re.finditer(r'\b(?:COD(?:ICE)?\.?\s*)([A-Z][A-Z0-9]{2,19})(?:\s|/|\,|\.|$)',compact,re.I):
        code=m.group(1).upper()
        if code in {'CATALOGUE','COD','CODE','CATALOG','CODICE','PROJECT','SISTEMA'}:continue
        existing=re.sub(r'[^A-Z0-9]','',code) in have
        context=compact[max(0,m.start()-140):min(len(compact),m.end()+230)]
        found.append({'sku':code,'page_number':index+1,'already_present':existing,'context':context})
seen={}
for x in found:
    if x['sku'] not in seen:seen[x['sku']]=x
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':URL,'pages':len(reader.pages),
        'total_mentions':len(found),'unique_codes':len(seen),
        'new_codes':sorted([x for x in seen.values() if not x['already_present']],key=lambda x:x['page_number']),
        'all_codes':list(seen.values())}
Path('data/sistema-catalog-code-probe.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pages':report['pages'],'unique_codes':report['unique_codes'],'new_count':len(report['new_codes']),
    'examples':report['new_codes'][:35]},ensure_ascii=False))
