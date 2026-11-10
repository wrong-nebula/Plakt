#!/bin/zsh
# Regenerates the rule-field editor page the app bundles, from the shared engine in geometry-bench/rule-field-system.
# Needs Node and geometry-bench's packages (npm install in geometry-bench). An unchanged page keeps its timestamp.
# Run it after changing the engine, then build the app (scripts/build.sh).
set -euo pipefail
root=${0:A:h:h}
cd $root/geometry-bench
node rule-field-system/build-app.mjs $root/Sources/PosterCore/Resources/RuleField/index.html
