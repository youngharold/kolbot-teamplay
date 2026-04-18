/**
 *  @filename    TeamEntry.js
 *  @desc        Shared bootstrap called by both `D2BotTeamLead.dbj` and
 *               `D2BotTeamFollow.dbj` immediately after kolbot system libs
 *               are available.
 *
 *               Handles:
 *                 - Tagging the global `TeamRole` so logger/status/state
 *                   modules can include role in their output.
 *                 - Eager-loading TeamLogger, TeamState, TeamIPC, TeamStatus
 *                   and forcing the first team.json load / IPC listener wire-up
 *                   so subsequent code can rely on them being ready.
 *                 - Emitting a boot line to both the D2Bot# console (so the user
 *                   sees the profile come alive) and logs/TeamPlay/*.log (so
 *                   debugging has a timestamp for session start).
 *
 *               The per-tick heartbeat + status publish loop lives inline in the
 *               entry `.dbj` files, because it's interleaved with kolbot's
 *               in-game / OOG state machine (delays + location polling) and
 *               extracting it into a thread would introduce race conditions
 *               against D2Bot#'s single-threaded event model.
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function () {
	/**
	 * Run the TeamPlay boot sequence. Call ONCE from the `.dbj` entry, after
	 * `include("critical.js")` and `includeSystemLibs()` and before entering
	 * the OOG main loop.
	 *
	 * @param {"lead" | "follow"} role
	 * @returns {{
	 *   TeamLogger: object,
	 *   TeamStatus: object,
	 *   TeamState: object,
	 *   TeamIPC: object
	 * }} the loaded modules, so the caller can reuse them without re-require
	 */
	function bootstrap (role) {
		// Global role tag — logger / status / state use this to label output.
		TeamRole = role;

		// Load the four TeamPlay modules. Order matters only so far as TeamLogger
		// must be first (the others call TeamLogger in their own init paths).
		const TeamLogger = require("../Core/TeamLogger");
		const TeamStatus = require("../Core/TeamStatus");
		const TeamState = require("../Core/TeamState");
		const TeamIPC = require("../Core/TeamIPC");
		const TeamProfile = require("../Core/TeamProfile");

		// Force state load (creates team.json on first run) and IPC listener wire-up.
		// Do this up front so the very first in-game tick has a valid state snapshot.
		const state = TeamState.get();
		TeamIPC.init();

		// Boot line — visible in D2Bot# console AND in logs/TeamPlay/<profile>.log.
		TeamLogger.info("bootstrap", "TeamPlay bootstrap complete", {
			role: role,
			profile: TeamProfile.name(),
			leader: state.leaderProfile,
			followers: state.followers,
			amILeader: TeamState.isLeader()
		});

		return {
			TeamLogger: TeamLogger,
			TeamStatus: TeamStatus,
			TeamState: TeamState,
			TeamIPC: TeamIPC
		};
	}

	// Expose to `.dbj` entries via the global name. Not `module.exports` because
	// this file is `include()`'d (not `require()`'d) at top of the entry scripts.
	TeamEntry = {
		bootstrap: bootstrap
	};
})();
