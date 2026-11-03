# GoodGrid React + Expo

This is the new React Native and web frontend. It lives in its own folder so the current static website and its Supabase functions stay unchanged while the app is built.

The app uses Expo Router and React Native components for shared iOS and web screens. Create React App is not used.

## Run locally

From this folder, install dependencies once and start the web app:

```powershell
npm install
npm run web
```

To open the native development server instead, run `npm start`. Expo Go can open the QR code on a phone; iOS simulator builds require macOS and Xcode.

## Supabase accounts and casual sync

The app uses the GoodGrid Supabase project with its public publishable key. The key is safe to include in the client; never put a Supabase `secret` or `service_role` key in this app. Copy `.env.example` to `.env` if you need to configure a different project. Restart Expo after changing environment variables.

The app reuses the existing `public.casual_saves` table and its row-level security policies. A signed-in user's newest casual save is synced across devices; signed-out users continue to save progress on the current device. If offline, local saving continues and cloud sync retries while playing after connectivity returns.

For confirmation links in a native build, add `goodgrid://auth/callback` to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. For the local Expo web app, add `http://localhost:8081/auth/callback`. Expo Go uses a development URL that can change with the local network address; allow the current Expo development redirect URL when testing signup in Expo Go. Email confirmation must be enabled for signup to send its confirmation message.

For EAS builds, configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as build environment variables too; local `.env` files are ignored by git.

## Current screens

- Home with working Ranked and Casual navigation
- Casual size and difficulty selection
- A locally generated playable puzzle for all three board sizes
- Casual notes, automatic candidate cleanup, mistake highlighting, and undo
- Casual puzzle and timer saved locally so play resumes after navigation or reload
- Ranked daily challenge choices and a leaderboard placeholder
- Supabase email sign-in and signup
- Cross-device sync for signed-in casual progress

Ranked daily puzzle verification and score submission have not yet been connected to the Expo frontend. The existing website continues to provide those features.
