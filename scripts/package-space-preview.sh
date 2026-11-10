#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
SPACE_APP="$PWD/dist/space-preview/PosterLab Space.app"
mkdir -p "$SPACE_APP/Contents/MacOS" "$SPACE_APP/Contents/Resources"
cp .build/shape-library/release/PosterStudio "$SPACE_APP/Contents/MacOS/.PosterStudio.next"
mv -f "$SPACE_APP/Contents/MacOS/.PosterStudio.next" "$SPACE_APP/Contents/MacOS/PosterStudio"
cp -R .build/shape-library/release/PosterLab_PosterCore.bundle "$SPACE_APP/Contents/Resources/"
/usr/bin/python3 - "$SPACE_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
with open(sys.argv[1],'wb') as f:plistlib.dump(dict(CFBundleName='PosterLab Space',CFBundleDisplayName='PosterLab Space',CFBundleIdentifier='studio.posterlab.space-preview',CFBundleVersion='1',CFBundleShortVersionString='1.0',CFBundleExecutable='PosterStudio',CFBundlePackageType='APPL',LSMinimumSystemVersion='15.0',NSHighResolutionCapable=True,NSPrincipalClass='NSApplication',PosterLabProjectRoot=sys.argv[2]),f)
PY
codesign --force --deep --sign - "$SPACE_APP"
print "Packaged $SPACE_APP"
