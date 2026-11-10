#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
SURVEY_DIST="$PWD/dist/shape-survey-preview"
SURVEY_APP="$SURVEY_DIST/PosterLab Shape Survey.app"
mkdir -p "$SURVEY_APP/Contents/MacOS" "$SURVEY_APP/Contents/Resources"
cp .build/image-library/release/PosterStudio "$SURVEY_APP/Contents/MacOS/PosterStudio"
cp .build/image-library/release/poster "$SURVEY_DIST/poster"
cp -R .build/image-library/release/PosterLab_PosterCore.bundle "$SURVEY_APP/Contents/Resources/"
cp -R .build/image-library/release/PosterLab_PosterCore.bundle "$SURVEY_DIST/"
python3 - "$SURVEY_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
with open(sys.argv[1],'wb') as f:plistlib.dump(dict(CFBundleName='PosterLab Shape Survey',CFBundleDisplayName='PosterLab Shape Survey',CFBundleIdentifier='studio.posterlab.shape-survey-preview',CFBundleVersion='1',CFBundleShortVersionString='1.0',CFBundleExecutable='PosterStudio',CFBundlePackageType='APPL',LSMinimumSystemVersion='15.0',NSHighResolutionCapable=True,NSPrincipalClass='NSApplication',PosterLabProjectRoot=sys.argv[2]),f)
PY
codesign --force --deep --sign - "$SURVEY_APP"
print "$SURVEY_APP"
