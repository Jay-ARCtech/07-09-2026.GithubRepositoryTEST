# Games in this repository

This repository holds two unrelated game projects.

## Verdigris Protocol

A cyberpunk / solarpunk roguelike RPG — permadeath, D&D-style checks,
branching hero/villain/neutral narrative, Legacy meta-progression across
runs. Lives in [`verdigris-protocol/`](verdigris-protocol/).

- [`verdigris-protocol/README.md`](verdigris-protocol/README.md) — how to run it, controls, project structure, honest scope
- [`verdigris-protocol/DESIGN.md`](verdigris-protocol/DESIGN.md) — full design document
- [`verdigris-protocol/RESEARCH.md`](verdigris-protocol/RESEARCH.md) — 60+ games across 22 genres this design is built on
- [`verdigris-protocol/SECURITY.md`](verdigris-protocol/SECURITY.md) — the adversarial security testing pass: what was tried, what broke, what got fixed

Quick start:

```bash
cd verdigris-protocol
npx http-server -p 8080 -c-1 .
# open http://localhost:8080
```

## Nova Core Protocol

A bullet-heaven arena survival roguelite, built to be packaged and shipped
on Steam. Lives in [`game/`](game/).

- [`game/README.md`](game/README.md) — how to run it, controls, project structure
- [`game/DESIGN.md`](game/DESIGN.md) — design rationale, research citations, what broke during testing
- [`game/STEAM_RELEASE_GUIDE.md`](game/STEAM_RELEASE_GUIDE.md) — what's left to actually publish it, and honest pricing guidance

Quick start:

```bash
cd game
npx http-server -p 8080 -c-1 .
# open http://localhost:8080
```
