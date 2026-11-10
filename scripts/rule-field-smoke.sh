#!/bin/zsh
# Runs the bundled rule-field editor in an offscreen WebKit host behind the app's own bridge (RuleFieldCoordinator),
# sends it a generated poster's copy and image, and checks copy, colours, every style and every export.
#   zsh scripts/rule-field-smoke.sh [poster.png] [output-folder]
set -euo pipefail
root=${0:A:h:h}
image=${1:-$root/output/print/poster-2035.png}
out=${2:-$root/output/rule-field-smoke}
[[ -f $image ]] || { print -u2 "No poster image at $image; pass one as the first argument."; exit 2 }
build=$(mktemp -d)
trap 'rm -rf $build' EXIT
swiftc -O -parse-as-library -o $build/rule-field-smoke \
  $root/scripts/RuleFieldSmoke.swift $root/Sources/PosterStudio/RuleFieldCoordinator.swift
mkdir -p $out
$build/rule-field-smoke $root/Sources/PosterCore/Resources/RuleField/index.html $image $out
