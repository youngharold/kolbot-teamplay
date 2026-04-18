/**
*  @filename    TeamStatus.js
*  @desc        Per-char status readout (level, build, current activity, hp/mana, location, errors).
*               Each char publishes its status to data/TeamPlay/status/<profile>.json on a heartbeat.
*               The leader aggregates all 4 into a team overview shown on its D2Bot# console + written to
*               logs/TeamPlay/status.log. User sees at a glance what every char is doing.
*               PR-1: skeleton. Full fields + overlay polish across PR-2..PR-9.
*
*  @typedef {import("../../../sdk/globals")}
*/

(function (module) {
	const TeamProfile = require("./TeamProfile");
	const STATUS_DIR = "data/TeamPlay/status";

	/**
	 * @typedef {Object} CharStatus
	 * @property {string} profile
	 * @property {string} role           "lead" | "follow"
	 * @property {string} charName
	 * @property {string} charClass
	 * @property {number} level
	 * @property {number} experience
	 * @property {string} build          e.g. "LightSorc-Start", "Hammerdin-Main"
	 * @property {number} difficulty     0=N 1=NM 2=H
	 * @property {string} area           current area name
	 * @property {string} activity       e.g. "Tristram run 42 — clearing", "town chores", "dead"
	 * @property {number} hpPct
	 * @property {number} mpPct
	 * @property {number} gold
	 * @property {string[]} recentErrors
	 * @property {number} heartbeat      ms since epoch
	 */

	function buildCharStatus () {
		// PR-1: return a skeleton; fields populated as modules come online.
		return {
			profile: TeamProfile.name(),
			role: TeamProfile.role(),
			charName: me.name || "?",
			charClass: ["amazon", "sorceress", "necromancer", "paladin", "barbarian", "druid", "assassin"][me.classid] || "?",
			level: me.charlvl || 0,
			experience: 0, // TODO: fill from me.getStat
			build: "stub", // TODO(PR-4): from SoloPlay build state
			difficulty: 0, // TODO: from TeamState
			area: "?", // TODO: from me.area name
			activity: "idle", // TODO: set by current script/role
			hpPct: 100,
			mpPct: 100,
			gold: 0,
			recentErrors: [],
			heartbeat: Date.now ? Date.now() : getTickCount()
		};
	}

	function publish () {
		try {
			const status = buildCharStatus();
			FileAction.write(STATUS_DIR + "/" + status.profile + ".json", JSON.stringify(status));
		} catch (e) {
			try { D2Bot.printToConsole("TeamStatus.publish error: " + e.message, 1); } catch (_) {}
		}
	}

	function readAll () {
		const out = [];
		try {
			const files = dopen(STATUS_DIR);
			if (!files) return out;
			let f = files.getNext();
			while (f) {
				if (f.indexOf(".json") > 0) {
					try {
						const content = FileAction.read(STATUS_DIR + "/" + f);
						out.push(JSON.parse(content));
					} catch (_) {}
				}
				f = files.getNext();
			}
		} catch (_) {}
		return out;
	}

	function renderOverview (statuses) {
		// Print a compact one-line-per-char overview to console.
		statuses.sort(function (a, b) { return a.role === "lead" ? -1 : (b.role === "lead" ? 1 : 0); });
		D2Bot.printToConsole("=== TeamPlay Status ===", 11);
		for (let i = 0; i < statuses.length; i += 1) {
			const s = statuses[i];
			const line = "[" + s.role.toUpperCase() + "] " + s.charName + " (" + s.charClass + " L" + s.level + ") — "
				+ s.activity + " @ " + s.area + " | HP:" + s.hpPct + "% MP:" + s.mpPct + "%";
			D2Bot.printToConsole(line, 11);
		}
	}

	module.exports = {
		STATUS_DIR: STATUS_DIR,
		buildCharStatus: buildCharStatus,
		publish: publish,
		readAll: readAll,
		renderOverview: renderOverview
	};
})(module);
