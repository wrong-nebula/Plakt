#!/bin/zsh
# Builds dist/PosterLab Agent.app (bundle id studio.posterlab.agent) beside dist/poster.
# It is the Studio with the live agent bridge switched on: it watches output/agent/studio-inbox, so the agent
# tools open_in_studio and studio_state can drive it. dist/PosterLab.app is not touched and keeps its own settings.
#   zsh scripts/build-agent-studio.sh                 release build
#   POSTERLAB_CONFIG=debug zsh scripts/build-agent-studio.sh
#   POSTERLAB_AGENT_HOME=/path zsh scripts/build-agent-studio.sh   bake another agent folder into the app (default output/agent)
#   POSTERLAB_BUILD_PACKAGE=/path zsh scripts/build-agent-studio.sh   build from a source snapshot, as scripts/build.sh does
set -euo pipefail
cd "${0:A:h:h}"
ROOT="$PWD"
export CLANG_MODULE_CACHE_PATH="$PWD/.build/module-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/module-cache"
CONFIG=${POSTERLAB_CONFIG:-release}
BUILD_PACKAGE="${POSTERLAB_BUILD_PACKAGE:-$PWD}"
swift build --package-path "$BUILD_PACKAGE" -c $CONFIG --disable-sandbox --jobs 2 --product PosterStudio -Xswiftc -module-cache-path -Xswiftc "$PWD/.build/module-cache"
APP="$PWD/dist/PosterLab Agent.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD_PACKAGE/.build/$CONFIG/PosterStudio" "$APP/Contents/MacOS/.PosterStudio.next"
mv -f "$APP/Contents/MacOS/.PosterStudio.next" "$APP/Contents/MacOS/PosterStudio"
rsync -a --delete "$BUILD_PACKAGE/.build/$CONFIG/PosterLab_PosterCore.bundle/" "$APP/Contents/Resources/PosterLab_PosterCore.bundle/"
/usr/bin/python3 - "$APP/Contents/Info.plist" "$ROOT" "${POSTERLAB_AGENT_HOME:-}" <<'PY'
import plistlib, sys
info = dict(CFBundleName='PosterLab Agent', CFBundleDisplayName='PosterLab Agent',
    CFBundleIdentifier='studio.posterlab.agent', CFBundleVersion='1', CFBundleShortVersionString='1.0',
    CFBundleExecutable='PosterStudio', CFBundlePackageType='APPL', LSMinimumSystemVersion='15.0',
    NSHighResolutionCapable=True, NSPrincipalClass='NSApplication', PosterLabProjectRoot=sys.argv[2])
if sys.argv[3]: info['PosterLabAgentHome'] = sys.argv[3]
with open(sys.argv[1], 'wb') as f: plistlib.dump(info, f)
PY
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
print "Built $APP — agents reach it through ${POSTERLAB_AGENT_HOME:-$ROOT/output/agent}/studio-inbox (open_in_studio, studio_state)"
