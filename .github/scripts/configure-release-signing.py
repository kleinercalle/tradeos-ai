#!/usr/bin/env python3
"""Wire the release keystore into android/app/build.gradle after `expo prebuild`.

Expo regenerates android/ on every prebuild, so the release signing config
can't live in the template. This script (run in CI after prebuild, before
gradlew) adds a `release` signingConfig that reads credentials from
environment variables and points the release buildType at it.

Required env vars:
  ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
The keystore file itself must exist at android/app/release.keystore
(decoded in CI from the ANDROID_KEYSTORE_BASE64 secret).
"""

import os
import sys

BUILD_GRADLE = os.path.join("android", "app", "build.gradle")

RELEASE_SIGNING_BLOCK = """\
        release {
            storeFile file('release.keystore')
            storeType 'PKCS12'
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
"""


def main() -> int:
    for var in ("ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"):
        if not os.environ.get(var):
            print(f"missing env var: {var}", file=sys.stderr)
            return 1

    with open(BUILD_GRADLE, encoding="utf-8") as f:
        src = f.read()

    # 1) Add the release signingConfig next to the debug one.
    debug_block = """\
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
"""
    if "signingConfigs {\n" + debug_block not in src:
        print("debug signingConfigs block not found; template may have changed", file=sys.stderr)
        return 1
    if "storeFile file('release.keystore')" not in src:
        src = src.replace(
            "signingConfigs {\n" + debug_block,
            "signingConfigs {\n" + debug_block + RELEASE_SIGNING_BLOCK,
            1,
        )

    # 2) Point the release buildType at the release signing config.
    # The comment lines make this replacement unique (debug buildType has no comments).
    old_release_signing = """\
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug"""
    if old_release_signing not in src:
        print("release buildType signing line not found; template may have changed", file=sys.stderr)
        return 1
    src = src.replace(old_release_signing, "            signingConfig signingConfigs.release", 1)

    with open(BUILD_GRADLE, "w", encoding="utf-8") as f:
        f.write(src)

    print("release signing configured")
    return 0


if __name__ == "__main__":
    sys.exit(main())
