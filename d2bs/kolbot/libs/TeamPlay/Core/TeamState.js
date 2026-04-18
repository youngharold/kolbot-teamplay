/**
 *  @filename    TeamState.js
 *  @desc        Shared team truth for TeamPlay.
 *
 *               Every bot in the team reads team state from ONE place so decisions
 *               (current quest target, difficulty, next game name, quest completion
 *               flags, who's online) stay consistent across profiles.
 *
 *               Authority model:
 *                 - LEADER is authoritative. Only the leader writes team.json to disk
 *                   and broadcasts IPC updates.
 *                 - FOLLOWERS cache an in-memory copy that's kept fresh by (a) IPC
 *                   messages from the leader and (b) periodic disk polling via
 *                   Team.js's built-in 3.5s data/*.json scan.
 *
 *               Persistence:
 *                 data/TeamPlay/team.json — authoritative on-disk state.
 *
 *               Schema (version 1):
 *                 {
 *                   leaderProfile: string,          // D2Bot# profile name of the leader
 *                   followers:     string[],        // D2Bot# profile names of followers
 *                   difficulty:    0 | 1 | 2,       // 0=Normal, 1=Nightmare, 2=Hell
 *                   gameCount:     number,          // monotonic counter (leader increments per game)
 *                   gameName:      string | null,   // current game name (prefix + gameCount)
 *                   gamePass:      string,          // game password (constant per team)
 *                   target: {                       // what the team is doing right now
 *                     act:   1..5,
 *                     quest: string,                // symbolic quest/area id (e.g. "tristram")
 *                     phase: string                 // leader-defined phase string (e.g. "moving", "combat")
 *                   },
 *                   quests: {                       // completion flags per difficulty
 *                     0: { <questName>: boolean },
 *                     1: { <questName>: boolean },
 *                     2: { <questName>: boolean }
 *                   },
 *                   heartbeats: { <profile>: tick }, // most-recent alive-ping from each profile
 *                   version: 1
 *                 }
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function (module) {
	// --- dependencies -----------------------------------------------------
	const TeamDefaults = require("../Config/TeamDefaults");
	const TeamLogger = require("./TeamLogger");
	const TeamIPC = require("./TeamIPC");
	const TeamProfile = require("./TeamProfile");

	// Path to the team.json file. Constant; leader writes, followers read.
	const FILE = TeamDefaults.stateFile;

	// In-memory cached copy of the on-disk state. Lazy-loaded by `get()`.
	// Followers keep this in-sync via IPC listeners; leader keeps it in-sync
	// by writing through `persist()` on every mutating op.
	let cache = null;

	/**
	 * @returns {number} current tick timestamp (ms since D2Bot# start).
	 */
	function now () {
		return getTickCount();
	}

	/**
	 * Factory for a fresh team.json when none exists yet. Pulls initial values
	 * from TeamDefaults so the user only has to edit one config file.
	 *
	 * @returns {object}
	 */
	function defaultState () {
		return {
			leaderProfile: TeamDefaults.leaderProfile,
			followers: TeamDefaults.followerProfiles.slice(),
			difficulty: TeamDefaults.difficulty,
			gameCount: 0,
			gameName: null,
			gamePass: TeamDefaults.gamePass,
			target: { act: 1, quest: "boot", phase: "idle" },
			quests: { 0: {}, 1: {}, 2: {} },
			heartbeats: {},
			version: TeamDefaults.version
		};
	}

	/**
	 * Read team.json from disk into the cache. On a fresh install or after a corrupt
	 * file, writes a default state and returns that.
	 *
	 * @returns {object} the loaded state
	 */
	function load () {
		try {
			if (!FileTools.exists(FILE)) {
				cache = defaultState();
				persist();
				TeamLogger.info("state", "created fresh team.json from defaults");
				return cache;
			}
			const content = FileAction.read(FILE);
			cache = JSON.parse(content);
			return cache;
		} catch (e) {
			// Corrupt file or read error — blow it away and start clean. We'd rather
			// lose a few game-count increments than wedge the team.
			TeamLogger.error("state", "load error, resetting to defaults: " + e.message);
			cache = defaultState();
			persist();
			return cache;
		}
	}

	/**
	 * Write the current cache to team.json. Called only on the leader (followers
	 * observe authoritative state via IPC and don't clobber the file).
	 *
	 * @returns {boolean} true on success
	 */
	function persist () {
		try {
			FileAction.write(FILE, JSON.stringify(cache, null, 2));
			return true;
		} catch (e) {
			TeamLogger.error("state", "persist error: " + e.message);
			return false;
		}
	}

	/**
	 * Accessor for the current state. Lazy-loads on first call.
	 *
	 * @returns {object}
	 */
	function get () {
		if (!cache) load();
		return cache;
	}

	/**
	 * @returns {boolean} true iff this bot is the configured leader.
	 */
	function isLeader () {
		const s = get();
		return s && TeamProfile.name() === s.leaderProfile;
	}

	/**
	 * Leader-only: change the current target (what the team is doing) and broadcast
	 * to followers. Non-leaders calling this are ignored with a warning.
	 *
	 * @param {{act: number, quest: string, phase: string}} obj
	 * @returns {boolean} true if the change was applied
	 */
	function setTarget (obj) {
		if (!isLeader()) {
			TeamLogger.warn("state", "non-leader tried setTarget (ignored)", { obj: obj });
			return false;
		}
		const s = get();
		s.target = obj;
		persist();
		TeamIPC.broadcast("target-change", obj);
		TeamLogger.info("state", "target changed", obj);
		return true;
	}

	/**
	 * Mark a quest complete for a given difficulty. On the leader this persists to
	 * disk and broadcasts; on a follower it only updates the in-memory cache (the
	 * leader's IPC broadcast will eventually be the authoritative record).
	 *
	 * Idempotent: repeat calls with the same (diff, name) are no-ops.
	 *
	 * @param {0|1|2} diff
	 * @param {string} name  quest/area id, matching TeamQuestTracker.QUESTS
	 * @returns {boolean} true if this call flipped the flag
	 */
	function markQuest (diff, name) {
		const s = get();
		if (!s.quests[diff]) s.quests[diff] = {};
		if (s.quests[diff][name] === true) return false;
		s.quests[diff][name] = true;
		if (isLeader()) {
			persist();
			TeamIPC.broadcast("quest-done", { diff: diff, name: name });
		}
		TeamLogger.info("state", "quest marked done", { diff: diff, name: name, byLeader: isLeader() });
		return true;
	}

	/**
	 * Query whether a quest is complete for a given difficulty.
	 *
	 * @param {0|1|2} diff
	 * @param {string} name
	 * @returns {boolean}
	 */
	function alreadyDone (diff, name) {
		const s = get();
		return !!(s.quests[diff] && s.quests[diff][name] === true);
	}

	/**
	 * Record that this bot is alive. Updates the heartbeat map with the current tick.
	 * Leader persists immediately so followers reading the file see the update;
	 * followers only touch in-memory cache (leader's own IPC broadcasts are the
	 * authoritative record followers receive).
	 */
	function heartbeat () {
		const s = get();
		if (!s.heartbeats) s.heartbeats = {};
		s.heartbeats[TeamProfile.name()] = now();
		if (isLeader()) persist();
	}

	/**
	 * Heartbeat + IPC broadcast in one call. The usual case: every OOG loop tick.
	 */
	function broadcastHeartbeat () {
		heartbeat();
		TeamIPC.broadcast("heartbeat", { profile: TeamProfile.name(), ts: now() });
	}

	/**
	 * Leader-only: increment the game counter and broadcast the new game name / pass
	 * to followers. Followers use the broadcast to know what game to join next.
	 *
	 * @returns {object|null} the new game info, or null if non-leader called this
	 */
	function nextGame () {
		if (!isLeader()) {
			TeamLogger.warn("state", "non-leader tried nextGame (ignored)");
			return null;
		}
		const s = get();
		s.gameCount += 1;
		s.gameName = TeamDefaults.gameNamePrefix + s.gameCount;
		persist();
		const payload = {
			gameName: s.gameName,
			gamePass: s.gamePass,
			gameCount: s.gameCount,
			difficulty: s.difficulty
		};
		TeamIPC.broadcast("next-game", payload);
		TeamLogger.info("state", "next game created", payload);
		return payload;
	}

	// --- IPC listeners -----------------------------------------------------
	// Followers use these to absorb leader's authoritative state changes without
	// having to poll team.json on disk (though disk is still a durable fallback).

	TeamIPC.on("target-change", function (payload) {
		const s = get();
		s.target = payload;
		TeamLogger.debug("state", "target updated via IPC", payload);
	});

	TeamIPC.on("quest-done", function (payload) {
		const s = get();
		if (!s.quests[payload.diff]) s.quests[payload.diff] = {};
		s.quests[payload.diff][payload.name] = true;
		TeamLogger.debug("state", "quest flag updated via IPC", payload);
	});

	TeamIPC.on("next-game", function (payload) {
		const s = get();
		s.gameName = payload.gameName;
		s.gamePass = payload.gamePass;
		s.gameCount = payload.gameCount;
		if (typeof payload.difficulty === "number") s.difficulty = payload.difficulty;
		TeamLogger.debug("state", "game info updated via IPC", payload);
	});

	TeamIPC.on("heartbeat", function (payload, env) {
		const s = get();
		if (!s.heartbeats) s.heartbeats = {};
		// env.from is the wire-level sender; prefer it over payload.profile
		// since the envelope is tamper-evident.
		s.heartbeats[env.from] = env.ts;
	});

	// --- public API --------------------------------------------------------
	module.exports = {
		FILE: FILE,
		defaultState: defaultState,
		load: load,
		persist: persist,
		get: get,
		isLeader: isLeader,

		setTarget: setTarget,
		markQuest: markQuest,
		alreadyDone: alreadyDone,
		heartbeat: heartbeat,
		broadcastHeartbeat: broadcastHeartbeat,
		nextGame: nextGame
	};
})(module);
