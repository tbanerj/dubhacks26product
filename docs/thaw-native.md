# Thaw on a phone

Standalone iOS and Android builds of the Thaw client. The JavaScript bundle is inside the app, so the phone does not need this Mac, Expo Go, or Metro. Photon is not part of this build.

Supabase and Gemini come from `thaw/.env`. Those `EXPO_PUBLIC_*` values are copied into the app at build time. Do not commit `.env`. Password sign-in uses the Supabase project in that file. Email confirmation and password reset open `thaw://auth/confirm` and `thaw://auth/reset`, so the Supabase redirect allow list needs `thaw://**`.

This path needs Xcode 26.4 or newer and Node 22.13 or newer. Thaw stays on Expo SDK 57.0.9.

## Generate the native projects

```sh
cd thaw
npm install
npx expo prebuild
```

`ios/` and `android/` are generated and gitignored. Prebuild deletes them first. Open `thaw/ios/Thaw.xcworkspace`, not the `.xcodeproj`.

iOS uses Apple Maps. Android uses Google Maps. Set `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` in `.env` before this command or the Android map is blank. Restrict that key to package `com.tbanerj.thaw`. iOS can be archived without it.

## iPhone (TestFlight)

A paid Apple Developer account is required.

1. Xcode → Settings → Accounts: sign in with that Apple ID.
2. Open `thaw/ios/Thaw.xcworkspace`. Target Thaw → Signing & Capabilities → Automatically manage signing → your team. Bundle id `com.tbanerj.thaw`.
3. Destination: Any iOS Device (arm64). Product → Archive.
4. Organizer → Distribute App → App Store Connect → Upload.
5. After processing, App Store Connect → Thaw → TestFlight → Internal Testing. Install Apple's TestFlight app on an iPhone running iOS 16.4 or newer.

Create the App Store Connect app once, with bundle id `com.tbanerj.thaw`, if it does not exist. `ITSAppUsesNonExemptEncryption` is already false. Bump `ios.buildNumber` in `thaw/app.json` before every later upload, then run `npx expo prebuild` again.

If the archive says `node: command not found`, add this to `thaw/ios/.xcode.env.local` and archive again:

```sh
export NODE_BINARY=$(command -v node)
```

## Android

This machine already has `thaw/thaw-upload.keystore` and `thaw/keystore.properties`. Both are gitignored. Keep them. Losing the keystore means you cannot update the install that was signed with it. The password is only in `keystore.properties`.

To create a new key instead, from `thaw/`:

```sh
keytool -genkeypair -v -storetype PKCS12 -keystore thaw-upload.keystore -alias thaw -keyalg RSA -keysize 2048 -validity 10000
```

`thaw/keystore.properties` (gitignored):

```
storePassword=THE_STORE_PASSWORD
keyPassword=THE_KEY_PASSWORD
keyAlias=thaw
storeFile=../../thaw-upload.keystore
```

`storeFile` is relative to `android/app`. Then:

```sh
cd thaw/android
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
./gradlew assembleRelease
```

The default Java on this Mac is 26. This release build used JDK 21. `android/local.properties` points Gradle at the Android SDK and is gitignored.

The APK is `thaw/android/app/build/outputs/apk/release/app-release.apk`. Copy it to the phone and install it. The phone must allow installs from that source. Play Console is not part of this build.

Bump `android.versionCode` in `thaw/app.json` before every later APK, then run `npx expo prebuild` again. The signing hook in `thaw/app.config.js` reads `keystore.properties` on each prebuild.

## After it is installed

Quit Xcode and Metro. The app should still open the map, sign in, and use the camera. The phone needs a network path to Supabase.
