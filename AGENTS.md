# Making posters with PosterLab as an agent

These rules are for agents that make or edit posters. Changing PosterLab itself (the Swift sources, scripts, checks) is ordinary development; see [README.md](README.md).

PosterLab makes print posters as editable vector scenes. Make them through its tools, not by writing scene JSON by hand.

## Connect
- MCP (preferred, you get images back): the `posterlab` server in [.mcp.json](.mcp.json), which runs `dist/poster mcp` from this folder. Started from elsewhere, set `POSTERLAB_ROOT` to this folder.
- Shell: `dist/poster tool list`, `dist/poster tool schema NAME`, `dist/poster tool call NAME '{json}'`. Results are JSON with `summary`, `data` and `images` (PNG paths — open them to look).
- `dist/poster` is built by `zsh scripts/build.sh`. The live Studio window (`open_in_studio`, `studio_state`) needs `zsh scripts/build-agent-studio.sh` as well.

## Always
1. Call `guide` first; it has the workflow, coordinates, roles and every edit operation.
2. Use real copy: a brief from `list_briefs`, or facts the user gave you. Never invent events, venues or dates.
3. Look at every preview you produce. Zoom with `view_poster` + `region` on type, edges and overlaps.
4. Choose between alternatives with `rank_posters` / `sketch_variations` (the user's own taste jury), not by your eye alone.
5. Posters are read at phone size first. Use calm print palettes (2–4 inks on paper grounds), no neon.
6. Fix everything `critique_poster` lists under preflight before `export_poster`.
7. Report the project id, revision and export paths, with one line on why.

## Don't
- Write into `library/`, `taste/` or other sessions' `output/` folders. The agent folder is `output/agent`; `export_poster` and `run_study` refuse an `out` anywhere else inside PosterLab except a new `output/<name>`.
- Overwrite exports; choose a new `out`.
