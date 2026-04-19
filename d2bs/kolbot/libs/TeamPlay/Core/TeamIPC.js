/**
 *  @filename    TeamIPC.js
 *  @desc        Structured inter-profile messaging for TeamPlay.
 *
 *               TeamPlay coordinates multiple D2Bot# profiles running on the same machine.
 *               D2BS provides cross-profile messaging via `sendCopyData(...)` and a matching
 *               `copydata` event listener — kolbot's `libs/modules/Team.js` already wraps this
 *               with profile-tracking and a default broadcast channel (mode `0xC0FFFEE`).
 *
 *               We layer a thin *structured-message* protocol on top:
 *
 *                 Envelope: { type, payload, from, ts }
 *
 *               where `type` is a string like "target-change" / "quest-done" / "heartbeat",
 *               `payload` is any JSON-serializable object, `from` is the sender profile name,
 *               and `ts` is the sender's tick at send time.
 *
 *               We use a *TeamPlay-specific* copydata mode (`TeamDefaults.teamPlayCopyDataMode`,
 *               0xA11DA7A) so our envelopes don't collide with other kolbot IPC traffic.
 *
 *               Handlers are registered per message type via `TeamIPC.on(type, handler)` and
 *               dispatched by the single `dispatch(...)` function below. Handler errors are
 *               caught + logged so one broken handler can't poison the event loop.
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function (module) {
	// --- dependencies -----------------------------------------------------
	const TeamDefaults = require("../Config/TeamDefaults");
	const TeamLogger = require("./TeamLogger");
	const TeamProfile = require("./TeamProfile");

	// Copydata mode reserved for TeamPlay envelopes. Chosen to avoid collision with
	// kolbot's Team.broadcast default (0xC0FFFEE) and other known modes.
	const MODE = TeamDefaults.teamPlayCopyDataMode;

	// type -> array of handler functions. Populated by `on()`, consumed by `dispatch()`.
	const handlers = Object.create(null);

	// libs/modules/Team.js is the underlying transport. We hold a lazy-loaded reference
	// so the module can be safely required from contexts where Team.js isn't ready yet.
	let Team = null;
	let initialized = false;

	/**
	 * Try to load libs/modules/Team.js on demand. Returns the module or null if unavailable
	 * (which happens very early in OOG boot before the kolbot thread bus is up).
	 * Caches the result once loaded.
	 *
	 * @returns {object|null}
	 */
	function loadTeam () {
		if (Team) return Team;
		try {
			Team = require("../../modules/Team");
			return Team;
		} catch (e) {
			TeamLogger.warn("ipc", "Team module not yet loadable: " + e.message);
			return null;
		}
	}

	/**
	 * Install the copydata listener on the TeamPlay mode. Idempotent — safe to call
	 * repeatedly; only the first successful call actually registers the listener.
	 *
	 * Called automatically by `on()`, `send()`, `broadcast()`. Public so callers can
	 * eagerly init on OOG entry if they want.
	 */
	function init () {
		if (initialized) return true;

		const T = loadTeam();
		if (!T) {
			// Team transport isn't ready yet. `on()` can still stash handlers in the
			// `handlers` map; a subsequent call to init() once Team is up will wire them in.
			return false;
		}

		// Team.on(mode, handler) — registers an event listener for copydata at the given mode.
		// Team's thread handles deserializing the JSON payload and emitting decoded objects.
		T.on(MODE, dispatch);
		initialized = true;
		TeamLogger.info("ipc", "initialized on mode 0x" + MODE.toString(16));
		return true;
	}

	/**
	 * Build the message envelope sent over the wire. All TeamPlay messages share this shape.
	 *
	 * @param {string} type
	 * @param {*} payload
	 * @returns {{type: string, payload: *, from: string, ts: number}}
	 */
	function envelope (type, payload) {
		return {
			type: type,
			payload: payload,
			from: TeamProfile.name(),
			ts: getTickCount()
		};
	}

	/**
	 * Incoming-message handler. Invoked by Team.js for every copydata message on MODE.
	 * Looks up registered handlers for the envelope's `type` and invokes each one
	 * inside a try/catch so a broken handler can't crash the event loop.
	 *
	 * @param {object} data decoded envelope (or arbitrary object if malformed)
	 */
	function dispatch (data) {
		try {
			if (!data || typeof data !== "object" || typeof data.type !== "string") {
				// Malformed envelope — ignore silently. Either another subsystem using the
				// same mode (shouldn't happen with our private mode), or a version mismatch.
				return;
			}

			const list = handlers[data.type];
			if (!list || !list.length) return;

			for (let i = 0; i < list.length; i += 1) {
				try {
					// Handlers receive (payload, envelope) so they can inspect metadata if needed.
					list[i](data.payload, data);
				} catch (e) {
					TeamLogger.error("ipc", "handler threw for type " + data.type + ": " + e.message, {
						envelope: data,
						stack: String(e)
					});
				}
			}
		} catch (e) {
			TeamLogger.error("ipc", "dispatch outer error: " + e.message);
		}
	}

	// --- public API -------------------------------------------------------
	module.exports = {
		MODE: MODE,

		init: init,

		/**
		 * Point-to-point send to a specific profile (by D2Bot# window title / profile name).
		 * Returns false if transport isn't ready.
		 *
		 * @param {string} toProfile
		 * @param {string} type
		 * @param {*} payload
		 * @returns {boolean}
		 */
		send: function (toProfile, type, payload) {
			if (!init()) return false;
			try {
				Team.send(toProfile, envelope(type, payload), MODE);
				TeamLogger.debug("ipc", "sent " + type + " -> " + toProfile, payload);
				return true;
			} catch (e) {
				TeamLogger.error("ipc", "send failed: " + e.message, { to: toProfile, type: type });
				return false;
			}
		},

		/**
		 * Fan-out send to every tracked team profile (as discovered by Team.js's
		 * data/*.json scan). Returns false if transport isn't ready.
		 *
		 * @param {string} type
		 * @param {*} payload
		 * @returns {boolean}
		 */
		broadcast: function (type, payload) {
			if (!init()) return false;
			try {
				Team.broadcast(envelope(type, payload), MODE);
				TeamLogger.debug("ipc", "broadcast " + type, payload);
				return true;
			} catch (e) {
				TeamLogger.error("ipc", "broadcast failed: " + e.message, { type: type });
				return false;
			}
		},

		/**
		 * Register a handler for a specific message type. Multiple handlers per type
		 * are supported and invoked in registration order. Handlers are retained even
		 * if transport init is deferred — they'll fire once init succeeds.
		 *
		 * @param {string} type
		 * @param {(payload: *, envelope: object) => void} handler
		 */
		on: function (type, handler) {
			if (typeof type !== "string" || typeof handler !== "function") return;
			if (!handlers[type]) handlers[type] = [];
			handlers[type].push(handler);
			// NOTE: we deliberately do NOT call init() here. Registering a handler is a
			// pure add-to-dict operation; the subscription on libs/modules/Team.js's
			// copydata event happens when init() is explicitly called from main()
			// (after kolbot's Starter + thread bus are up). Calling init() at
			// module-load time would require Team.js, which races with kolbot's
			// Team thread startup and causes D2BS to silently drop the script.
		},

		/**
		 * Unregister a handler. Does nothing if not registered.
		 *
		 * @param {string} type
		 * @param {Function} handler
		 */
		off: function (type, handler) {
			if (!handlers[type]) return;
			handlers[type] = handlers[type].filter(function (h) { return h !== handler; });
		}
	};
})(module);
