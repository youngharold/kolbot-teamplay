/**
*  @filename    TeamPlay.js
*  @desc        In-game main loop for TeamPlay mode. Dispatches to TeamLeader or TeamFollower based on role.
*               PR-1: stub. Real dispatch lands in PR-5/PR-6.
*
*  @typedef {import("../../sdk/globals")}
*/

(function () {
	TeamPlay = {
		run: function () {
			D2Bot.printToConsole("TeamPlay in-game run — profile=" + me.profile, sdk.colors.D2Bot.DarkGold);
			// Real dispatch: read TeamState, determine role, invoke TeamLeader.run() or TeamFollower.run().
			// PR-1 stub: no-op.
		}
	};
})();
