/**
*  @filename    TeamAutoEquip.js
*  @desc        Team-aware AutoMule filter + TeamGearBroker entry points.
*               Wraps SoloPlay AutoMuleOverrides. PR-1: stub. Drop-and-pickup hand-me-downs land in MVP-4.
*/

(function (module) {
	module.exports = {
		// TODO(MVP-4): wantedByTeammate(item) — returns true if another profile's build scores this item higher than their current equipped.
		wantedByTeammate: function (_item) { return false; },
		// TODO(MVP-4): evaluateHandMeDowns() — scan char's inventory for just-replaced items, score for team, queue drops.
		evaluateHandMeDowns: function () {}
	};
})(module);
