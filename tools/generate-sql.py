"""Produce the one-time Supabase seed from the preserved workbook import."""
import pathlib,json
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'supabase/imported-workbook.json').read_text())
def literal(v):return 'NULL' if v is None else "'"+str(v).replace("'","''")+"'"
lines=['-- Workbook data import. Run AFTER 01-schema.sql. Safe to rerun: existing records are preserved.','BEGIN;']
for m in data['manufacturers']:
    keys=list(m)
    lines.append('INSERT INTO public.manufacturers ('+','.join(keys)+') VALUES ('+','.join(literal(m[k]) for k in keys)+') ON CONFLICT (name) DO NOTHING;')
for p in data['products']:
    p=dict(p)
    for k in ['eta','received']:p[k]=p[k] or None
    keys=list(p)
    lines.append('INSERT INTO public.products ('+','.join(keys)+') VALUES ('+','.join(literal(p[k]) for k in keys)+') ON CONFLICT (id) DO NOTHING;')
lines.append('COMMIT;')
(root/'supabase/02-import-workbook.sql').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Generated seed for',len(data['products']),'products and',len(data['manufacturers']),'manufacturers.')
