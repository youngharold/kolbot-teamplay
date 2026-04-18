/**
*  @filename    TeamState.js
*  @desc        Shared team truth. Persisted to data/TeamPlay/team.json.
*               Leader is authoritative: writes to disk + broadcasts via TeamIPC.
*               Followers cache a local copy, refreshed on each IPC message or disk poll.
*
*  Schema:
*    {
*      leaderProfile, followers[], difficulty, gameCount, gameName, gamePass,
*      target: { act, quest, phase },
*      quests: { 0: {...}, 1: {...}, 2: {...} },
*      heartbeats: { profile -> tick },
*      version
*    }
*
*  @typedef {import("../../../sdk/globals")}
*/

(function (module) {
	const TeamDefaults = require("../Config/TeamDefaults");
	const TeamLogger = require("./TeamLogger");
	const TeamIPC = require("./TeamIPC");

	const FILE = TeamDefaults.stateFile; // "data/TeamPlay/team.json"
	let cache = null;

	function now () {
		return getTickCount();
	}

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

	function load () {
		try {
			if (!FileTools.exists(FILE)) {
				cache = defaultState();
				persist();
				return cache;
			}
			const content = FileAction.read(FILE);
			cache = JSON.parse(content);
			return cache;
		} catch (e) {
			TeamLogger.error("state", "load error — resetting to defaults: " + e.message);
			cache = defaultState();
			persist();
			return cache;
		}
	}

	function persist () {
		try {
			FileAction.write(FILE, JSON.stringify(cache, null, 2));
			return true;
		} catch (e) {
			TeamLogger.error("state", "persist error: " + e.message);
			return false;
		}
	}

	function get () {
		if (!cache) load();
		return cache;
	}

	function profile () {
		return me.profile || me.windowtitle || "?";
	}

	function isLeader () {
		const s = get();
		return s && profile() === s.leaderProfile;
	}

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

	function markQuest (diff, name) {
		const s = get();
		if (!s.quests[diff]) s.quests[diff] = {};
		if (s.quests[diff][name] === true) return false; // no-op
		s.quests[diff][name] = true;
		if (isLeader()) {
			persist();
			TeamIPC.broadcast("quest-done", { diff: diff, name: name });
		}
		TeamLogger.info("state", "quest marked done", { diff: diff, name: name, byLeader: isLeader() });
		return true;
	}

	function alreadyDone (diff, name) {
		const s = get();
		return s.quests[diff] && s.quests[diff][name] === true;
	}

	function heartbeat () {
		const s = get();
		if (!s.heartbeats) s.heartbeats = {};
		s.heartbeats[profile()] = now();
		// Only the leader persists full state; followers only touch in-memory cache.
		if (isLeader()) persist();
	}

	function nextGame () {
		if (!isLeader()) {
			TeamLogger.warn("state", "non-leader tried nextGame (ignored)");
			return null;
		}
		const s = get();
		s.gameCount += 1;
		s.gameName = TeamDefaults.gameNamePrefix + s.gameCount;
		persist();
		const payload = { gameName: s.gameName, gamePass: s.gamePass, gameCount: s.gameCount, difficulty: s.difficulty };
		TeamIPC.broadcast("next-game", payload);
		TeamLogger.info("state", "next game created", payload);
		return payload;
	}

	// ---- IPC listeners: followers absorb leader's authoritative state ----

	TeamIPC.on("target-change", function (payload) {
		const s = get();
		s.target = payload;
		// don't persist — leader is authoritative; followers cache in-memory only
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
		s.heartbeats[env.from] = env.ts;
	});

	module.exports = {
		FILE: FILE,
		defaultState: defaultState,
		load: load,
		persist: persist,
		get: get,
		isLeader: isLeader,
		profile: profile,

		setTarget: setTarget,
		markQuest: markQuest,
		alreadyDone: alreadyDone,
		heartbeat: heartbeat,
		nextGame: nextGame,

		/** Lightweight heartbeat broadcast — followers sync their view of who's alive. */
		broadcastHeartbeat: function () {
			heartbeat();
			TeamIPC.broadcast("heartbeat", { profile: profile(), ts: now() });
		}
	};
})(module);
