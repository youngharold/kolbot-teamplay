/**
 *  @filename    TeamLeader.js
 *  @desc        In-game leader role behavior for TeamPlay.
 *
 *               The LEADER is the profile whose name equals TeamState.leaderProfile
 *               (configured in TeamDefaults.js). Current leader responsibilities:
 *
 *                 - Render a team-wide status overview to the D2Bot# console on
 *                   a cadence so the user sees every char's current activity
 *                   at a glance.
 *                 - Broadcast target changes via TeamIPC so followers know what
 *                   the team is doing (MVP future: quest progression driver).
 *                 - Maintain authoritative team.json (already handled by TeamState
 *                   — setTarget / markQuest / nextGame persist + broadcast).
 *
 *               NOT the leader's job in the current architecture:
 *                 - Login / char creation (SoloPlay does it)
 *                 - Game creation game-name generation (SoloPlay; team-wide naming
 *                   lands in a later PR)
 *                 - Fighting monsters (SoloPlay runs the leader's build as usual)
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function (module) {
	const TeamLogger = require("../Core/TeamLogger");
	const TeamState = require("../Core/TeamState");
	const TeamStatus = require("../Core/TeamStatus");

	// Render the team overview at most once per OVERVIEW_INTERVAL_MS. The tick
	// worker calls render() on every beat; this gate keeps D2Bot# console from
	// scrolling the overview faster than humans can read.
	const OVERVIEW_INTERVAL_MS = 60 * 1000;
	let lastRender = 0;

	/**
	 * One "tick" of leader behavior. Called by the teamPlayTick Worker — must
	 * be cheap and return quickly. Errors are caught by the caller.
	 */
	function tick () {
		const now = getTickCount();
		if (now - lastRender < OVERVIEW_INTERVAL_MS) return;
		lastRender = now;

		// Read every team member's status file + print a compact overview.
		const snapshots = TeamStatus.readAll();
		TeamStatus.renderOverview(snapshots);

		// Also log the state snapshot for post-hoc review.
		const state = TeamState.get();
		TeamLogger.info("leader", "team overview rendered", {
			gameCount: state.gameCount,
			gameName: state.gameName,
			target: state.target,
			liveProfiles: Object.keys(state.heartbeats || {})
		});
	}

	module.exports = {
		tick: tick
	};
})(module);
