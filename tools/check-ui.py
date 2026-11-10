"""Smoke-test the disconnected setup and read-only demo; requires Playwright."""
from playwright.sync_api import sync_playwright
import pathlib,json
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'test-results';out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1080},device_scale_factor=1)
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/config.js',lambda route:route.fulfill(content_type='text/javascript',body='window.FLIGHT_TEAM_CONFIG={supabaseUrl:"",supabasePublishableKey:""};'))
    page.goto('http://localhost:8080/');page.get_by_role('button',name='Explore the demo').click()
    page.get_by_role('heading',name='The product hangar.').wait_for()
    assert page.locator('.product-card').count()==3
    page.screenshot(path=str(out/'desktop.png'),full_page=True)
    page.get_by_role('textbox',name='Search products').fill('Falcon')
    assert page.locator('.product-card').count()==1
    page.get_by_role('textbox',name='Search products').fill('no-such-product')
    assert page.locator('.product-card').count()==0
    page.get_by_role('button',name='Clear filters').click()
    page.get_by_role('button',name='Blocked',exact=True).click()
    assert page.locator('.product-card').count()==1
    page.get_by_role('button',name='View & edit').click()
    assert page.locator('dialog').is_visible()
    assert page.get_by_role('button',name='Save changes').is_disabled()
    page.keyboard.press('Escape')
    page.get_by_role('button',name='Team',exact=True).click()
    assert page.locator('.team-card').count()>=4
    page.get_by_role('button',name='Manufacturers',exact=True).click()
    assert page.locator('.brand-card').count()==3
    page.get_by_role('button',name='Add manufacturer',exact=False).click()
    assert page.get_by_role('button',name='Add manufacturer',exact=True).is_disabled()
    page.keyboard.press('Escape')
    page.get_by_role('button',name='Products',exact=False).first.click()
    page.get_by_role('button',name='All products',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.screenshot(path=str(out/'mobile.png'),full_page=True)
    page.get_by_role('button',name='View & edit').first.click()
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.screenshot(path=str(out/'mobile-editor.png'),full_page=True)
    page.get_by_label('Product / item *').fill('Changed locally')
    page.once('dialog',lambda d:d.dismiss())
    page.get_by_role('button',name='Cancel',exact=True).click()
    assert page.locator('dialog').is_visible()
    page.once('dialog',lambda d:d.accept())
    page.get_by_role('button',name='Cancel',exact=True).click()
    assert not page.locator('dialog').is_visible()
    with page.expect_download() as download:
        page.get_by_role('button',name='Export CSV').click()
    download.value.save_as(str(out/'demo-export.csv'))
    assert 'Falcon 700' in (out/'demo-export.csv').read_text(encoding='utf-8-sig')
    assert not errors,errors
    browser.close()
    print(json.dumps({'desktop':'passed','mobile':'passed at 390px','search_and_filters':'passed','dialogs_and_unsaved_changes':'passed','export':'passed','browser_errors':errors}))
