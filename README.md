# DevJob Scanner

Monitors Reddit job subreddits in the background and sends push notifications for new untouched posts. Built for Rufai Ahmed.

## Features

- Background polling every 15/30/60 minutes (works when app is closed)
- Push notifications for posts under 2 hours old with 0 comments
- Traction labels: UNTOUCHED / LOW / HOT per comment count
- Green glow on untouched post cards
- AI reply generation via Claude (`claude-sonnet-4-20250514`)
- Deep links from notification tap directly into post detail
- Settings: toggle subreddits, stack filters, interval, notifications

## Install dependencies

```bash
cd devjob-scanner
npm install
```

## Run in development

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your device, or press `a` to open on a connected Android device.

## Build APK locally (no Expo account required)

### Option A — EAS local build (recommended)

Requires Android SDK + Java 17 installed.

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Generate native Android project
npx expo prebuild --platform android --clean

# Build APK locally (no cloud, no account needed)
eas build --platform android --profile preview --local
```

The APK will appear in the project root when done. Sideload it with:

```bash
adb install devjob-scanner-*.apk
```

### Option B — Gradle directly (no EAS needed)

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

APK output: `android/app/build/outputs/apk/release/app-release.apk`

## Setup after install

1. Open the app → grant notification permission when prompted
2. Go to **Settings** tab
3. Paste your **Anthropic API key** (`sk-ant-...`) — get one at console.anthropic.com
4. Choose which subreddits to monitor and your scan interval
5. Go back to **Jobs** tab and tap **⟳ Scan** to fetch immediately

## Subreddits monitored

- r/forhire
- r/WebDevJobs
- r/Programmers_forhire

## Tech stack

Expo SDK 54 · React Native 0.81 · TypeScript · React Navigation v7  
expo-background-fetch · expo-task-manager · expo-notifications  
AsyncStorage · @anthropic-ai/sdk · SpaceMono font
