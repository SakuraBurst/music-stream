---
name: iOS project setup and tooling
description: iOS app uses XcodeGen (project.yml), cannot build/verify on Linux, structure under ios/Sonus/
type: project
---

iOS project lives at `ios/Sonus/` with XcodeGen spec at `ios/project.yml`. To generate the .xcodeproj: `cd ios && xcodegen generate`.

**Why:** No .xcodeproj is committed to git. XcodeGen generates it from project.yml. This avoids merge conflicts in pbxproj files.

**How to apply:** When adding new Swift files to the iOS project, just create them in the right directory — XcodeGen auto-discovers sources. No need to update a pbxproj. Cannot verify Xcode builds on this Linux machine; always note that macOS verification is needed in handoff notes. iOS 17+ deployment target, Swift 5.9.

Key architecture: AppState (@Observable) at top, APIClient (URLSession + async/await) with TokenRefreshing protocol to break circular dep with AuthService. Tokens in Keychain, server URL in UserDefaults.
