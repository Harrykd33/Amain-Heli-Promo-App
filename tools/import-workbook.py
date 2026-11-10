import zipfile,xml.etree.ElementTree as E,json,datetime,pathlib
z=zipfile.ZipFile(r'C:\Users\dover\Downloads\AMAIN HOBBIES  _ FLIGHT TEAM Promo.xlsx'); ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
def rows(sheet):
    result=[]
    for r in E.fromstring(z.read('xl/worksheets/sheet%d.xml'%sheet)).findall('.//m:row',ns):
        cells={}
        for c in r:
            v=c.find('m:v',ns)
            cells[''.join(x for x in c.attrib['r'] if x.isalpha())]=strings[int(v.text)] if c.attrib.get('t')=='s' and v is not None else (v.text if v is not None else '')
        if any(cells.values()): result.append((int(r.attrib['r']),cells))
    return result
keys=['status','manufacturer','product','description','eta','received','assigned','unbox','build','flights','review','editing','fb','ig','yt','links']
products=[]
for row,cells in rows(1):
    if row<5 or not cells.get('C'): continue
    p=dict(zip(keys,[cells.get(chr(65+i),'') for i in range(16)]))
    p['status']=p['status'].split(' ',1)[-1] if p['status'] else 'On track'
    for k in ['eta','received']:
        if p[k]: p[k]=(datetime.datetime(1899,12,30)+datetime.timedelta(days=float(p[k]))).date().isoformat()
    p.update(id='import-'+str(row),notes=''); products.append(p)
manufacturers=[dict(name=c['A'],category=c.get('B',''),notes=c.get('C',''),discount=c.get('D','')) for r,c in rows(3) if r>1]
out=pathlib.Path(__file__).resolve().parents[1]/'supabase'/'imported-workbook.json'
out.write_text(json.dumps(dict(products=products,manufacturers=manufacturers),ensure_ascii=True,indent=2))
print('Imported',len(products),'products and',len(manufacturers),'manufacturers')
