/**
*  @filename    TeamDefaults.js
*  @desc        Shared team-wide configuration. User edits this to wire up their 4 profiles.
*/

(function (module) {
	module.exports = {
		// Game name prefix. Full game name = prefix + gameCount, e.g. "tp47".
		gameNamePrefix: "tp",

		// Team password (private games only).
		gamePass: "tpteam",

		// Static leader profile name (must match a D2Bot# profile with Entry=D2BotTeamLead.dbj).
		// MVP-1: Lightning Sorc. Swap to Hammerdin profile name once she has Enigma.
		leaderProfile: "TP_LightSorc",

		// Follower profile names (Entry=D2BotTeamFollow.dbj).
		followerProfiles: [
			"TP_BlizzSorc",
			"TP_Hammerdin",
			"TP_SingerBarb"
		],

		// Difficulty pinned for MVP-1 (Normal). Difficulty advance arrives in MVP-2+.
		difficulty: 0,

		// Team state file (shared truth, written by leader, read by followers).
		stateFile: "data/TeamPlay/team.json",

		// Heartbeat / watchdog timing (seconds).
		heartbeatInterval: 5,
		staleHeartbeatThreshold: 30,

		// MinGameTime override for team mode (default Lead/Follow is 360s; for Tristram farm cadence 120s).
		minGameTime: 120,

		// Copydata mode used for TeamPlay IPC (distinct from existing 0xC0FFFEE team broadcast).
		teamPlayCopyDataMode: 0xA11DA7A, // "AllData"

		version: 1
	};
})(module);
