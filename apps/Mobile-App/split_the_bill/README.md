# EquiShare Mobile App

Flutter iOS/Android client for the Split-the-Bill API.

## Setup

```bash
flutter pub get
cd ios && pod install && cd ..
```

## API configuration

The app reads `API_BASE_URL` at compile time via `--dart-define` or `--dart-define-from-file`.

Config files in `dart_defines/`:

| File | Use case |
|------|----------|
| `local.json` | iOS simulator → `http://localhost:3000` |
| `local_android.json` | Android emulator → `http://10.0.2.2:3000` |
| `production.json` | Cloud Run API (HTTPS) |

Pre-flight check before a production build:

```bash
curl https://split-the-bill-api-1099488675893.northamerica-northeast2.run.app/health
# expect: {"ok":true,...}
```

## Run against local API

Ensure the API server is running on port 3000 (`services/api`).

**iOS simulator:**

```bash
flutter run --dart-define-from-file=dart_defines/local.json
```

**Android emulator:**

```bash
flutter run --dart-define-from-file=dart_defines/local_android.json
```

The app sends `X-EquiSplit-Client: mobile` automatically so the API returns Bearer tokens in auth responses.

## Run against production (Cloud Run)

**iOS simulator or connected iPhone:**

```bash
flutter run --dart-define-from-file=dart_defines/production.json
```

**Release APK (Android):**

```bash
flutter build apk --dart-define-from-file=dart_defines/production.json --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

**Release iOS:**

```bash
flutter build ios --dart-define-from-file=dart_defines/production.json --release
open ios/Runner.xcworkspace
```

Then in Xcode: select your iPhone → **Product → Run**.

## Install on iPhone

### Prerequisites

1. Flutter SDK and Xcode installed on your Mac
2. Accept the Xcode license: `sudo xcodebuild -license`
3. Connect iPhone via USB; unlock and tap **Trust This Computer**
4. Enable **Developer Mode** on iPhone if prompted (Settings → Privacy & Security → Developer Mode)

### Signing (one-time)

1. Open `ios/Runner.xcworkspace` in Xcode
2. Select the **Runner** target → **Signing & Capabilities**
3. Enable **Automatically manage signing** and select your Apple ID team
4. A free Apple ID works for personal device testing

### Install (development build)

```bash
flutter devices
flutter run --dart-define-from-file=dart_defines/production.json -d <your-iphone-id>
```

On first launch: Settings → General → VPN & Device Management → trust your developer certificate.

### Test the full flow

1. **Register** — verification code is emailed via Resend; check your inbox
2. **Login** — same credentials as the web app
3. **Dashboard / Friends / Groups** — verify data loads
4. **Add bill / send invitation** — verify writes succeed
5. **Kill and reopen the app** — session should restore from secure storage

## Android install (later)

```bash
flutter build apk --dart-define-from-file=dart_defines/production.json --release
```

Transfer `build/app/outputs/flutter-apk/app-release.apk` to the phone and install. HTTPS to Cloud Run works without extra network config.

## Features

- Register (email verification) and login with secure token storage
- Dashboard balances, friends, groups, invitations, activity feed
- Create/edit/delete bills with equal, custom amount, or percent splits
- Add friends and create groups from the app menu

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| "Unable to connect to the server" | Wrong `API_BASE_URL`, or API is down. Run the health check curl above. |
| Login works on web but not app | App must use `production.json`; local URL won't reach Cloud Run from a phone. |
| Registration code never arrives | Production API needs `RESEND_API_KEY` and `EMAIL_FROM` on Cloud Run. |
| App shows logged-in but actions fail | Session expired; kill and reopen, or log out and back in. |
| iOS install fails | Fix signing in Xcode, or trust the developer certificate on the device. |

## Tests

```bash
flutter test
flutter analyze
```
