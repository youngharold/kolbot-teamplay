/**
 *  @filename    TeamEntry.js
 *  @desc        Shared bootstrap for TeamPlay entry scripts.
 *
 *               Loaded by both `D2BotTeamLead.dbj` and `D2BotTeamFollow.dbj` via
 *               `require("./libs/TeamPlay/OOG/TeamEntry")`. Calling `bootstrap()`
 *               wires up the logger, loads/creates `data/TeamPlay/team.json`,
 *               and emits the session-start log line. The caller gets back
 *               references to the four TeamPlay core modules so it can use them
 *               directly without re-requiring.
 *
 *               Per-tick heartbeat + status publish logic lives inline in the
 *               entry `.dbj` files (interleaved with kolbot's OOG state machine),
 *               not here, because moving it to a thread would race against D2Bot#'s
 *               single-threaded event model.
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function (module) {
	/**
	 * Run the TeamPlay boot sequence. Call ONCE from the entry `.dbj`, after
	 * `include("critical.js")` + `includeSystemLibs()`, before the OOG main loop.
	 *
	 * @param {"lead" | "follow"} role
	 * @returns {{
	 *   TeamLogger: object,
	 *   TeamStatus: object,
	 *   TeamState: object,
	 *   TeamIPC: object,
	 *   TeamProfile: object
	 * }} the loaded core modules, so the caller can reuse them without re-require.
	 */
	function bootstrap (role) {
		// Load modules. Ordering matters only in that TeamProfile is set before
		// Logger/Status/State read role via TeamProfile.role(). TeamLogger depends
		// on TeamProfile (for role tag); TeamState depends on TeamIPC (for
		// broadcast) and TeamLogger (for error logging); TeamIPC depends on
		// TeamLogger.
		const TeamProfile = require("../Core/TeamProfile");
		TeamProfile.setRole(role);

		const TeamLogger = require("../Core/TeamLogger");
		const TeamStatus = require("../Core/TeamStatus");
		const TeamState = require("../Core/TeamState");
		const TeamIPC = require("../Core/TeamIPC");

		// Force state load (creates team.json on first run) and IPC listener wire-up.
		// Do this up front so the very first OOG tick already has valid state.
		const state = TeamState.get();
		TeamIPC.init();

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
			TeamIPC: TeamIPC,
			TeamProfile: TeamProfile
		};
	}

	module.exports = {
		bootstrap: bootstrap
	};
})(module);
