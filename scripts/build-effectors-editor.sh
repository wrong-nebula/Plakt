#!/bin/zsh
# Regenerates the effector editor page the app bundles and the headless engine its modifier pass runs,
# from the shared engine in geometry-bench/effector-system.
# Needs Node and geometry-bench's packages (npm install in geometry-bench). The same run rebuilds the study in
# output/effector-study-v1 (recipes, atlas sheets and the standalone editor); an unchanged app page keeps its timestamp.
# Run it after changing the engine, then build the app (scripts/build.sh).
set -euo pipefail
root=${0:A:h:h}
cd $root/geometry-bench
node effector-system/build.mjs
