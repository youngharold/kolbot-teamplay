/**
*  @filename    TeamChores.js
*  @desc        Coordinated town chores + gear-drop phase.
*               Wraps SoloPlay TownOverrides.doChores. PR-1: stub. Implementation lands across MVP-1/MVP-4.
*/

(function (module) {
	module.exports = {
		// TODO(MVP-1): isMyTurn() — gate chores by leader-signaled phase.
		isMyTurn: function () { return true; },
		// TODO(MVP-4): runGearDropPhase() — donor drops tagged items; recipients pick up.
		runGearDropPhase: function () {}
	};
})(module);
