# Campus Issue Tracker — Updated Working Copy

This package contains a limited source-level update of the supplied Campus Issue Tracker prototype.

## Run it

The app loads Supabase and QRCode libraries from CDNs, so internet access is required. Serve this folder with your existing static host or a local web server. Open `index.html` through the server rather than changing file paths manually.

Files:
- `index.html` — page shell
- `static/app.js` — application logic
- `static/style.css` — styling, including mobile hamburger navigation, responsive refinements, and theme variables
- `CHANGELOG.md` — changes applied
- `TEST_REPORT.md` — checks run and manual regression checklist
- `docs/EXTERNAL_SETUP_AND_LIMITATIONS.md` — remaining Supabase/dashboard work
- `docs/AUTH_SETUP.md` and `docs/AUTH_SETUP.sql` — Supabase Auth and role setup
- `docs/AUTH_TESTING_GUIDE.md` — manual verification steps
- `docs/Bug_Fix_Record.pdf` — original bug record for reference

## Important security warning

This is **not production-ready**. Staff authentication now uses Supabase Auth and database-assigned roles, but the broader issue-management, moderation, feedback, and Storage workflows still need a complete server-side RLS/security review and live testing. Do not use it for sensitive campus data until those external security tasks are implemented and tested. See `docs/EXTERNAL_SETUP_AND_LIMITATIONS.md` and `docs/AUTH_SETUP.md`.

The update uses collision-resistant client IDs and `insert` rather than `upsert`, but database uniqueness must also be enforced in Supabase. It also includes a best-effort duplicate suggestion based only on reports currently loaded in the browser; this is a convenience, not an authoritative server-side duplicate check. A light/dark theme switcher and signed-photo URL refresh are included. Back up your database before applying any migration.


## Community support and moderation

The public board includes support/withdraw controls and report/photo flagging. Votes and flags are stored in shared Supabase tables, and reviewers see a shared moderation queue. Visitors receive a persistent anonymous Supabase Auth identity; signed-in users use their account identity. Apply `docs/supabase_shared_feedback_roles.sql` and enable anonymous sign-ins in Supabase Auth before using these controls. Database RLS is required; this is not a complete production security review.

## Supabase Auth update

Staff sign-in now uses Supabase Auth email/password accounts and database-assigned roles. Follow `docs/AUTH_SETUP.md` and run `docs/AUTH_SETUP.sql` before testing staff login. The app no longer uses the old `admin123`, `staff123`, or `principal123` browser demo passwords. User creation and role assignment are intentionally performed through the Supabase dashboard/SQL owner workflow; no service-role key belongs in frontend code. See `docs/AUTH_TESTING_GUIDE.md` for verification steps and known limits.
