#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
TYPE_APP="$PWD/dist/type-audit-preview/PosterLab Types.app"
mkdir -p "$TYPE_APP/Contents/MacOS" "$TYPE_APP/Contents/Resources"
cp .build/shape-library/release/PosterStudio "$TYPE_APP/Contents/MacOS/.PosterStudio.next"
mv -f "$TYPE_APP/Contents/MacOS/.PosterStudio.next" "$TYPE_APP/Contents/MacOS/PosterStudio"
cp -R .build/shape-library/release/PosterLab_PosterCore.bundle "$TYPE_APP/Contents/Resources/"
/usr/bin/python3 - "$TYPE_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
with open(sys.argv[1],'wb') as f:plistlib.dump(dict(CFBundleName='PosterLab Types',CFBundleDisplayName='PosterLab Types',CFBundleIdentifier='studio.posterlab.types-preview',CFBundleVersion='1',CFBundleShortVersionString='1.0',CFBundleExecutable='PosterStudio',CFBundlePackageType='APPL',LSMinimumSystemVersion='15.0',NSHighResolutionCapable=True,NSPrincipalClass='NSApplication',PosterLabProjectRoot=sys.argv[2]),f)
PY
codesign --force --deep --sign - "$TYPE_APP"
print "Packaged $TYPE_APP"
