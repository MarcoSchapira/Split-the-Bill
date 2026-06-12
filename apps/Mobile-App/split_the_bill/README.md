# EquiSplit Mobile App

Flutter iOS/Android client for the Split-the-Bill API.

## Setup

```bash
flutter pub get
```

## Run against local API

**iOS simulator** (API on localhost:3000):

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

**Android emulator** (use host loopback alias):

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Ensure the API server is running with mobile auth support (`X-EquiSplit-Client: mobile` header is sent automatically).

## Features

- Register (email verification) and login with secure token storage
- Dashboard balances, friends, groups, invitations, activity feed
- Create/edit/delete bills with equal, custom amount, or percent splits
- Add friends and create groups from the app menu

## Tests

```bash
flutter test
flutter analyze
```
