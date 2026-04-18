/**
 *  @filename    TeamEntry.js
 *  @desc        Out-of-game entry dispatcher for TeamPlay.
 *
 *               Each bot's D2Bot# entry script (`D2BotTeamLead.dbj` or
 *               `D2BotTeamFollow.dbj`) includes this file and then calls
 *               `TeamEntry.run("lead" | "follow")`. That call never returns — this
 *               module owns the bot's OOG (lobby) lifetime.
 *
 *               Responsibilities in this PR (PR-2):
 *                 1. Stash the role globally so logger/status can tag output.
 *                 2. Eager-load TeamLogger, TeamStatus, TeamState, TeamIPC.
 *                 3. Run a heartbeat loop that:
 *                      - publishes this bot's per-char status to disk every tick
 *                      - broadcasts heartbeat + updates team.json (leader) / cache (follower)
 *                      - on the leader, periodically renders a team-wide status overview
 *                        to the D2Bot# console so the user sees everyone at a glance
 *                      - logs a liveness line so grep-able evidence exists in team.log
 *
 *               Responsibilities deferred to later PRs:
 *                 - D2Bot.init / D2Bot.start / login drive loop        → PR-3 (GameCoordinator)
 *                 - Game creation (leader) / join (follower)           → PR-3
 *                 - In-game dispatch to TeamLeader / TeamFollower      → PR-5 / PR-6
 *                 - SoloPlay OOG-check integration (AutoMule, torch)   → MVP-4
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function () {
	// How long to sleep between loop iterations. 5s is frequent enough that the
	// on-screen team overview feels live but infrequent enough to avoid log spam.
	const TICK_MS = 5000;

	// Every N ticks, emit a verbose log line + (leader only) render team overview.
	// At TICK_MS=5000, PERIODIC_TICKS=12 means every ~60 seconds.
	const PERIODIC_TICKS = 12;

	/**
	 * Main OOG loop. Called once from the .dbj entry point; runs until the profile
	 * is stopped.
	 *
	 * @param {"lead" | "follow"} role
	 */
	function run (role) {
		// Expose role as a global so cross-module code (logger, status) can tag
		// output without needing the role plumbed through every call site.
		TeamRole = role;

		// Lazy-requires so a missing dependency surfaces as a clean error instead
		// of breaking the .dbj parse.
		const TeamLogger = require("../Core/TeamLogger");
		const TeamStatus = require("../Core/TeamStatus");
		const TeamState = require("../Core/TeamState");
		const TeamIPC = require("../Core/TeamIPC");
		const TeamProfile = require("../Core/TeamProfile");

		TeamLogger.info("entry", "TeamPlay OOG start", {
			role: role,
			profile: TeamProfile.name()
		});

		// Initialize TeamState (loads team.json or writes defaults) and wire the IPC
		// listener up-front so we don't miss messages during the first loop iteration.
		const bootState = TeamState.get();
		TeamIPC.init();

		TeamLogger.info("entry", "TeamState loaded", {
			leader: bootState.leaderProfile,
			followers: bootState.followers,
			difficulty: bootState.difficulty,
			gameCount: bootState.gameCount,
			amILeader: TeamState.isLeader()
		});

		let tick = 0;
		while (true) {
			tick += 1;
			try {
				// --- Every tick --------------------------------------------------

				// Write this bot's status snapshot to data/TeamPlay/status/<profile>.json
				// so the leader (and any external tooling) can assemble a team-wide view.
				TeamStatus.publish();

				// Record that we're alive (updates team.json on leader, cache on follower)
				// and broadcast the heartbeat over IPC. This is how we detect crashed /
				// disconnected team members in later PRs.
				TeamState.broadcastHeartbeat();

				// --- Every PERIODIC_TICKS ticks ---------------------------------

				if (tick % PERIODIC_TICKS === 0) {
					if (role === "lead") {
						// Leader: show everyone at a glance in the D2Bot# console + log
						// a richer team-state snapshot for post-hoc debugging.
						TeamStatus.renderOverview(TeamStatus.readAll());

						const fresh = TeamState.get();
						TeamLogger.info("entry", "leader tick " + tick + " — team state", {
							gameCount: fresh.gameCount,
							gameName: fresh.gameName,
							target: fresh.target,
							liveProfiles: Object.keys(fresh.heartbeats || {})
						});
					} else {
						// Follower: light-touch log so team.log shows we're alive.
						TeamLogger.debug("entry", "follower tick " + tick, {
							target: TeamState.get().target
						});
					}
				}
			} catch (e) {
				// Never let an exception in the loop body kill the bot — log it and
				// keep looping so the next tick has a chance to recover.
				TeamLogger.error("entry", "heartbeat loop exception: " + e.message, {
					stack: String(e)
				});
			}

			delay(TICK_MS);
		}
	}

	// Expose to the .dbj entry scripts via the global name. No `module.exports`
	// because this file is `include()`'d, not `require()`'d.
	TeamEntry = { run: run };
})();
