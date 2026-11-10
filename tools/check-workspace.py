"""Check summary routes, contact/meeting dialogs, PWA assets, and system themes."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
out=root/'test-results';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1080},color_scheme='light')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8090/?demo=1')
 page.locator('.product-card').first.wait_for()
 assert page.locator('.product-card').count()==3
 for summary,count in [('progress',1),('attention',1),('social',1),('all',3)]:
  page.locator(f'[data-summary={summary}]').click()
  page.wait_for_function('(n)=>document.querySelectorAll(".product-card").length===n',arg=count)
  assert page.locator(f'[data-summary={summary}]').get_attribute('aria-pressed')=='true'
 page.locator('[data-summary=social]').click()
 page.reload();page.locator('.product-card').first.wait_for()
 assert page.locator('.product-card').count()==1
 assert 'Falcon' in page.locator('.product-card').inner_text()
 page.get_by_role('button',name='View & edit').first.click()
 assert page.get_by_label('Assigned to').evaluate('(el)=>el.tagName')=='SELECT'
 assert page.locator('select[name=manufacturer]').evaluate('(el)=>el.tagName')=='SELECT'
 assert page.get_by_label('Assigned to').locator('option').count()>=5
 page.get_by_role('button',name='Cancel',exact=True).click()
 page.locator('[data-summary=all]').click()
 page.screenshot(path=str(out/'preview-desktop.png'),full_page=True)
 assert page.locator('.brand-team').count()==0
 assert page.locator('.brand-logo').get_attribute('src')=='./promotion-logo.png'
 page.locator('[data-nav=completed]').click()
 assert page.locator('.product-card').count()==1
 assert 'completed promotion' in page.locator('.product-card').inner_text()
 page.screenshot(path=str(out/'preview-completed.png'),full_page=True)
 page.reload();page.locator('.product-card').wait_for()
 assert page.locator('.product-card').count()==1
 page.locator('[data-nav=team]').click()
 page.get_by_role('button',name='Add teammate').click()
 assert page.get_by_label('Teammate name *').is_visible()
 assert page.locator('#teammate-form button[type=submit]').is_disabled()
 page.get_by_role('button',name='Cancel',exact=True).click()
 page.locator('[data-nav=contacts]').click()
 assert page.locator('.brand-card').count()==3
 page.locator('[data-brand="0"]').click()
 assert page.get_by_label('Contact email',exact=True).first.input_value()=='partner@example.com'
 assert page.get_by_role('button',name='Save contact').is_disabled()
 assert page.get_by_label('Category',exact=True).count()==0
 assert page.get_by_label('AMain discount details').count()==0
 assert page.locator('.contact-fields').count()==2
 page.get_by_role('button',name='Add another contact').click()
 assert page.locator('.contact-fields').count()==3
 fb=page.locator('#brand-form a.facebook-link').first
 assert fb.get_attribute('href')=='https://www.facebook.com/AMainHobbies'
 assert fb.get_attribute('target')=='_blank'
 page.once('dialog',lambda d:d.accept())
 page.get_by_role('button',name='Cancel',exact=True).click()
 page.locator('[data-nav=meetings]').click()
 assert page.locator('.meeting-card').count()==1
 page.locator('[data-meeting="0"]').click()
 assert 'Kevin' in page.get_by_label('Action items & owners').input_value()
 page.get_by_role('button',name='Cancel',exact=True).click()
 page.screenshot(path=str(out/'preview-meetings.png'),full_page=True)
 page.emulate_media(color_scheme='dark')
 assert page.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()')=='#0e191d'
 page.locator('[data-nav=products]').click()
 page.screenshot(path=str(out/'preview-dark.png'),full_page=True)
 for width in (390,760,1024):
  page.set_viewport_size({'width':width,'height':844})
  for nav in ('products','completed','team','brands','contacts','meetings'):
   page.locator(f'[data-nav={nav}]').click()
   assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),(width,nav)
 page.set_viewport_size({'width':390,'height':844})
 page.locator('[data-nav=products]').click()
 page.screenshot(path=str(out/'preview-mobile-dark.png'),full_page=True)
 page.emulate_media(color_scheme='light')
 page.screenshot(path=str(out/'preview-mobile.png'),full_page=True)
 page.locator('[data-nav=contacts]').click();page.locator('[data-brand="0"]').click()
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 page.get_by_role('button',name='Cancel',exact=True).click()
 manifest=page.request.get('http://127.0.0.1:8090/manifest.webmanifest').json()
 assert manifest['display']=='standalone'
 assert {i['sizes'] for i in manifest['icons']}=={'192x192','512x512'}
 page.evaluate('navigator.serviceWorker.ready')
 assert page.evaluate('navigator.serviceWorker.controller!==null')
 assert not errors,errors
 print(json.dumps({'summary_routes':'passed including reload','contacts_and_meetings':'passed','dropdowns':'passed','system_dark_mode':'passed','responsive':'390, 760, 1024px passed','manifest_and_service_worker':'passed','browser_errors':errors}))
 browser.close()
