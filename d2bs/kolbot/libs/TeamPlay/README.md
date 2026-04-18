# TeamPlay

Kolbot mode that merges SoloPlay's self-sufficient 1-99 character progression (auto-leveling, auto-gear via dynamic tiers, build progression, quest completion) with Lead/Follow's team coordination (one shared game, 4 chars, team boss runs).

## Status

**Bootstrap — PR-1.** Directory skeleton + entry scripts only. No runtime logic yet.

## Directory layout

```
libs/TeamPlay/
  TeamPlay.js              in-game main loop (role dispatch)
  Core/
    TeamState.js              shared truth (leader, difficulty, target, quest flags)
    TeamIPC.js                wrapper over libs/modules/Team.js
    TeamQuestTracker.js       team-completable quest list
    TeamGameCoordinator.js    game name/pass/difficulty source of truth
    TeamDifficultyAdvancer.js gated nextDifficulty() [MVP-2+]
    TeamAutoEquip.js          team-aware gear-sharing (drop-and-pickup) [MVP-4]
    TeamChores.js             wraps SoloPlay TownOverrides.doChores
    TeamLoaderHook.js         wraps SoloPlay LoaderOverrides
    TeamLogger.js             structured log to logs/TeamPlay/<profile>.log + team.log
    TeamStatus.js             per-char status readout + leader-rendered team overview
  Roles/
    TeamLeader.js          quest picker + broadcaster
    TeamFollower.js        follow-and-assist state machine
  Scripts/
    TeamTristram.js        MVP-1 core script
    TeamDenOfEvil.js       MVP-1 personal quest
    TeamCainRescue.js      MVP-1 personal quest
  OOG/
    TeamEntry.js           out-of-game entry dispatcher
  Config/
    TeamDefaults.js        shared team-wide configuration
```

Entry scripts (at `d2bs/kolbot/` root):

- `D2BotTeamLead.dbj` — leader bootstrap
- `D2BotTeamFollow.dbj` — follower bootstrap

State + observability files:

- `data/TeamPlay/team.json` — shared team state (leader writes, followers poll)
- `data/TeamPlay/status/<profile>.json` — per-char status snapshot (each char publishes)
- `logs/TeamPlay/<profile>.log` — structured per-profile debug log
- `logs/TeamPlay/team.log` — aggregated team-wide log across all profiles

## MVP-1 scope

Fresh level-1 team (Lightning Sorc + Blizz/Fire Sorc + Hammerdin + Singer Barb). Complete Normal Act 1 (Den of Evil → Cain rescue → Tristram farm to lvl 18+ → Countess → Smith/Hole → Jail → Catacombs → Andariel) as a coordinated 4-char team. Whole team fights together in the kill zone for shared XP.

Detailed design + roadmap lives in the repo owner's planning notes (not committed to this repo).

## Upstream

This repo is a fork of [blizzhackers/kolbot](https://github.com/blizzhackers/kolbot). Upstream is pulled in quarterly; TeamPlay additions live alongside SoloPlay without editing SoloPlay files (wrapper pattern).
