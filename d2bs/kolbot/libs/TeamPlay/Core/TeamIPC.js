/**
*  @filename    TeamIPC.js
*  @desc        Structured message wrapper over libs/modules/Team.js copydata.
*               Uses TeamPlay-specific copydata mode (from TeamDefaults) so team messages don't
*               collide with existing Team.js broadcast traffic (0xC0FFFEE) or other kolbot IPC.
*
*  Message envelope:
*    { type: string, payload: any, from: profile, ts: tick }
*
*  @typedef {import("../../../sdk/globals")}
*/

(function (module) {
	const TeamDefaults = require("../Config/TeamDefaults");
	const TeamLogger = require("./TeamLogger");

	const MODE = TeamDefaults.teamPlayCopyDataMode;
	const handlers = {}; // type -> array of handler functions
	let initialized = false;
	let Team = null;

	function lazyLoadTeam () {
		if (Team) return Team;
		try {
			Team = require("../../modules/Team");
			return Team;
		} catch (e) {
			TeamLogger.error("ipc", "failed to load Team module: " + e.message);
			return null;
		}
	}

	function envelope (type, payload) {
		return {
			type: type,
			payload: payload,
			from: me.profile || me.windowtitle || "?",
			ts: getTickCount()
		};
	}

	function dispatch (data) {
		try {
			if (!data || typeof data !== "object" || !data.type) return;
			const list = handlers[data.type];
			if (!list || !list.length) return;
			for (let i = 0; i < list.length; i += 1) {
				try {
					list[i](data.payload, data);
				} catch (e) {
					TeamLogger.error("ipc", "handler threw for type " + data.type + ": " + e.message, { data: data });
				}
			}
		} catch (e) {
			TeamLogger.error("ipc", "dispatch error: " + e.message);
		}
	}

	function init () {
		if (initialized) return;
		const T = lazyLoadTeam();
		if (!T) {
			TeamLogger.warn("ipc", "init deferred — Team module unavailable");
			return;
		}
		// Team.on takes (mode, handler) and invokes handler with the decoded data object.
		T.on(MODE, dispatch);
		initialized = true;
		TeamLogger.info("ipc", "initialized on mode 0x" + MODE.toString(16));
	}

	module.exports = {
		MODE: MODE,

		/** @param {Function} cb registered globally */
		init: init,

		/** Send to a specific profile (windowtitle). */
		send: function (toProfile, type, payload) {
			init();
			const T = lazyLoadTeam();
			if (!T) return false;
			try {
				T.send(toProfile, envelope(type, payload), MODE);
				TeamLogger.debug("ipc", "sent " + type + " -> " + toProfile, payload);
				return true;
			} catch (e) {
				TeamLogger.error("ipc", "send failed: " + e.message, { to: toProfile, type: type });
				return false;
			}
		},

		/** Broadcast to every tracked team profile. */
		broadcast: function (type, payload) {
			init();
			const T = lazyLoadTeam();
			if (!T) return false;
			try {
				T.broadcast(envelope(type, payload), MODE);
				TeamLogger.debug("ipc", "broadcast " + type, payload);
				return true;
			} catch (e) {
				TeamLogger.error("ipc", "broadcast failed: " + e.message, { type: type });
				return false;
			}
		},

		/** Register a handler for a specific message type. Handler receives (payload, envelope). */
		on: function (type, handler) {
			if (typeof type !== "string" || typeof handler !== "function") return;
			if (!handlers[type]) handlers[type] = [];
			handlers[type].push(handler);
			init();
		},

		/** Unregister a handler. */
		off: function (type, handler) {
			if (!handlers[type]) return;
			handlers[type] = handlers[type].filter(function (h) { return h !== handler; });
		}
	};
})(module);
