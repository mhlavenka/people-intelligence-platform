Since the app is built with Capacitor + Angular (same web code), iOS is mostly configuration — not a rebuild. Here's the breakdown:

**Minimal effort (a few hours):**
- npx cap add ios — scaffolds the Xcode project
- Update capacitor.config.ts with iOS-specific settings if needed
- npx cap sync ios — copies web assets + plugins
- Configure app icons, splash screens, bundle ID in Xcode
- All 9 Capacitor plugins you use (haptics, push notifications, biometric, secure storage, etc.) already support iOS

**Moderate effort (1-2 days):**
- Apple Developer Account ($99/year) — required for device testing and App Store
- Signing & provisioning profiles — certificates, App ID, provisioning profiles in Xcode
- Push notifications — APNs certificate/key setup (your push service needs the iOS token path)
- Biometric login — capacitor-native-biometric supports Face ID/Touch ID but you need to add the NSFaceIDUsageDescription plist entry
- Secure storage — uses iOS Keychain automatically, should work out of the box
- Testing on a real device — some Capacitor behaviors differ slightly (keyboard handling, safe area insets, status bar)

**Potential gotchas:**
- No Windows Xcode — you need a Mac (or a cloud Mac service like MacStadium/GitHub Actions macOS runners) to build. You can't build iOS from your Windows machine
- Haptics API works but feedback patterns differ slightly from Android
- Deep links / universal links — need Apple App Site Association file on your server
- App Store review — typically 1-3 days, stricter than Google Play

The biggest blocker is needing a Mac for the build. The code itself is 95%+ ready — Capacitor abstracts the platform differences. If you have access to a Mac, you could have a
testable iOS build in an afternoon.

GITHUB WORKFLOW
---------------

**Added iOS platform:**
- Installed @capacitor/ios@8.3.1
- Scaffolded the iOS Xcode project in mobile/ios/
- All 9 plugins detected for iOS
- Added NSFaceIDUsageDescription to Info.plist for biometric auth
- Added iosScheme: 'https' to capacitor.config.ts

**GitHub Actions workflow (.github/workflows/ios-build.yml):**
- Triggers on push to master when mobile/ changes, or manually via workflow_dispatch
- Runs on macos-15 runner (free tier eligible)
- Builds Angular app → syncs Capacitor → builds Xcode
- Two modes:
    - Without signing secrets (right now): builds an unsigned simulator .app and uploads as artifact — validates the build compiles
    - With signing secrets (when you're ready): builds a signed .ipa for App Store / TestFlight

To enable signed builds later, add these GitHub repo secrets:

┌──────────────────────────────┬────────────────────────────────────────────────────┐
│            Secret            │                     What it is                     │
├──────────────────────────────┼────────────────────────────────────────────────────┤
│ IOS_BUILD_CERTIFICATE_BASE64 │ Your .p12 distribution certificate, base64-encoded │
├──────────────────────────────┼────────────────────────────────────────────────────┤
│ IOS_P12_PASSWORD             │ Password for the .p12 file                         │
├──────────────────────────────┼────────────────────────────────────────────────────┤
│ IOS_PROVISION_PROFILE_BASE64 │ Your .mobileprovision file, base64-encoded         │
├──────────────────────────────┼────────────────────────────────────────────────────┤
│ IOS_PROVISION_PROFILE_NAME   │ Name of the provisioning profile                   │
├──────────────────────────────┼────────────────────────────────────────────────────┤
│ IOS_TEAM_ID                  │ Your Apple Developer Team ID                       │
└──────────────────────────────┴────────────────────────────────────────────────────┘

You can trigger the first build now by pushing, or go to Actions → iOS Build → Run workflow.

https://github.com/mhlavenka/people-intelligence-platform/actions/workflows/ios-build.yml





IPHONE INSTALL
--------------
There are two paths depending on whether you have signing set up:

Right now (no signing secrets yet):

The workflow builds a simulator-only .app — it won't install on a physical iPhone. Simulator builds are unsigned and only run in Xcode Simulator (which requires a Mac).

To get it on your physical iPhone, you need one of these:

**Option A: Ad Hoc distribution (easiest for testing)**

1. Enroll in Apple Developer Program ($99/year) at https://developer.apple.com
2. Register your iPhone's UDID in the developer portal (Settings → General → About → tap Serial Number to copy, or plug into a Mac and use Finder)
3. Create a distribution certificate (.p12) and an Ad Hoc provisioning profile that includes your device
4. Add these GitHub secrets to your repo:
   - IOS_BUILD_CERTIFICATE_BASE64 — base64 -i certificate.p12 | pbcopy
   - IOS_P12_PASSWORD — the password you set when exporting
   - IOS_PROVISION_PROFILE_BASE64 — base64 -i profile.mobileprovision | pbcopy
   - IOS_PROVISION_PROFILE_NAME — the profile name from the portal
   - IOS_TEAM_ID — your 10-character team ID
5. Re-run the workflow → download the .ipa from the Actions artifacts
6. Install via Apple Configurator (Mac), AltStore, or drag into Finder with iPhone connected

**Option B: TestFlight (best for ongoing testing)**

Same as above, but use an App Store provisioning profile instead of Ad Hoc. Then add a step to upload to TestFlight using xcrun altool or fastlane. You'd get a link to install
via the TestFlight app — no UDID registration needed.

**Option C: Quick & dirty (no Apple Developer account)**

If you have access to any Mac (even briefly):
1. Open the Xcode project in mobile/ios/App/
2. Sign in with your personal Apple ID (free)
3. Plug in your iPhone, select it as target
4. Hit Run — Xcode installs directly (free signing lasts 7 days)

My recommendation: If you just want a quick test, Option C is fastest. For ongoing distribution to testers, set up TestFlight (Option B).