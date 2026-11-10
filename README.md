# AMain Hobbies · Flight Team

A mobile-friendly team tracker built from **AMAIN HOBBIES _ FLIGHT TEAM Promo.xlsx**. Static HTML, CSS, and JavaScript run on GitHub Pages. Supabase provides the shared PostgreSQL database and email sign-in. No application server or npm build is required.

## Workspace update

The app now includes installable PWA assets, system dark mode, linked dashboard summaries, teammate/manufacturer dropdowns, manufacturer contact cards, and marketing meeting notes.

**Existing Supabase projects:** run [03-workspace-upgrade.sql](supabase/03-workspace-upgrade.sql) in the SQL Editor to enable contact editing and meeting notes. It preserves existing records and adds team-only access plus version checks. For a fresh project, run migrations 01 through 05 in order. If you rerun 01 later, rerun 03 afterward to restore the contact update grant.

Preview sample data at `http://127.0.0.1:8090/?demo=1` after running `python -m http.server 8090 --bind 127.0.0.1 --directory docs`. The demo is read-only and uses fictional records. See [PREVIEW.md](PREVIEW.md) for screenshots.

Use **Install app** on a supported browser, or Share > Add to Home Screen on iPhone/iPad. Serve the production app over HTTPS. The manifest uses relative paths to support GitHub Pages subdirectories. The service worker caches only the public app shell; shared data and sign-in require a connection. Installation support varies by browser; see [MDN's installability guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Promotion expiration and teammate access

Run [04-promotion-expiration.sql](supabase/04-promotion-expiration.sql), then [05-team-management.sql](supabase/05-team-management.sql) in Supabase for this update. Both are safe to rerun. Migration 05 grants `kevndrc@gmail.com` administrator access, as requested.

Each product has an optional **Promotion expiration date**. It stays in the active tracker through that date in America/New_York and appears in **Completed** the next day, retaining all notes, stages, and links. The app derives this from the date on every load and refresh; there is no destructive move or scheduled database job. Completed promotions remain editable and exportable. Clear the expiration date or move it into the future to restore a product to the active tracker. Active dashboard counts and team assignments exclude completed promotions.

As the administrator, open **Team > Add teammate** and enter a display name and sign-in email. This grants workspace access and adds the name to assignment dropdowns on all devices after refresh. It does not automatically send an invitation email; the new teammate signs in normally. Duplicate emails and display names are rejected. Regular teammates cannot add members or grant themselves administrator rights. Membership changes use a restricted database function; browser credentials never include an admin secret.

## Brand Contacts update

Run [06-brand-contacts.sql](supabase/06-brand-contacts.sql) after the earlier migrations, then deploy the updated assets. It preserves the original contact fields and imports them into a list of contacts per brand. Existing category and discount data stays available on the Brand page; Brand Contacts omits those fields.

Use **Brand Contacts > + Add contact** or **+ Add another contact** inside a brand to add more people. Each contact has a name, email, phone, website, Facebook page, and notes. Save the brand to store all contacts together with the existing revision check. Facebook links accept Facebook domains only, normalize to HTTPS, and open in a new tab. The demo shows multiple fictional contacts; saving remains disabled.

The day theme uses off-white surroundings, white cards, navy text, and orange accents. Product cards use tighter spacing, larger detail text, and larger red, yellow, and green status indicators. System dark mode remains available.

## Set up shared storage

1. Create a Supabase project at https://supabase.com/dashboard.
2. In its SQL Editor, run [01-schema.sql](supabase/01-schema.sql), then [02-import-workbook.sql](supabase/02-import-workbook.sql), then [03-workspace-upgrade.sql](supabase/03-workspace-upgrade.sql), [04-promotion-expiration.sql](supabase/04-promotion-expiration.sql), and [05-team-management.sql](supabase/05-team-management.sql). The scripts can be rerun for this app schema without replacing existing product records. The schema script refreshes this app's policies and trigger and ensures the four initial teammates are present.
3. In project settings, copy the **project URL** and **publishable key** (`sb_publishable_…`). A legacy `anon` key also works. Never use a secret or `service_role` key in this app.
4. Under Authentication → URL Configuration, set the Site URL to `https://Harrykd33.github.io/Amain-Heli-Promo-App/` and add the same exact URL to allowed Redirect URLs. If GitHub reports a different Pages URL or you use a custom domain, use that URL instead. Add your local URL only if testing local sign-in.
5. Keep email authentication enabled and email confirmation required. Configure a custom SMTP provider for the team: Supabase's default email service may only send to project-authorized addresses and has strict limits. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
6. The supplied public settings are already in `docs/config.js`. Optionally, manage them through GitHub repository Settings → Secrets and variables → Actions → **Variables** as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; setting both overrides `docs/config.js` during deployment. These are public browser configuration, protected by the database's access policies.

The initial access list contains:

- kevndrc@gmail.com
- jasonb@amain.com
- datams@aol.com
- jbell.smack@gmail.com

If you use another email yourself, add it in the Supabase SQL Editor:

```sql
insert into public.team_members(email) values ('your-email@example.com') on conflict do nothing;
```

Members open the app, enter an approved email, and follow the sign-in link. Adding an email to this list does not send an invitation automatically. Unlisted users cannot read or write team records, even if they obtain an authentication session. The configured team administrator can add teammates in the app. Removing membership still requires a database administrator. To remove access:

```sql
delete from public.team_members where email='former-member@example.com';
```

## Publish to GitHub Pages

1. Push this repository to its `main` branch.
2. Under Settings → Pages → Build and deployment, select **GitHub Actions**.
3. Run the **Deploy Flight Team to GitHub Pages** workflow (or push a change).
4. Open the successful deployment's URL. Expected URL: `https://Harrykd33.github.io/Amain-Heli-Promo-App/`.

The workflow builds only `docs/` into the Pages artifact, with the public Supabase settings injected into `config.js`. Database scripts and workbook records are excluded from that artifact. If this GitHub repository is public, its source—including the SQL seed and initial email list—is public; keep the repository private if those source records are confidential. Pages can still require a supported GitHub plan for private-repository hosting.

Alternatively, configure Pages to deploy `docs/` from the main branch and enter the public project URL and publishable key directly in `docs/config.js`.

## Local preview and checks

```powershell
python -m http.server 8090 --bind 127.0.0.1 --directory docs
```

Visit `http://127.0.0.1:8090`. Without configuration, select **Explore the demo**. To test real sign-in locally, enter your public Supabase settings in `docs/config.js` and allow `http://localhost:8080/` as a Supabase redirect URL.

```powershell
python tools/build.py
node --test tests/model.test.mjs
python tools/check-ui.py
python tools/check-workspace.py
python tools/check-saves.py
```

Optional database policy checks use an embedded PostgreSQL engine: run `npm install`, then `npm run test:database`. These validate the SQL import, access restrictions, author stamps, and concurrent-save protection locally. They do not replace checking the connected Supabase project's configuration.

## How it works

- All six workbook products and 33 manufacturers are preserved, including separate entries with similar names, blank stage values, dates, and embargo text.
- Products use the same statuses, assignment names, production stages, and social channels as the workbook. Blank and N/A remain distinct.
- Members can add products, edit details, record notes, add manufacturers, and export filtered products to CSV.
- Changes are stored in Supabase and refreshed across devices every 20 seconds and when the app regains focus. Failed refreshes show a warning and preserve the last loaded records.
- Each save checks the version loaded when the form opened. If another teammate saved first, the second save is rejected and the form stays open so the editor can preserve their changes.
- The database stamps each save with the authenticated email and time. Client-supplied authors and revision numbers cannot override that stamp.
- Sign-in sessions are stored on each device. Team product records are not stored in localStorage.
- This imports the workbook once. It does not synchronize subsequent Excel changes.

`tools/import-workbook.py` reads the original Downloads file and preserves its records in `supabase/imported-workbook.json`; change its source path if needed. `python tools/generate-sql.py` rebuilds the seed script. Apply that script only when intending to add missing imported records.

Authentication reference: [Supabase email magic links](https://supabase.com/docs/guides/auth/auth-email-passwordless).
