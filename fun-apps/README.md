# Fun Apps Monorepo

This repo contains two independent Vite React TypeScript apps:

- Launcher app (apps/launcher)
- Bible Reading Tracker (apps/bible-tracker)
- Grade Estimator (apps/grade-estimator)

## Folder Structure

```
fun-apps/
  apps/
    launcher/
    bible-tracker/
    grade-estimator/
  README.md
```

## Launcher App

### Run Locally

```
cd apps/launcher
npm install
npm run dev
```

By default, the launcher links to `/bible`. For local development, point it to the Bible Tracker dev server:

```
# apps/launcher/.env
VITE_BIBLE_APP_URL=http://localhost:5174
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
