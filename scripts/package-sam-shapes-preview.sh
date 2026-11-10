#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")/.."
SAM_PACKAGE="$PWD/.build/sam-shape-expansion"
SAM_DIST="$PWD/dist/sam-shapes-preview"
SAM_APP="$SAM_DIST/PosterLab SAM Shapes.app"
mkdir -p "$SAM_DIST"
if [[ ! -d "$SAM_APP" ]]; then
    cp -cR "$PWD/dist/PosterLab.app" "$SAM_APP"
fi
cp "$SAM_PACKAGE/.build/release/PosterStudio" "$SAM_APP/Contents/MacOS/.PosterStudio.next"
mv -f "$SAM_APP/Contents/MacOS/.PosterStudio.next" "$SAM_APP/Contents/MacOS/PosterStudio"
rsync -a --delete "$SAM_PACKAGE/.build/release/PosterLab_PosterCore.bundle/" "$SAM_APP/Contents/Resources/PosterLab_PosterCore.bundle/"
cp "$SAM_PACKAGE/.build/release/poster" "$SAM_DIST/poster"
rsync -a --delete "$SAM_PACKAGE/.build/release/PosterLab_PosterCore.bundle/" "$SAM_DIST/PosterLab_PosterCore.bundle/"
for model in SAM2 SigLIP; do
    if [[ ! -d "$SAM_DIST/$model" ]]; then
        cp -cR "$SAM_APP/Contents/Resources/$model" "$SAM_DIST/$model"
    fi
done
/usr/bin/python3 - "$SAM_APP/Contents/Info.plist" "$PWD" <<'PY'
import plistlib,sys
path=sys.argv[1]
with open(path,'rb') as f:info=plistlib.load(f)
info.update(CFBundleName='PosterLab SAM Shapes',CFBundleDisplayName='PosterLab SAM Shapes',
            CFBundleIdentifier='studio.posterlab.sam-shapes-preview',PosterLabProjectRoot=sys.argv[2])
with open(path,'wb') as f:plistlib.dump(info,f)
PY
codesign --force --deep --sign - "$SAM_APP"
codesign --verify --deep --strict "$SAM_APP"
print "Packaged $SAM_APP"
