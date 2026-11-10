#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
EXPERIMENT_APP="$PWD/dist/image-experiments-preview/PosterLab Experiments.app"
mkdir -p "$EXPERIMENT_APP/Contents/MacOS" "$EXPERIMENT_APP/Contents/Resources"
cp .build/image-library/release/PosterStudio "$EXPERIMENT_APP/Contents/MacOS/PosterStudio"
cp -R .build/image-library/release/PosterLab_PosterCore.bundle "$EXPERIMENT_APP/Contents/Resources/"
/usr/bin/python3 - "$EXPERIMENT_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
with open(sys.argv[1],'wb') as f:plistlib.dump(dict(CFBundleName='PosterLab Experiments',CFBundleDisplayName='PosterLab Experiments',CFBundleIdentifier='studio.posterlab.image-experiments-preview',CFBundleVersion='1',CFBundleShortVersionString='1.0',CFBundleExecutable='PosterStudio',CFBundlePackageType='APPL',LSMinimumSystemVersion='15.0',NSHighResolutionCapable=True,NSPrincipalClass='NSApplication',PosterLabProjectRoot=sys.argv[2]),f)
PY
codesign --force --deep --sign - "$EXPERIMENT_APP"
print "Packaged $EXPERIMENT_APP"
