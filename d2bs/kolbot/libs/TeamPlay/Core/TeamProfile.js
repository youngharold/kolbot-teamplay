/**
 *  @filename    TeamProfile.js
 *  @desc        Tiny helper module for TeamPlay runtime identity.
 *
 *               Holds two pieces of state every TeamPlay module needs:
 *                 - the current bot's profile name (`me.profile` / `me.windowtitle`)
 *                 - the role this bot was launched with ("lead" | "follow")
 *
 *               Both are set by `TeamEntry.bootstrap()` at startup and read by the
 *               logger / status / state modules. Keeping them in a dedicated module
 *               avoids strict-mode "assignment to undeclared variable" warnings
 *               from bare globals and avoids the circular-require risk we'd hit if
 *               the logger depended directly on TeamEntry.
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function (module) {
	// Role is set once at bootstrap and then read everywhere. Default to "?" so
	// reads before bootstrap (shouldn't happen, but defensive) don't NPE.
	let currentRole = "?";

	/**
	 * @returns {string} the running profile name, or "?" if neither `me.profile` nor
	 *                   `me.windowtitle` is populated yet.
	 */
	function name () {
		return me.profile || me.windowtitle || "?";
	}

	/**
	 * Set the current role. Called ONCE per session from TeamEntry.bootstrap().
	 *
	 * @param {"lead" | "follow"} role
	 */
	function setRole (role) {
		currentRole = role;
	}

	/**
	 * @returns {string} the current role ("lead" / "follow" / "?").
	 */
	function role () {
		return currentRole;
	}

	module.exports = {
		name: name,
		role: role,
		setRole: setRole
	};
})(module);
