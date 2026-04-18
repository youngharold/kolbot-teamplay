/**
*  @filename    TeamLoaderHook.js
*  @desc        Wraps SoloPlay LoaderOverrides to inject team-consensus on difficulty advance.
*               PR-1: stub. Implementation lands in MVP-2.
*/

(function (module) {
	module.exports = {
		// TODO(MVP-2): patchLoader() — wrap Loader.run / Check.nextDifficulty with TeamDifficultyAdvancer gate.
		patchLoader: function () {}
	};
})(module);
