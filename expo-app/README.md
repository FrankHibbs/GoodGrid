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

## Current screens

- Home with working Ranked and Casual navigation
- Casual size and difficulty selection
- A locally generated playable puzzle for all three board sizes
- Casual notes, automatic candidate cleanup, mistake highlighting, and undo
- Casual puzzle and timer saved locally so play resumes after navigation or reload
- Ranked daily challenge choices and a leaderboard placeholder

Ranked daily puzzle verification, accounts, score submission, and cloud sync have not yet been connected to the Expo frontend. The existing site continues to provide those features.

Casual progress is stored on the current device. Cross-device sync for signed-in users will be added alongside the Expo app's account and Supabase integration.
