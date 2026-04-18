/**
*  @filename    TeamDifficultyAdvancer.js
*  @desc        Gated Check.nextDifficulty() — only advances when ALL team members meet thresholds.
*               Wraps SoloPlay's LoaderOverrides. PR-1: stub. Implementation lands in MVP-2.
*/

(function (module) {
	module.exports = {
		// TODO(MVP-2): canAdvance() returns true only if every party member meets SoloPlay's level + gear threshold.
		canAdvance: function () { return false; }
	};
})(module);
