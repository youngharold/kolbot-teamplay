/**
 *  @filename    TeamProfile.js
 *  @desc        Tiny helper module for identifying the current bot's profile name consistently.
 *
 *               D2Bot# exposes the running profile name in two places:
 *                 - me.profile      — set by kolbot's own OOG bootstrap after login
 *                 - me.windowtitle  — the D2Bot# window title, always populated
 *
 *               Most of kolbot uses me.profile, but some modules (Team.js) use me.windowtitle
 *               for cross-profile matching. We always want a deterministic, non-empty string,
 *               even very early in the OOG flow before me.profile is populated. This module
 *               is the single source of truth for TeamPlay.
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function (module) {
	/**
	 * @returns {string} the current profile name, or "?" if neither is populated yet.
	 */
	function name () {
		return me.profile || me.windowtitle || "?";
	}

	module.exports = {
		name: name
	};
})(module);
