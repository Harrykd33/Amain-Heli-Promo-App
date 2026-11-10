"""Build GitHub Pages assets. Only public configuration belongs in this output."""
import json,os,pathlib,shutil,re
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'dist'
out.mkdir(exist_ok=True)
for p in (root/'docs').iterdir():
    if p.is_file(): shutil.copy2(p,out/p.name)
url=os.environ.get('SUPABASE_URL','').strip()
key=os.environ.get('SUPABASE_PUBLISHABLE_KEY','').strip()
if bool(url)!=bool(key): raise SystemExit('Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.')
if url:
    if not re.fullmatch(r'https://[a-zA-Z0-9-]+\.supabase\.co/?',url): raise SystemExit('Invalid Supabase URL.')
    if key.startswith('sb_secret_'): raise SystemExit('Use a publishable key, never a secret key.')
    if key.startswith('eyJ'):
        import base64
        payload=key.split('.')[1]; claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
        if claims.get('role')!='anon':raise SystemExit('Only the legacy anon key may be used in the browser.')
    elif not key.startswith('sb_publishable_'): raise SystemExit('Use a Supabase publishable key.')
    (out/'config.js').write_text('window.FLIGHT_TEAM_CONFIG = '+json.dumps({'supabaseUrl':url.rstrip('/'),'supabasePublishableKey':key})+';\n',encoding='utf-8')
(out/'.nojekyll').touch()
config=(out/'config.js').read_text(encoding='utf-8')
configured=bool(url) or bool(re.search(r"supabasePublishableKey:\s*['\"]([^'\"]+)",config))
print('Static app ready in dist/. '+('Supabase client configured; database setup and sign-in still need verification.' if configured else 'No backend configured; setup screen and read-only demo are available.'))
