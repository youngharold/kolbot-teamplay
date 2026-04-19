/**
*  @filename    TeamLogger.js
*  @desc        Structured logging for TeamPlay — writes machine-parseable lines to logs/TeamPlay/<profile>.log
*               AND aggregated team-wide events to logs/TeamPlay/team.log. Also mirrors to D2Bot# console.
*               Reviewable by the developer (Claude) without user having to paste screenshots.
*
*  @typedef {import("../../../sdk/globals")}
*/

(function (module) {
	const LEVELS = {
		DEBUG: "DEBUG",
		INFO: "INFO",
		WARN: "WARN",
		ERROR: "ERROR",
		FATAL: "FATAL"
	};

	const COLORS = {
		DEBUG: 4,   // Gray
		INFO: 11,   // Gold
		WARN: 8,    // Orange
		ERROR: 1,   // Red
		FATAL: 1
	};

	const LOG_DIR = "logs/TeamPlay";
	let ready = false;

	function ensureDir () {
		if (ready) return;
		try {
			if (!FileTools.exists(LOG_DIR)) {
				// D2BS has no native mkdir; writing to a file in a missing dir creates it.
				// Fallback: try writing a sentinel file.
				FileAction.append(LOG_DIR + "/.init", "");
			}
			ready = true;
		} catch (e) {
			// Swallow — logging should never crash the bot.
			ready = true;
		}
	}

	function ts () {
		const d = new Date();
		// ISO-8601-ish, good for grep
		return d.getFullYear() + "-"
			+ String(d.getMonth() + 1).padStart(2, "0") + "-"
			+ String(d.getDate()).padStart(2, "0") + "T"
			+ String(d.getHours()).padStart(2, "0") + ":"
			+ String(d.getMinutes()).padStart(2, "0") + ":"
			+ String(d.getSeconds()).padStart(2, "0") + "."
			+ String(d.getMilliseconds()).padStart(3, "0");
	}

	function formatLine (level, profile, role, category, message, data) {
		// Machine-parseable: TIMESTAMP | LEVEL | PROFILE | ROLE | CATEGORY | MESSAGE | JSON
		const safeData = data === undefined ? "" : JSON.stringify(data);
		return ts() + " | " + level + " | " + profile + " | " + role + " | " + category + " | " + message + " | " + safeData + "\n";
	}

	function write (level, category, message, data) {
		ensureDir();
		try {
			const TeamProfile = require("./TeamProfile");
			const profile = TeamProfile.name();
			const role = TeamProfile.role();
			const line = formatLine(level, profile, role, category, message, data);

			// Per-profile log
			FileAction.append(LOG_DIR + "/" + profile + ".log", line);
			// Team-wide aggregated log
			FileAction.append(LOG_DIR + "/team.log", line);

			// Console mirror (skip DEBUG to avoid spam)
			if (level !== LEVELS.DEBUG) {
				const color = COLORS[level] || 11;
				D2Bot.printToConsole("[" + level + "][" + category + "] " + message, color);
			}
		} catch (e) {
			// Logger must never crash. Last-resort console print.
			try { D2Bot.printToConsole("TeamLogger error: " + e.message, 1); } catch (_) { /* nope */ }
		}
	}

	module.exports = {
		LEVELS: LEVELS,
		LOG_DIR: LOG_DIR,

		debug: function (category, message, data) { write(LEVELS.DEBUG, category, message, data); },
		info:  function (category, message, data) { write(LEVELS.INFO,  category, message, data); },
		warn:  function (category, message, data) { write(LEVELS.WARN,  category, message, data); },
		error: function (category, message, data) { write(LEVELS.ERROR, category, message, data); },
		fatal: function (category, message, data) { write(LEVELS.FATAL, category, message, data); }
	};
})(module);
