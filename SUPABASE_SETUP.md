# Connect Good Grid to Supabase

Ranked accounts, daily challenges, and leaderboard functions are prepared in this repository. They stay unavailable until you create a Supabase project and connect its keys. Casual puzzles continue to work without Supabase.

## 1. Create a free project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard) and choose **New project**.
2. Create an organization if prompted, name the project **Good Grid**, choose a strong database password, and select a region near your players.
3. Choose the Free plan. Keep the database password in a password manager; it is not used by the website.
4. Wait for the project to finish provisioning.

## 2. Set up browser authentication

In the Supabase dashboard, open **Authentication → URL Configuration**.

- Set **Site URL** to the published site URL. For the current GitHub repository, that should be `https://teslaterrain.github.io/GoodGrid/` if the Pages site uses the default URL. Confirm the exact URL in the repository's **Settings → Pages** page.
- Add that same URL under **Redirect URLs**.
- Add `http://localhost:8000/**` as a redirect URL if you run the local site on port 8000.
- Email confirmation is enabled by default on many projects. Keep it enabled so new accounts confirm their email before ranked play.

The current app supports email/password sign-in, unique public usernames, confirmation links, and password recovery.

## 3. Configure the public browser key

In **Project Settings → API**, copy the **Project URL** and **publishable key** (older projects may label the public key `anon`). Put them in `supabase-config.js`:

```js
window.GOODGRID_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "YOUR_PUBLISHABLE_KEY"
};
```

The publishable key is designed to be used by the browser. Never put a secret key or the legacy `service_role` key in this file, HTML, or any other file served to website visitors.

## 4. Apply the database migration

Install the Supabase CLI if needed, then from the project folder run these commands in PowerShell:

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push
```

Find the project reference in the project URL, between `https://` and `.supabase.co`. `db push` applies the SQL migration in `supabase/migrations/`, which creates the profiles, daily challenge, attempt, and leaderboard tables and their access rules.

## 5. Add Edge Function secrets and deploy

In the Supabase dashboard, open **Project Settings → Edge Functions → Secrets** (the section may appear under **Edge Functions → Manage secrets**). Add these secrets:

- `GOODGRID_SUPABASE_URL` — the Project URL.
- `GOODGRID_PUBLISHABLE_KEY` — the publishable key (or legacy `anon` key).
- `GOODGRID_SECRET_KEY` — a Supabase secret key. If the project only offers legacy API keys, use its `service_role` key here.

These are server-side function settings. Never put `GOODGRID_SECRET_KEY` into the repository, browser configuration, or a message. The Edge Functions use it to perform privileged database operations after verifying the signed-in user.

Then deploy the four functions from PowerShell:

```powershell
npx supabase@latest functions deploy ranked-start
npx supabase@latest functions deploy ranked-progress
npx supabase@latest functions deploy ranked-submit
npx supabase@latest functions deploy leaderboard
```

## 6. Publish the site

Commit and push the updated website after `supabase-config.js` has the project URL and publishable key. GitHub Pages serves the static frontend; Supabase hosts authentication, database, and ranked verification. Open the published site, create an account, confirm the email, then try a daily challenge.

## Notes about ranked times

Ranked attempts are limited to one per account, puzzle size, and UTC date. The server records the start time and checks the submitted board against the server-held solution before recording the elapsed time. A resumed attempt keeps its original start time. This makes submitted scores harder to alter from the browser, but it cannot prevent someone from using outside help or reverse-engineering a public puzzle. Daily puzzles use a reproducible generator; the current generator does not check that every generated puzzle has a unique solution, and Medium difficulty still needs playtesting and calibration.
