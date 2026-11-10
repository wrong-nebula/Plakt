#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
RELIEF_DIST="$PWD/dist/paper-relief-preview"
RELIEF_BUILD="${POSTER_RELIEF_BUILD:-release}"
RELIEF_APP="$RELIEF_DIST/PosterLab Paper Relief.app"
mkdir -p "$RELIEF_APP/Contents/MacOS" "$RELIEF_APP/Contents/Resources"
cp -c .build/image-library/$RELIEF_BUILD/PosterStudio "$RELIEF_APP/Contents/MacOS/.PosterStudio.next"
mv -f "$RELIEF_APP/Contents/MacOS/.PosterStudio.next" "$RELIEF_APP/Contents/MacOS/PosterStudio"
cp -c .build/image-library/$RELIEF_BUILD/poster "$RELIEF_DIST/poster"
cp -cR .build/image-library/$RELIEF_BUILD/PosterLab_PosterCore.bundle "$RELIEF_APP/Contents/Resources/"
cp -cR .build/image-library/$RELIEF_BUILD/PosterLab_PosterCore.bundle "$RELIEF_DIST/"
python3 - "$RELIEF_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
with open(sys.argv[1],'wb') as f:plistlib.dump(dict(CFBundleName='PosterLab Paper Relief',CFBundleDisplayName='PosterLab Paper Relief',CFBundleIdentifier='studio.posterlab.paper-relief-preview',CFBundleVersion='2',CFBundleShortVersionString='2.0',CFBundleExecutable='PosterStudio',CFBundlePackageType='APPL',LSMinimumSystemVersion='15.0',NSHighResolutionCapable=True,NSPrincipalClass='NSApplication',PosterLabProjectRoot=sys.argv[2]),f)
PY
codesign --force --deep --sign - "$RELIEF_APP"
print "$RELIEF_APP"
