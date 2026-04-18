/**
*  @filename    TeamIPC.js
*  @desc        Structured message wrapper over libs/modules/Team.js copydata.
*               PR-1: stub. Implementation lands in PR-2.
*/

(function (module) {
	module.exports = {
		// TODO(PR-2): send/broadcast/listen over copydata with structured message types
		send: function (_toProfile, _type, _payload) {},
		broadcast: function (_type, _payload) {},
		listen: function (_handler) {}
	};
})(module);
