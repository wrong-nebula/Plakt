# Your personal taste jury

Open **Taste check** in the main app header or Judging mix. **Rate for my taste…** on a source-study output opens that poster in the same interface. Vote **Yes**, **No** or **Skip for now**; keyboard shortcuts are **Y**, **N**, **Space**, with **Command-Z** to undo a vote. Text entry keeps ordinary typing separate from voting shortcuts. Expand **Review your votes** to revisit, change or clear any decision.

The default **Personal taste** profile starts with the three outputs explicitly liked in this conversation:

- `source-compositions-v13 / optical-r0-c6` — green Bodies in Motion
- `source-compositions-v13 / color-field-r2-c4` — blue/ivory Offene Formen / Zürich
- `source-compositions-v13 / guilloche-r0-c6` — lavender Zwischen / Stimmen

There are no assumed dislikes. The first indexed deck contained 536 distinct concept posters; later studies expand it automatically; exact PNG hashes merge retained elites. More generated outputs are added when opening the deck. A selected custom/older output can also be included directly. Image snapshots and their frozen native feature prints remain local in `taste/` so later output cleanup does not erase a rated example.

Create multiple profiles as separate jury members: each has its own yes/no votes, enabled state and voting weight. New profiles start unlabelled. Mix them with the existing craft/style judges, or choose **Use only my taste jury** once a member is ready. Disabling a profile or setting its weight to zero excludes it.

## Learning

A juror starts casting votes only after **at least 3 yes and 3 no labels**. Each explicit vote is saved first, then retrains that profile locally through Create ML logistic regression exported to Core ML. It uses a schema-checked 64-dimensional signed-bucket/L2 projection of frozen 768-dimensional Apple Vision revision-2 scaleFit features. Classes are balanced by repeating existing labelled rows; unseen and skipped posters never become negative examples.

For active trained jurors, the deck combines model uncertainty with visual distance from rated examples. It does not show committee rankings or predicted preference while asking for a vote. Early scores are uncalibrated preference affinity, not objective quality. Held-out agreement is reported only when enough labels and both classes exist in a deterministic split that keeps source-layout groups apart. The final model then trains on all explicit votes.

Re-rating replaces an existing label rather than adding a contradictory second example. Undo restores the prior decision. A changed label digest immediately makes an old classifier ineligible until retraining finishes. A generation/study freezes its personal jury model versions, label digests and weights; its saved ballots stay auditable.

The personal model participates in both standard evolution and source-composition studies, using the same weighted Borda mechanism as the other judges. Native preference inference runs locally with Core ML. No poster or preference data is uploaded.

## Checking the jury against your votes

`poster taste calibrate` compares stored source-study rankings with one profile's explicit votes. It finds each voted poster's `round.json`, then reports AUC for the round rankings: 0.5 is chance, 1 means every yes outranked every no. It also counts how many of your yes and no posters won their round, and gives each judge's agreement from its raw scores. Each figure carries a Hanley-McNeil standard error.

`--mix 'Judge=weight,…'` replays the stored candidates under different weights. `--tolerance` replays with a tie margin. A replay with no mix must reproduce the stored ranking; that confirms the harness. Replays re-rank existing candidates only and cannot show how later rounds would have evolved. A taste juror trained on the same votes would inflate agreement, so judge new weights on fresh votes.

The first run used the 94 votes behind `source-personal-jury-v17`, spread over 64 rounds. Stored rankings scored AUC 0.656 ± 0.066, with 6 of 26 yes posters and 3 of 68 no posters winning their round. Replaying with the stored weights changed none of the 64 winners. Two candidate fixes lowered agreement, so neither shipped. A tie margin of 0.01 dropped AUC to 0.618 and changed 22 winners: it erased the small score differences that the most agreeing designer heads rely on. Zeroing Paul Rand, Herbert Bayer and Milton Glaser, the voting heads with the lowest raw agreement, dropped AUC to 0.636. It also let 8 no posters win instead of 3. Judges that score a whole batch identically now cast no ballot. That never changes the ranking, only the consensus number and the audit.

## Local files and CLI

`taste/taste.json` holds profiles, explicit labels, undo events and the asset index. `taste/assets/` holds immutable PNG snapshots; `taste/models/<profile>/<label-digest>-<run>/` holds auditable training CSV, model and metadata versions.

```sh
./dist/poster taste index --directory taste --source output --seed-favourites
./dist/poster taste profiles --directory taste
./dist/poster taste create --directory taste --name 'Experimental print'
./dist/poster taste vote --directory taste --profile personal --asset IMAGE-SHA --yes
./dist/poster taste vote --directory taste --profile personal --asset IMAGE-SHA --no
./dist/poster taste train --directory taste --profile personal
./dist/poster taste rank --directory taste --profile personal --out output/personal-ranking.json
./dist/poster taste calibrate --directory taste --profile personal --out output/jury-calibration.json
./dist/poster taste calibrate --directory taste --mix 'Diversity=0' --tolerance 0
./dist/poster library breed --library library --taste taste --out output/personal-study --brief mixed --rounds 5
./dist/poster generate --taste taste --out output/personal-evolution
```

Functional verification uses a separate temporary fixture with synthetic class labels. It never adds test dislikes to the actual Personal taste profile.

Models are immutable, checksum-bound versions. Studies record their jury model files, label digests and weights. A user-trained snapshot with 26 yes / 68 no votes was frozen for `output/source-personal-jury-v17`; further votes remain independent of that comparison.
