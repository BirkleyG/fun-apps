# Fun Apps Monorepo

This repo contains three Vite apps:

- Launcher app (apps/launcher)
- Bible Reading Tracker (apps/bible-tracker)
- Grade Estimator (apps/grade-estimator)
- Coin Atlas (apps/coin-atlas)

## Folder Structure

```
fun-apps/
  apps/
    launcher/
    bible-tracker/
    grade-estimator/
    coin-atlas/
  README.md
```

## Launcher App

### Run Locally

```
cd apps/launcher
npm install
npm run dev
```

By default, the launcher links to the hosted app paths. For local development, point links to local dev servers:

```
# apps/launcher/.env
VITE_BIBLE_APP_URL=http://localhost:5174
VITE_GRADE_ESTIMATOR_URL=http://localhost:5175
VITE_COIN_ATLAS_URL=http://localhost:5176
```

### Build

```
cd apps/launcher
npm run build
```

## Bible Tracker App

### Firebase Setup

1. Create a Firebase project.
2. Enable Authentication > Sign-in method > Google.
3. Create a Firestore database (in production or test mode).
4. Add a Web App in Firebase to get your config values.

Set environment variables:

```
# apps/bible-tracker/.env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

An example file is provided at `apps/bible-tracker/.env.example`.

### Run Locally

```
cd apps/bible-tracker
npm install
npm run dev
```

The Bible Tracker dev server runs on port 5174.

### Build

```
cd apps/bible-tracker
npm run build
```

## Grade Estimator App

### Firebase Setup

This app also uses Firebase Authentication (Google) + Firestore and should use the same Firebase project as your other apps.

Set environment variables:

```
# apps/grade-estimator/.env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

An example file is provided at `apps/grade-estimator/.env.example`.

### Run Locally

```
cd apps/grade-estimator
npm install
npm run dev -- --port 5175
```

### Build

```
cd apps/grade-estimator
npm run build
```

## Coin Atlas App

### Firebase Setup

Coin Atlas uses Firebase Authentication (Google) + Firestore in the same shared `fun-apps` project.

Set environment variables:

```
# apps/coin-atlas/.env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

An example file is provided at `apps/coin-atlas/.env.example`.

### Run Locally

```
cd apps/coin-atlas
npm install
npm run dev
```

### Build

```
cd apps/coin-atlas
npm run build
```

## Firestore Security Rules (Example)

Use per-user access rules similar to the following:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /progress/{chapterId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /events/{eventId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /apps/{appId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Notes

- The launcher uses `VITE_BIBLE_APP_URL` to decide where to link. If unset, it defaults to `./bible-tracker/`.
- The launcher uses `VITE_GRADE_ESTIMATOR_URL` to decide where to link. If unset, it defaults to `./grade-estimator/`.
- This repository includes `.github/workflows/deploy-pages.yml`, which publishes:
  - Launcher at `/fun-apps/`
  - Bible Tracker at `/fun-apps/bible-tracker/`
  - Grade Estimator at `/fun-apps/grade-estimator/`
  - Coin Atlas at `/fun-apps/coin-atlas/`
- For GitHub Pages builds, set repository secrets for:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
