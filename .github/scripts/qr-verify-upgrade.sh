#!/usr/bin/env bash
set -euo pipefail

curl --fail --location --retry 3 'https://github.com/felipsarroca/lector-qr-android/releases/download/test-1.0.0-rc4/app-release.apk' --output anterior.apk
curl --fail --location --retry 3 'https://github.com/felipsarroca/util-apps/releases/download/qr-apk-actual/lector-qr.apk' --output actual.apk

adb install anterior.apk
old_code=$(adb shell dumpsys package cat.felipsarroca.lectorqr | sed -n 's/.*versionCode=\([0-9]*\).*/\1/p' | head -1)
test "$old_code" -ge 1

adb install -r actual.apk
new_code=$(adb shell dumpsys package cat.felipsarroca.lectorqr | sed -n 's/.*versionCode=\([0-9]*\).*/\1/p' | head -1)
test "$new_code" -gt "$old_code"
echo "Actualització completada: versionCode $old_code -> $new_code"

adb shell am start -n cat.felipsarroca.lectorqr/.MainActivity
sleep 5
adb shell dumpsys activity activities | grep 'cat.felipsarroca.lectorqr/.MainActivity'
if adb logcat -d -s AndroidRuntime:E | grep -q 'FATAL EXCEPTION'; then exit 1; fi
