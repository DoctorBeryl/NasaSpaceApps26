# Crew sign-in: face recognition + Firebase Auth

Crew choose how to sign in on their first visit, and the choice is remembered:

- **Face scan.** Returning crew look at the lens and turn their head slightly. New crew type a name, then do a ten-second guided scan. Before the camera turns on, the page says that face data is **stored locally on this device and is for demo purposes only**. The same note stays under the camera.
- **Email and password.** A standard Firebase Email/Password account (create, sign in, reset by email), for anyone who'd rather not scan their face. It needs Firebase mode.

Face and password accounts are separate Firebase users, even for the same person.

| Piece | File |
|-------|------|
| Sign-in page | `login.html` + `js/login.js` |
| Session and profile API for every page | `js/auth.js` (`window.AstraAuth`) |
| Matching, enrollment, Firebase custom tokens | `server/auth.js`, mounted in `server.js` under `/api/auth/*` |
| Firestore security rules | `firestore.rules` |
| Face templates (gitignored, never served) | `server/data/faces.json` |

## How it works

```
browser (login.html)                         server.js  /api/auth/*                 Firebase
---------------------                        ----------------------                 --------
camera → face-api.js → 128-number descriptor
  sign-in: 3 frontal + 1 head turn ───────▶  POST /face/verify
                                             nearest enrolled crew (distance < 0.5)
                                             mint custom token (RS256, service acct)
  signInWithCustomToken(token) ◀──────────── { uid, name, token, isNew:false }
  ────────────────────────────────────────────────────────────────────────────────▶  Auth session (uid)
  users/{uid} profile doc  ◀──────────────────────────────────────────────────────▶  Firestore
```

- **Face recognition** is [`@vladmandic/face-api`](https://github.com/vladmandic/face-api) 1.7.15 (MIT), the maintained fork of face-api.js, loaded from jsDelivr. It uses three models (about 7 MB, cached after the first load): TinyFaceDetector, 68-point landmarks, and the ResNet-34 face recognizer, which outputs a 128-number descriptor.
- **Images never leave the browser.** Only descriptors are sent to the server, which stores them in `server/data/faces.json`.
- **Matching** compares descriptors by Euclidean distance. A crew member's score is the median, over the probes, of the distance to their closest stored template. It accepts below `FACE_MATCH_THRESHOLD` (0.5; the library's usual cut-off is 0.6). Enrolling a face that already matches someone returns 409, and the page signs that person in instead. Confident sign-ins add a template (up to 24 per person), so the system adapts to lighting and hair changes.
- **Liveness is basic.** Sign-in requires a head turn, measured as nose position against the jaw line from the landmarks, so a printed photo fails. A video of the person would pass. For the pitch, describe it as a demo-grade check; a real system needs depth or IR (the glasses could carry an IR camera).
- **Firebase mode:** the server signs a [custom token](https://firebase.google.com/docs/auth/admin/create-custom-tokens#create_custom_tokens_using_a_third-party_jwt_library) with the service-account key, using Node's `crypto` (no `firebase-admin` package). The browser exchanges it with `signInWithCustomToken`, so Firebase holds a real session with a stable `uid`.
- **Local mode** (no Firebase settings in `.env`) does the same face matching, and the browser keeps `{uid, name}` in localStorage. Use it for offline demos. It is not secure, because anyone can edit localStorage.

## Setup

1. Run `node server.js` (Node 18+) and open `http://localhost:8000/login.html`. Without Firebase settings this runs in **local mode**, which needs no setup.
2. For **Firebase mode**, in the [Firebase console](https://console.firebase.google.com):
   1. Create a project, then add a **Web app**. Copy `apiKey`, `projectId`, and `appId` into `.env` as `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, and `FIREBASE_APP_ID`.
   2. Go to **Project settings → Service accounts → Generate new private key**. Save the JSON in the repo root under its default name (`*-firebase-adminsdk-*.json` is gitignored), and set `FIREBASE_SERVICE_ACCOUNT=./that-file.json`. **Never commit this file.** If it leaks, delete the key in the console.
   3. Go to **Firestore Database → Create database**, then paste `firestore.rules` into the **Rules** tab.
   4. Go to **Build → Authentication → Get started**. Without this step, sign-in fails with `CONFIGURATION_NOT_FOUND`. Face scan needs no provider (custom tokens always work). For password sign-in, go to **Sign-in method → Email/Password → Enable** (leave "Email link" off).
3. Restart the server. It prints `Face sign-in: Firebase project <id>, N crew enrolled`.

Each machine has its own `server/data/faces.json`, so enroll on the laptop you'll demo from. Manage it with:

```sh
node server/auth.js list
node server/auth.js remove <uid|name>
node server/auth.js reset
```

The running server picks up changes to the file automatically.

## For other features: `window.AstraAuth`

Load `js/auth.js` after `common.js` (all pages already do). It adds a name chip and a **Sign out** link to the nav, and fills any `[data-auth-name]` element with the crew member's name (the HUD's `CREW` corner uses this).

```js
const user = await AstraAuth.ready;          // { uid, name, mode } or null
AstraAuth.requireAuth();                      // send signed-out users to login.html?next=<this page>
AstraAuth.onChange((u) => …);                 // sign-in / sign-out; also a "astra:auth" DOM event

// Profile doc: Firestore users/{uid} in Firebase mode, localStorage otherwise (and as an offline copy)
const p = await AstraAuth.getProfile();      // { name, createdAt, lastLoginAt, onboarded, …whatever you saved }
await AstraAuth.saveProfile({ profile: tailoredProfile, onboarded: true });   // shallow merge
if (await AstraAuth.needsOnboarding()) { /* show the tutorial + questionnaire */ }

const idToken = await AstraAuth.getIdToken(); // null in local mode
```

**Onboarding hand-off:** after enrolling, `login.html` sends new crew to `interface.html?welcome=1`, and their profile has `onboarded: false`. The tutorial and questionnaire (see `docs/AI-BACKEND.md`) should check `AstraAuth.needsOnboarding()`, store the tailored profile with `saveProfile({ profile, onboarded: true })`, and pass `(await AstraAuth.getProfile()).profile` to `/api/ai/*`. Returning crew go to `interface.html`, or to `?next=` if the login link set one.

**Protecting server routes:** `server/auth.js` exports `userFromRequest(req)`. In Firebase mode it verifies `Authorization: Bearer <idToken>` against Google's public certificates and returns `{ uid, name }` or `null`. In local mode it always returns `null`, so don't hard-require it there.

## HTTP API

| Route | Body | Returns |
|-------|------|---------|
| `GET /api/auth/config` | none | `{ mode: "firebase"\|"local", firebase: webConfig\|null, faceModels, threshold, enrolled }` |
| `POST /api/auth/face/verify` | `{ descriptors: number[128][] }` (1–10) | `200 session`, or `401 { error: "no_match" }` (the server console logs the closest distance, for tuning) |
| `POST /api/auth/face/enroll` | `{ name, descriptors: number[128][] }` (3–12) | `200 session`, or `409 { error: "already_enrolled", name }` |

`session = { uid, name, isNew, mode, token, distance }`. In local mode `token` is null. Both POST routes allow 30 requests per minute per IP.

## Limits (say these out loud if a judge asks)

- This is demo-grade biometrics. Descriptors sent from the browser could be replayed by someone who captured them, and the liveness check is a head turn.
- Real deployment would run matching on the glasses, with IR liveness and templates encrypted at rest.
- The matching threshold was chosen by hand, not tuned on a dataset. Expect occasional misses in poor light; the page tells the user to face a light source and try again.
