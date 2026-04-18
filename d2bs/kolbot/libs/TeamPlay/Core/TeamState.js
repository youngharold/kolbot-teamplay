/**
*  @filename    TeamState.js
*  @desc        Shared team truth. Persisted in data/TeamPlay/team.json. Leader writes, followers poll.
*               PR-1: stub. Read/write implementation lands in PR-2.
*/

(function (module) {
	module.exports = {
		// TODO(PR-2): load/save from data/TeamPlay/team.json
		get: function () { return null; },
		setTarget: function (_obj) { /* leader-only */ },
		markQuest: function (_diff, _name) {},
		isLeader: function () { return false; },
		heartbeat: function () {}
	};
})(module);
