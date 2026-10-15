# Quiet Cove

![Quiet Cove — A Quiet Bay](A%20quiet%20bay.png)

**An incremental fishing game prototype**

**Play online:** https://quiet-cove.netlify.app/  
**Design case study:** [Game Design Case Study (PDF)](docs/submission/Quiet_Cove_Game_Design_Case_Study_EN_FINAL.pdf)  
**Quest & economy:** [Quest & Economy Breakdown (XLSX)](docs/submission/Quiet_Cove_Quest_Economy_Breakdown_EN.xlsx)

## About

Quiet Cove is a browser-based incremental game inspired by the progression structure of *Life of Ants*, reimagined around fishing. Start with a single boat, collect and deliver catches, earn coins, purchase upgrades and recruit an automated fleet. Expand into dangerous waters to discover pirates, defensive boats, shipwreck salvage and metal-based infrastructure.

**Core loop:** Collect → Deliver → Earn → Upgrade → Automate.

## What's included

- **15 guided core quests** designed for approximately ten minutes of introductory progression.
- **19 additional quests** extending the world and economy beyond the core brief.
- Resource zones, cargo upgrades, worker boats and speedboat automation.
- A second territory with pirates, a defender, salvage vessels and a separate metal economy.
- Time-based construction, browser-local saves and an optional second fish port.
- A FAST balance profile for the playable prototype and a REFERENCE profile for design comparison.

The playable version uses the FAST balance profile. The REFERENCE profile is an adaptation informed by research into the original game; it is not a claim of identical game balance.

## Controls

- **WASD / arrow keys:** move the player boat.
- **Mouse / touch:** drag to steer.
- **World interaction circles:** approach to interact, contribute resources or build.
- **To Port / To Storage:** navigate toward a relevant delivery point where available.

## Technology

Phaser 3 · TypeScript · Vite

Developed with AI-assisted reference research, code implementation and automated testing through Codex. Game systems and balancing decisions were designed and evaluated through reference analysis, simulation and playtesting.

## Run locally

Requires Node.js 22 and npm.

```bash
npm ci
npm run dev
```

To create a production build:

```bash
npm run build
npm run preview
```

The production files are generated in `dist/`.

## Deploy on Netlify

Import the `quiet-cove` GitHub repository with this folder as its repository root.
Use `npm run build`, publish `dist`, and leave the base directory empty.
The settings are included in `netlify.toml`. Run `npm test` before publishing.

## Submission materials

- **Game Design Case Study:** research process, setting rationale, progression, balancing workflow and expansion concept.
- **Quest & Economy Breakdown:** quests, objective-related costs, construction timers, rewards, profile-specific resources and playtest milestones.

**Potential expansion — Automated Fishing Stations:** Salvaged metal can be used to convert early fishing grounds into passive-income stations, allowing worker boats to move on to higher-value resources. A full mobile version could support offline earnings and optional rewarded doubling.

## Notes

This is a prototype made for a game-design assignment, not a commercial release. The project contains generated and placeholder artwork/audio. Public availability of the source does not grant a separate license to reuse the art, sound or game as a whole.
