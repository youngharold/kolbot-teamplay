/**
 *  @filename    TeamFollower.js
 *  @desc        In-game follower role behavior for TeamPlay.
 *
 *               A FOLLOWER is any profile NOT equal to TeamState.leaderProfile.
 *               Current follower responsibilities:
 *
 *                 - Watch the leader's broadcast TeamState.target and log
 *                   changes so the user can see what the team is working on.
 *                 - Maintain own heartbeat (handled by teamPlayTick in
 *                   TeamEntry.bootstrap).
 *
 *               Future responsibilities (coming in later PRs):
 *                 - Join the leader's current game instead of SoloPlay's
 *                   per-char game creation.
 *                 - Stay within kill-proximity radius of the leader for
 *                   shared XP.
 *                 - Take TPs out / re-enter on leader signal.
 *
 *               Today the follower's in-game behavior is driven by SoloPlay —
 *               the same kolbot-SoloPlay leveling loop the prod chars run.
 *               TeamFollower here just adds team-aware observability on top.
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function (module) {
	const TeamLogger = require("../Core/TeamLogger");
	const TeamState = require("../Core/TeamState");

	// Remember the last target we logged so we only emit on actual changes.
	let lastTargetKey = null;

	/**
	 * Build a stable string representation of a target so we can detect changes.
	 * @param {{act:number, quest:string, phase:string}} t
	 * @returns {string}
	 */
	function targetKey (t) {
		if (!t) return "";
		return (t.act || "") + "/" + (t.quest || "") + "/" + (t.phase || "");
	}

	/**
	 * One "tick" of follower behavior. Called by the teamPlayTick Worker.
	 * Cheap + fast — only does work when the leader's target actually changes.
	 */
	function tick () {
		const state = TeamState.get();
		if (!state) return;

		const key = targetKey(state.target);
		if (key === lastTargetKey) return;
		lastTargetKey = key;

		TeamLogger.info("follower", "leader target changed", state.target);
	}

	module.exports = {
		tick: tick
	};
})(module);
