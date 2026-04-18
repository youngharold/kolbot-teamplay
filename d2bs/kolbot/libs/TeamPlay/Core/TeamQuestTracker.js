/**
*  @filename    TeamQuestTracker.js
*  @desc        Party-auto vs personal quest logic + "already done for party" skip gates.
*               PR-1: stub. Full taxonomy + skip logic lands in PR-6/PR-7.
*/

(function (module) {
	// All Act 1-5 quests. In D2 LoD, every quest can be completed as a team — party members
	// in proximity get credit for kills, clicks, and area clears. Rush-guide pattern applies:
	// leader drives the interaction, followers are in the area/party, everyone gets flagged.
	//
	// Some quests still require per-char physical pickups (the Horadric Cube, quest rewards
	// like Imbue/Socket). The quest script handles this inline — any char who doesn't already
	// have the item walks to the drop/pickup point when it's their turn.
	const QUESTS = [
		"denofevil", "bloodraven", "cain", "tristram", "countess", "smith", "cube",
		"andariel",
		"radament", "amulet", "staff", "duriel",
		"lamesen", "khalim", "travincal", "mephisto",
		"izual", "hellforge", "diablo",
		"shenk", "anya", "ancients", "baal"
	];

	module.exports = {
		QUESTS: QUESTS,
		// TODO(PR-6): alreadyDoneForParty(diff, name), markDone(diff, name)
		alreadyDoneForParty: function (_diff, _name) { return false; }
	};
})(module);
