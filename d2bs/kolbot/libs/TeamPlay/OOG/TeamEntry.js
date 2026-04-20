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

		// Char creation is inherited from SoloPlay's OOG (ControlAction.makeCharacter
		// in libs/SoloPlay/OOG/OOGOverrides.js) — we don't reimplement it.

		// --- Install team-tick Worker -------------------------------------
		// kolbot's libs/modules/Worker.js provides a cooperative-multitasking
		// runInBackground facility: registered functions are invoked on the
		// main event loop between script delays. We use it to publish this
		// bot's status snapshot + update team.json heartbeat every ~5 seconds
		// so the leader's overview + cross-profile liveness detection stay
		// fresh without spawning a separate OS thread.
		try {
			const Worker = require("../../modules/Worker");

			// Lazy-require role handlers. Both modules are safe to load at
			// bootstrap time (no Team.js dependency, no side effects).
			const TeamLeader = require("../Roles/TeamLeader");
			const TeamFollower = require("../Roles/TeamFollower");

			let lastTick = 0;
			Worker.runInBackground.teamPlayTick = function () {
				const now = getTickCount();
				if (now - lastTick < 5000) return true; // run every ~5s, keep worker alive
				lastTick = now;
				try {
					// Universal per-tick work: every bot publishes its snapshot
					// and bumps heartbeat so the leader can aggregate + crash
					// detection has fresh data.
					TeamStatus.publish();
					TeamState.heartbeat();

					// Role-specific work: leader renders team overview, follower
					// watches target changes. Each tick() is a cheap no-op if
					// there's nothing to do.
					if (TeamState.isLeader()) {
						TeamLeader.tick();
					} else {
						TeamFollower.tick();
					}
				} catch (inner) {
					// Surface via TeamLogger so we don't lose the error silently,
					// but never propagate — logging must not wedge the bot.
					try { TeamLogger.error("tick", "per-tick work failed: " + inner.message); } catch (_) {}
				}
				return true; // continue running next cycle
			};
			TeamLogger.info("bootstrap", "teamPlayTick worker installed");
		} catch (e) {
			TeamLogger.warn("bootstrap", "could not install teamPlayTick worker: " + e.message);
		}

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
