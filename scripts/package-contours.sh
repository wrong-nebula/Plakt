#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
CONTOUR_DIST="$PWD/dist/contour-preview"
CONTOUR_APP="$CONTOUR_DIST/PosterLab Contours.app"
mkdir -p "$CONTOUR_APP/Contents/MacOS" "$CONTOUR_APP/Contents/Resources"
cp .build/image-library/release/PosterStudio "$CONTOUR_APP/Contents/MacOS/.PosterStudio.next"
mv -f "$CONTOUR_APP/Contents/MacOS/.PosterStudio.next" "$CONTOUR_APP/Contents/MacOS/PosterStudio"
cp .build/image-library/release/poster "$CONTOUR_DIST/poster"
cp -R .build/image-library/release/PosterLab_PosterCore.bundle "$CONTOUR_APP/Contents/Resources/"
cp -R .build/image-library/release/PosterLab_PosterCore.bundle "$CONTOUR_DIST/"
python3 - "$CONTOUR_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
with open(sys.argv[1],'wb') as f:plistlib.dump(dict(CFBundleName='PosterLab Contours',CFBundleDisplayName='PosterLab Contours',CFBundleIdentifier='studio.posterlab.contours-preview',CFBundleVersion='2',CFBundleShortVersionString='2.0',CFBundleExecutable='PosterStudio',CFBundlePackageType='APPL',LSMinimumSystemVersion='15.0',NSHighResolutionCapable=True,NSPrincipalClass='NSApplication',PosterLabProjectRoot=sys.argv[2]),f)
PY
codesign --force --deep --sign - "$CONTOUR_APP"
print "$CONTOUR_APP"
