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
		const TeamCharCreate = require("../OOG/TeamCharCreate");
		// NOTE: TeamIPC is deliberately NOT required here. TeamIPC depends on
		// libs/modules/Team.js, which is also loaded by kolbot as a background
		// thread. Requiring it at top-level of the .dbj (before main() runs)
		// races against Team.js's own thread startup and causes D2BS to silently
		// drop the script. Callers (the main OOG loop) load TeamIPC lazily via
		// require("../Core/TeamIPC") AFTER main() has fully initialized the
		// kolbot Starter infrastructure.
		const TeamIPC = null;

		// Force state load (creates team.json on first run). No IPC init yet —
		// the leader-authoritative disk file works without IPC; IPC only
		// matters for real-time follower sync, which happens in the in-game
		// loop (later PRs).
		const state = TeamState.get();

		// Install the CharSelect hook so the bot auto-creates its configured
		// char if it doesn't exist on the account yet. Must run after kolbot's
		// locationAction has registered its stock handlers (which happened at
		// .dbj top-level before main() was called).
		TeamCharCreate.setup();

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
