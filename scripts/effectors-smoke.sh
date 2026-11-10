#!/bin/zsh
# Runs the bundled effector editor in an offscreen WebKit host behind the app's own bridge (EffectorsCoordinator),
# sends it a poster PDF and checks every recipe, every combination, the group editor and the exports.
#   zsh scripts/effectors-smoke.sh [poster.pdf] [output-folder]
set -euo pipefail
root=${0:A:h:h}
pdf=${1:-$root/output/print/poster-2035.pdf}
out=${2:-$root/output/effectors-smoke}
[[ -f $pdf ]] || { print -u2 "No poster PDF at $pdf; pass one as the first argument."; exit 2 }
build=$(mktemp -d)
trap 'rm -rf $build' EXIT
# The coordinator imports PosterCore for PosterVectors; the smoke host compiles that file directly instead.
sed '/^import PosterCore$/d' $root/Sources/PosterStudio/EffectorsCoordinator.swift > $build/EffectorsCoordinator.swift
swiftc -O -parse-as-library -o $build/effectors-smoke \
  $root/scripts/EffectorsSmoke.swift $build/EffectorsCoordinator.swift $root/Sources/PosterStudio/EffectorsSelfTest.swift \
  $root/Sources/PosterCore/Effectors/PosterVectors.swift
mkdir -p $out
$build/effectors-smoke $root/Sources/PosterCore/Resources/Effectors/index.html $pdf $out
