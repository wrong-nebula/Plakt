#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
export CLANG_MODULE_CACHE_PATH="$PWD/.build/shape-module-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/shape-module-cache"
if [[ "${1:-}" != "--reuse-snapshot" || ! -f .build/shape-source/Package.swift ]]; then
    mkdir -p .build/shape-source/Sources
    rsync -a Sources/ .build/shape-source/Sources/
    cp Package.swift .build/shape-source/Package.swift
fi
swift build -c release --package-path "$PWD/.build/shape-source" --scratch-path "$PWD/.build/shape-library" --disable-sandbox --jobs 2 -Xswiftc -module-cache-path -Xswiftc "$PWD/.build/shape-module-cache"
SHAPE_DIST="$PWD/dist/shape-library-preview"
SHAPE_APP="$SHAPE_DIST/PosterLab Shapes.app"
mkdir -p "$SHAPE_APP/Contents/MacOS" "$SHAPE_APP/Contents/Resources"
cp .build/shape-library/release/PosterStudio "$SHAPE_APP/Contents/MacOS/.PosterStudio.next"
mv -f "$SHAPE_APP/Contents/MacOS/.PosterStudio.next" "$SHAPE_APP/Contents/MacOS/PosterStudio"
cp .build/shape-library/release/poster "$SHAPE_DIST/.poster.next"
mv -f "$SHAPE_DIST/.poster.next" "$SHAPE_DIST/poster"
cp -R .build/shape-library/release/PosterLab_PosterCore.bundle "$SHAPE_APP/Contents/Resources/"
cp -R .build/shape-library/release/PosterLab_PosterCore.bundle "$SHAPE_DIST/"
/usr/bin/python3 - "$SHAPE_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
with open(sys.argv[1],'wb') as f:plistlib.dump(dict(CFBundleName='PosterLab Shapes',CFBundleDisplayName='PosterLab Shapes',CFBundleIdentifier='studio.posterlab.shapes-preview',CFBundleVersion='1',CFBundleShortVersionString='1.0',CFBundleExecutable='PosterStudio',CFBundlePackageType='APPL',LSMinimumSystemVersion='15.0',NSHighResolutionCapable=True,NSPrincipalClass='NSApplication',PosterLabProjectRoot=sys.argv[2]),f)
PY
codesign --force --deep --sign - "$SHAPE_APP"
print "Built $SHAPE_APP"
