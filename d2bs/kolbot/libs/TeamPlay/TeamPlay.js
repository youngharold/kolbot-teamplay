/**
 *  @filename    TeamPlay.js
 *  @desc        In-game main loop for TeamPlay mode. Dispatches to TeamLeader or
 *               TeamFollower based on role. PR-1: stub. Real dispatch lands in
 *               PR-5 / PR-6.
 *
 *  @typedef {import("../../sdk/globals")}
 */

(function (module) {
	module.exports = {
		/**
		 * In-game entry point (invoked once the bot is inside a D2 game).
		 * PR-1: stub. Logs a boot line; real logic in later PRs.
		 */
		run: function () {
			D2Bot.printToConsole("TeamPlay in-game run — profile=" + me.profile, sdk.colors.D2Bot.DarkGold);
			// Real dispatch: read TeamState, determine role, invoke TeamLeader.run() or TeamFollower.run().
			// PR-1 stub: no-op.
		}
	};
})(module);
