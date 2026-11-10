#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
IMAGE_APP="$PWD/dist/image-preview/PosterLab Images.app"
mkdir -p "$IMAGE_APP/Contents/MacOS" "$IMAGE_APP/Contents/Resources"
cp .build/image-library/release/PosterStudio "$IMAGE_APP/Contents/MacOS/.PosterStudio.next"
mv -f "$IMAGE_APP/Contents/MacOS/.PosterStudio.next" "$IMAGE_APP/Contents/MacOS/PosterStudio"
cp -R .build/image-library/release/PosterLab_PosterCore.bundle "$IMAGE_APP/Contents/Resources/"
/usr/bin/python3 - "$IMAGE_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
with open(sys.argv[1],'wb') as f:plistlib.dump(dict(CFBundleName='PosterLab Images',CFBundleDisplayName='PosterLab Images',CFBundleIdentifier='studio.posterlab.images-preview',CFBundleVersion='1',CFBundleShortVersionString='1.0',CFBundleExecutable='PosterStudio',CFBundlePackageType='APPL',LSMinimumSystemVersion='15.0',NSHighResolutionCapable=True,NSPrincipalClass='NSApplication',PosterLabProjectRoot=sys.argv[2]),f)
PY
codesign --force --deep --sign - "$IMAGE_APP"
print "Packaged $IMAGE_APP"
