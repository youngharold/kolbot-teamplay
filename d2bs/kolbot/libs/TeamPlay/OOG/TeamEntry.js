/**
*  @filename    TeamEntry.js
*  @desc        Out-of-game entry dispatcher for TeamPlay. Delegates to role-specific loops.
*               PR-1: stub — just prints role + idles in a heartbeat loop so the bot appears alive.
*
*  @typedef {import("../../../sdk/globals")}
*/

(function () {
	/** @type {{ run: (role: "lead" | "follow") => void }} */
	TeamEntry = {
		run: function (role) {
			// Expose role globally so logger/status modules can tag output.
			TeamRole = role;

			// Load logging + status modules.
			const TeamLogger = require("../Core/TeamLogger");
			const TeamStatus = require("../Core/TeamStatus");

			TeamLogger.info("entry", "TeamPlay OOG start", { role: role, profile: me.profile });

			// PR-1 stub: heartbeat loop + publish status every ~5s so the team overview works from day 1.
			// Real OOG flow (TeamState load, game creation/join, in-game dispatch) lands in PR-2/PR-3.
			let tick = 0;
			while (true) {
				tick += 1;
				try {
					TeamStatus.publish();
					if (tick % 12 === 0) {
						// Every ~60s, log a heartbeat line so debug log shows the bot's alive.
						TeamLogger.debug("heartbeat", "tick " + tick, { role: role });
					}
					// Only the leader prints the team overview to console (followers would spam).
					if (role === "lead" && tick % 12 === 0) {
						TeamStatus.renderOverview(TeamStatus.readAll());
					}
				} catch (e) {
					TeamLogger.error("entry", "heartbeat loop exception: " + e.message, { stack: String(e) });
				}
				delay(5000);
			}
		}
	};
})();
