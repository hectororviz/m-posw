#!/usr/bin/env bash
#
# build-apk.sh — descarga los últimos cambios del remoto y compila el APK debug.
#
# Uso:
#   ./build-apk.sh
#
# Requiere: JDK 17 y Android SDK (por defecto /usr/lib/jvm/java-17-openjdk
# y /opt/android-sdk; se pueden overridear con JAVA_HOME / ANDROID_HOME).
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$APP_DIR")"

echo "==> 1/3 Descargando cambios del remoto (git pull --ff-only)..."
git -C "$REPO_DIR" pull --ff-only

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$JAVA_HOME/bin:$PATH"

if [ ! -x "$APP_DIR/gradlew" ]; then
  echo "ERROR: no se encontró $APP_DIR/gradlew" >&2
  exit 1
fi

echo "==> 2/3 Compilando APK debug..."
echo "    Java: $(java -version 2>&1 | head -n 1)"
cd "$APP_DIR"
./gradlew :app:assembleDebug --console=plain

APK="$APP_DIR/app/build/outputs/apk/debug/app-debug.apk"
echo "==> 3/3 Listo."
ls -la "$APK"
