"""Mobile navigation and background-sync regression checks using the local API double."""
import ast
from pathlib import Path
from playwright.sync_api import sync_playwright
source=ast.parse(Path('tools/check-saves.py').read_text(encoding='utf-8-sig'))
mock=next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='mock' for t in n.targets))
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://esm.sh/**',lambda r:r.fulfill(content_type='text/javascript',body=mock))
 page.goto('http://127.0.0.1:8096/')
 page.locator('[data-nav=contacts]').wait_for()
 assert page.locator('[data-nav=brands]').count()==0
 page.evaluate("window.originalMain=document.querySelector('#main');window.draws=0;new MutationObserver(()=>window.draws++).observe(document.querySelector('#app'),{childList:true})")
 page.evaluate("window.dispatchEvent(new Event('focus'))")
 page.wait_for_timeout(350)
 assert page.evaluate("originalMain===document.querySelector('#main')")
 nav=page.get_by_role('navigation',name='Main navigation');nav.evaluate('(el)=>el.scrollLeft=el.scrollWidth')
 before=nav.evaluate('(el)=>el.scrollLeft')
 page.locator('[data-nav=completed]').tap();page.wait_for_timeout(200)
 assert page.evaluate('draws')==1
 assert abs(nav.evaluate('(el)=>el.scrollLeft')-before)<=1
 page.locator('[data-nav=contacts]').tap();page.locator('[data-brand="0"]').click()
 page.get_by_label('Contact name',exact=True).fill('Unsaved contact')
 page.evaluate("window.dispatchEvent(new Event('online'))")
 page.wait_for_timeout(200)
 assert page.get_by_label('Contact name',exact=True).input_value()=='Unsaved contact'
 page.once('dialog',lambda d:d.accept());page.keyboard.press('Escape')
 box=page.locator('.sidebar .brand-logo').bounding_box()
 assert abs(box['x'])<=1 and abs(box['width']-390)<=1,box
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='test-results/mobile-combined-header.png',full_page=True)
 page.goto('http://127.0.0.1:8096/?demo#brands')
 assert page.get_by_role('heading',name='Brands & Contacts.').is_visible()
 assert not errors,errors
 browser.close()
 print('Unchanged sync retains DOM; one render per tap; forms preserved; full-width mobile header; legacy Brands route passed.')
