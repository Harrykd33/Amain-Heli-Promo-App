# AMain Hobbies · Flight Team

A mobile-friendly team tracker built from **AMAIN HOBBIES _ FLIGHT TEAM Promo.xlsx**. Static HTML, CSS, and JavaScript run on GitHub Pages. Supabase provides the shared PostgreSQL database and email sign-in. No application server or npm build is required.

## Current status

The interface, Pages workflow, access policies, and workbook import are prepared. Your supplied Supabase URL and publishable key are configured in `docs/config.js`. **The database schema and workbook import still need to be run in Supabase before shared records can load or save.** GitHub Pages publication is also still pending. The real workbook data is in the SQL import, not in the public website assets.

## Set up shared storage

1. Create a Supabase project at https://supabase.com/dashboard.
2. In its SQL Editor, run [01-schema.sql](supabase/01-schema.sql), then [02-import-workbook.sql](supabase/02-import-workbook.sql). Both scripts can be rerun for this app schema without replacing existing product records. The schema script refreshes this app's policies and trigger and ensures the four initial teammates are present.
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

Members open the app, enter an approved email, and follow the sign-in link. Adding an email to this list does not send an invitation automatically. Unlisted users cannot read or write team records, even if they obtain an authentication session. Only a database administrator can change membership. To remove access:

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
python -m http.server 8080 --directory docs
```

Visit `http://localhost:8080`. Without configuration, select **Explore the demo**. To test real sign-in locally, enter your public Supabase settings in `docs/config.js` and allow `http://localhost:8080/` as a Supabase redirect URL.

```powershell
python tools/build.py
node --test tests/model.test.mjs
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
