#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"
export CLANG_MODULE_CACHE_PATH="$PWD/.build/module-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/module-cache"
# A stable source snapshot can be used when several local tasks share this workspace.
BUILD_PACKAGE="${POSTERLAB_BUILD_PACKAGE:-$PWD}"
swift build --package-path "$BUILD_PACKAGE" -c release --disable-sandbox --jobs 2 -Xswiftc -module-cache-path -Xswiftc "$PWD/.build/module-cache"
APP="$PWD/dist/PosterLab.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD_PACKAGE/.build/release/PosterStudio" "$APP/Contents/MacOS/.PosterStudio.next"
mv -f "$APP/Contents/MacOS/.PosterStudio.next" "$APP/Contents/MacOS/PosterStudio"
cp "$BUILD_PACKAGE/.build/release/poster" dist/.poster.next
mv -f dist/.poster.next dist/poster
# Mirror the resource bundle: a plain copy would leave resources of removed features behind.
rsync -a --delete "$BUILD_PACKAGE/.build/release/PosterLab_PosterCore.bundle/" "$APP/Contents/Resources/PosterLab_PosterCore.bundle/"
rsync -a --delete "$BUILD_PACKAGE/.build/release/PosterLab_PosterCore.bundle/" dist/PosterLab_PosterCore.bundle/
if [[ -f models/siglip/manifest.json ]]; then
    mkdir -p "$APP/Contents/Resources/SigLIP" dist/SigLIP
    rsync -a --exclude='.DS_Store' models/siglip/ "$APP/Contents/Resources/SigLIP/"
    rsync -a --exclude='.DS_Store' models/siglip/ dist/SigLIP/
fi
if [[ -f models/sam2/manifest.json ]]; then
    mkdir -p "$APP/Contents/Resources/SAM2" dist/SAM2
    rsync -a --exclude='.DS_Store' models/sam2/ "$APP/Contents/Resources/SAM2/"
    rsync -a --exclude='.DS_Store' models/sam2/ dist/SAM2/
fi
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>PosterLab</string>
<key>CFBundleDisplayName</key><string>PosterLab</string>
<key>CFBundleIdentifier</key><string>studio.posterlab.local</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleExecutable</key><string>PosterStudio</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>15.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>
PLIST
codesign --force --deep --sign - "$APP"
print "Built $APP"
