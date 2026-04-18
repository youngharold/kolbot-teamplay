/**
*  @filename    TeamEntry.js
*  @desc        Out-of-game entry dispatcher for TeamPlay. Loads TeamState + TeamIPC, runs heartbeat loop.
*               PR-2: adds real TeamState load/save + TeamIPC broadcasts. Game creation/join logic lands
*               in PR-3 (TeamGameCoordinator). In-game dispatch (TeamLeader / TeamFollower) lands in PR-5/PR-6.
*
*  @typedef {import("../../../sdk/globals")}
*/

(function () {
	/** @type {{ run: (role: "lead" | "follow") => void }} */
	TeamEntry = {
		run: function (role) {
			// Expose role globally so logger/status/state modules can tag output.
			TeamRole = role;

			const TeamLogger = require("../Core/TeamLogger");
			const TeamStatus = require("../Core/TeamStatus");
			const TeamState = require("../Core/TeamState");
			const TeamIPC = require("../Core/TeamIPC");

			TeamLogger.info("entry", "TeamPlay OOG start", { role: role, profile: me.profile || me.windowtitle });

			// Boot state + IPC (first call creates team.json if missing).
			const state = TeamState.get();
			TeamIPC.init();

			TeamLogger.info("entry", "TeamState loaded", {
				leader: state.leaderProfile,
				followers: state.followers,
				difficulty: state.difficulty,
				gameCount: state.gameCount,
				amILeader: TeamState.isLeader()
			});

			let tick = 0;
			while (true) {
				tick += 1;
				try {
					// Publish per-char status snapshot every tick (~5s).
					TeamStatus.publish();

					// Heartbeat every tick; leader persists, follower cache-only.
					TeamState.broadcastHeartbeat();

					// Leader: periodically render team overview + log its own state.
					if (role === "lead" && tick % 12 === 0) {
						TeamStatus.renderOverview(TeamStatus.readAll());
						const fresh = TeamState.get();
						TeamLogger.info("entry", "leader tick " + tick + " — team state", {
							gameCount: fresh.gameCount,
							gameName: fresh.gameName,
							target: fresh.target,
							heartbeats: Object.keys(fresh.heartbeats || {})
						});
					}

					// Follower: occasional log line to confirm we're alive.
					if (role === "follow" && tick % 12 === 0) {
						TeamLogger.debug("entry", "follower tick " + tick, { target: TeamState.get().target });
					}
				} catch (e) {
					TeamLogger.error("entry", "heartbeat loop exception: " + e.message, { stack: String(e) });
				}

				delay(5000);
			}
		}
	};
})();
