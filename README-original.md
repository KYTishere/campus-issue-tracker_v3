# Campus Issue Tracker — Refactored Prototype

## Files
- `index.html`: page shell and external library links.
- `style.css`: responsive styling and theme.
- `app.js`: application logic, Supabase access, report flow, dashboard, QR codes and prototype account settings.

## Fixes in this version
- Supabase polling no longer rebuilds the whole interface every 10 seconds when the database rows have not changed.
- If remote data changes while a text field is focused, the render is postponed until the user finishes typing.
- Status notes can be saved with Enter or the **Save note** button without changing status. Status buttons still save the note together with the selected status.
- Removed the GPS control and GPS capture code. QR location prefill remains.
- Demo role session can persist in the current browser; users can log out.
- Account settings allow changing the current demo role password after checking the previous password.
- Private Storage photo signed URLs remain supported.

## Important security limitation
This is still a **prototype**, not production authentication. The demo role passwords and role selection are controlled by front-end JavaScript. Browser-local password changes only apply in that browser and do not securely update a central account. Do not use this as real access control for campus data. Before real deployment, replace the demo login/account screen with Supabase Auth, add a role mapping enforced by PostgreSQL RLS, and configure least-privilege Storage policies. Never put a Supabase service-role/secret key in browser code.

## Supabase configuration
At the top of `app.js`, find `SUPABASE CONNECTION`. Keep the project URL and publishable/anon key only. Do not add a service-role/secret key.

## Test checklist
1. Submit a report without a photo.
2. Submit a report with a photo and verify both the Storage object and `issues.photo_url` path.
3. Open the dashboard and verify the photo displays from the private bucket.
4. Open an issue, type a note and press Enter; confirm the note remains in history.
5. Type in the note field for longer than 10 seconds; verify it is not erased.
6. Change status with a note and verify the status/history in Supabase.
7. Hide an issue and verify public-board behavior.
8. Delete a disposable test issue and confirm both its row and photo object are removed.
9. Sign in, reload the page, and verify session persistence; log out and verify access is cleared.
10. Change the demo password in Account settings and confirm the old password no longer works in that same browser.

## Default demo passwords
- Admin: `admin123`
- Staff: `staff123`
- Principal: `principal123`

These are public demo defaults. Change them for local testing, but remember this does not secure the website. Use Supabase Auth for real users.
