/**
 *  @filename    TeamCharCreate.js
 *  @desc        Auto-creates the profile's Character on the D2 char-select screen
 *               when it doesn't exist yet on the logged-in account.
 *
 *               Structurally mirrors `libs/SoloPlay/OOG/OOGOverrides.js:230`
 *               (`ControlAction.makeCharacter`) but stripped of SoloPlay-specific
 *               dependencies (CharData / Tracker / Settings / NameGen). TeamPlay
 *               wants deterministic, user-configured char names — see
 *               `libs/TeamPlay/Config/TeamDefaults.classByProfile` for the class
 *               map and `data/profile.json` Character field for the name.
 *
 *               Workflow:
 *                 1. `setup()` is called from the entry `.dbj` after kolbot's OOG
 *                    machinery is up. It patches `ControlAction.makeCharacter` and
 *                    overrides the `CharSelectNoChars` location handler.
 *                 2. At CharSelect / CharSelectNoChars, kolbot tries to find the
 *                    profile's Character. If not found, we invoke makeCharacter.
 *                 3. makeCharacter walks the D2 UI: click Create → pick class →
 *                    enter name → click OK → handle "name taken" / "rejected"
 *                    retries with a fresh name if needed.
 *                 4. On success the bot ends up in the Lobby with the new char
 *                    selected; kolbot's normal flow takes it into a game.
 *
 *  @typedef {import("../../../sdk/globals")}
 */

(function (module) {
	const TeamDefaults = require("../Config/TeamDefaults");
	const TeamLogger = require("../Core/TeamLogger");
	const TeamProfile = require("../Core/TeamProfile");

	// Pixel coordinates of the portrait for each class on the CharacterCreate screen.
	// Copied from `libs/SoloPlay/OOG/OOGOverrides.js:242`.
	const CLASS_COORDS = {
		"barbarian":   [400, 280],
		"amazon":      [100, 280],
		"necromancer": [300, 290],
		"sorceress":   [620, 270],
		"assassin":    [200, 280],
		"druid":       [700, 280],
		"paladin":     [521, 260]
	};

	// Hard safety cap. makeCharacter shouldn't ever take more than a few minutes
	// even across retries; if the D2 client is wedged, we abort rather than hang.
	const MAX_DURATION_MS = 5 * 60 * 1000;

	/**
	 * Generate a deterministic fallback char name when the configured one gets
	 * rejected by the server ("already taken" / "rejected"). Uses a random suffix
	 * so successive retries don't collide.
	 *
	 * @param {string} base  base name (from profile.json Character), max ~13 chars
	 * @returns {string} up to 15 chars, D2 char-name safe (letters + digits)
	 */
	function freshName (base) {
		const trimmed = (base || "tp").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
		const suffix = Math.floor(Math.random() * 999).toString();
		return (trimmed + suffix).slice(0, 15);
	}

	/**
	 * Resolve the class this bot should create. Priority:
	 *   1. `TeamDefaults.classByProfile[me.profile]`
	 *   2. Heuristic parse of the char name (e.g. "tpsorc1" → sorceress)
	 *   3. Fallback to paladin (safest generalist)
	 *
	 * @param {string} charName
	 * @returns {string} lowercase class key (e.g. "sorceress")
	 */
	function resolveClass (charName) {
		const byProfile = TeamDefaults.classByProfile || {};
		if (byProfile[TeamProfile.name()]) return byProfile[TeamProfile.name()].toLowerCase();

		const lower = (charName || "").toLowerCase();
		if (lower.indexOf("sorc") >= 0)  return "sorceress";
		if (lower.indexOf("hdin") >= 0 || lower.indexOf("pal") >= 0) return "paladin";
		if (lower.indexOf("barb") >= 0) return "barbarian";
		if (lower.indexOf("ama") >= 0 || lower.indexOf("zon") >= 0) return "amazon";
		if (lower.indexOf("nec") >= 0 || lower.indexOf("necro") >= 0) return "necromancer";
		if (lower.indexOf("dru") >= 0) return "druid";
		if (lower.indexOf("sin") >= 0 || lower.indexOf("assass") >= 0) return "assassin";

		TeamLogger.warn("charcreate", "could not resolve class; defaulting to paladin", { charName: charName });
		return "paladin";
	}

	/**
	 * Drive the D2 char-creation UI from the CharSelect screen through to the Lobby
	 * with the new char selected. Called ONLY when the configured Character doesn't
	 * exist on the account yet.
	 *
	 * @param {{charName?: string, charClass?: string, expansion?: boolean, ladder?: boolean, hardcore?: boolean}} info
	 *        If fields are missing, defaults are pulled from profile.json / TeamDefaults.
	 * @returns {boolean} true if the char was created and we're in the lobby
	 */
	function makeCharacter (info) {
		info = info || {};
		info.charName  = info.charName  || (Starter.profileInfo && Starter.profileInfo.charName)  || "tp" + Math.floor(Math.random() * 9999);
		info.charClass = (info.charClass || resolveClass(info.charName)).toLowerCase();
		info.expansion = info.expansion !== undefined ? info.expansion : true;  // Lord of Destruction
		info.ladder    = info.ladder    !== undefined ? info.ladder    : false; // not building for ladder
		info.hardcore  = info.hardcore  !== undefined ? info.hardcore  : false;

		TeamLogger.info("charcreate", "making character", info);
		D2Bot.updateStatus("Making Character: " + info.charName);

		me.blockMouse = true;
		const deadline = getTickCount() + MAX_DURATION_MS;

		try {
			// Cycle through the create/confirm screens until we reach the Lobby.
			while (getLocation() !== sdk.game.locations.Lobby && !me.ingame) {
				switch (getLocation()) {
				case sdk.game.locations.CharSelect:
				case sdk.game.locations.CharSelectConnecting:
				case sdk.game.locations.CharSelectNoChars: {
					const createCtrl = Controls.CharSelectCreate.control;
					// If the Create Character button is greyed (e.g. account at char cap), bail.
					if (createCtrl && createCtrl.disabled === sdk.game.controls.Disabled) {
						TeamLogger.error("charcreate", "Create Character button is disabled on this account");
						return false;
					}
					Controls.CharSelectCreate.click();
					break;
				}

				case sdk.game.locations.CharacterCreate: {
					const coords = CLASS_COORDS[info.charClass] || CLASS_COORDS["paladin"];
					// First click selects the portrait. UI then transitions to NewCharSelected.
					getControl().click(coords[0], coords[1]);
					delay(500);
					break;
				}

				case sdk.game.locations.NewCharSelected: {
					// HC warning popup can appear before the name field — dismiss it.
					if (Controls.CharCreateHCWarningOk.control) {
						Controls.CharCreateHCWarningOk.click();
						break;
					}
					Controls.CharCreateCharName.setText(info.charName);
					// Toggles default to Expansion/SC/NonLadder; invert only as needed.
					if (!info.expansion) Controls.CharCreateExpansion.click();
					if (!info.ladder)    Controls.CharCreateLadder.click();
					if (info.hardcore)   Controls.CharCreateHardcore.click();
					Controls.BottomRightOk.click();
					break;
				}

				case sdk.game.locations.LobbyPleaseWait:
				case sdk.game.locations.OkCenteredErrorPopUp: {
					const textPopup = Controls.CharCreateStatusText.control;
					if (textPopup) {
						const text = parseControlText(textPopup);
						if (text && text.indexOf("Please wait") >= 0) {
							if (!Starter.locationTimeout(Time.seconds(5), sdk.game.locations.LobbyPleaseWait)) {
								TeamLogger.warn("charcreate", "Stuck at LobbyPleaseWait");
							}
						} else if (text && text.indexOf("That character name is already taken.") >= 0) {
							const newName = freshName(info.charName);
							TeamLogger.warn("charcreate", "name taken; retrying with new name", {
								old: info.charName, new: newName
							});
							info.charName = newName;
							Starter.profileInfo && (Starter.profileInfo.charName = newName);
							ControlAction.timeoutDelay("Name-taken delay", 3000);
							Controls.OkCentered.click();
							D2Bot.updateStatus("Making Character: " + info.charName);
							Controls.OkCentered.click();
						} else if (text && text.indexOf(getLocaleString(sdk.locale.text.RejectedByServer)) >= 0) {
							const newName = freshName(info.charName);
							TeamLogger.warn("charcreate", "name rejected by server; retrying with new name", {
								old: info.charName, new: newName
							});
							info.charName = newName;
							Starter.profileInfo && (Starter.profileInfo.charName = newName);
							ControlAction.timeoutDelay("Name-rejected delay", 3000);
							Controls.OkCentered.click();
							D2Bot.updateStatus("Making Character: " + info.charName);
							Controls.OkCentered.click();
						}
					}
					break;
				}

				default:
					// Some other screen — e.g. mid-transition. Just wait a tick and re-check.
					break;
				}

				if (getTickCount() > deadline) {
					TeamLogger.error("charcreate", "timed out creating character", {
						charName: info.charName, location: getLocation()
					});
					return false;
				}
				delay(500);
			}

			// Persist the final char name back into D2Bot# so subsequent sessions
			// log straight into this char without trying to recreate it.
			D2Bot.setProfile(null, null, info.charName, "Normal");
			TeamLogger.info("charcreate", "character created", { charName: info.charName, charClass: info.charClass });
			return true;
		} catch (e) {
			TeamLogger.error("charcreate", "exception during makeCharacter: " + e.message, { stack: String(e) });
			return false;
		} finally {
			me.blockMouse = false;
		}
	}

	/**
	 * Install the CharSelect hook. Called ONCE from the entry `.dbj` inside main()
	 * AFTER kolbot's locationAction is set up (so `locations` has its stock handlers
	 * in place first — we override on top).
	 */
	function setup () {
		try {
			const { locations } = require("../../oog/Locations");

			// Custom CharSelect handler: try to find the configured char; if not
			// present, auto-create it. Falls through to stock behavior otherwise.
			const handler = function (loc) {
				try {
					// findCharacter returns the character's DOM control if the name
					// matches one on the account. If not, we need to create.
					const info = Starter.profileInfo || {};
					const wanted = info.charName || me.charname || "";
					let found = null;
					try { found = ControlAction.findCharacter(info, true); } catch (_) {}

					if (found) {
						// Stock behavior: click the char + OK to select it.
						found.click();
						Controls.BottomRightOk.click();
						return;
					}

					TeamLogger.info("charcreate", "char not found on account, creating", {
						wanted: wanted, location: loc
					});
					makeCharacter(info);
				} catch (e) {
					TeamLogger.error("charcreate", "CharSelect hook error: " + e.message);
				}
			};

			locations.set(sdk.game.locations.CharSelect, handler);
			locations.set(sdk.game.locations.CharSelectNoChars, handler);
			// CharSelectConnecting is a transient — the stock flow retries; we leave it.

			TeamLogger.info("charcreate", "CharSelect hook installed");
		} catch (e) {
			TeamLogger.error("charcreate", "setup failed: " + e.message);
		}
	}

	module.exports = {
		setup: setup,
		makeCharacter: makeCharacter,
		resolveClass: resolveClass
	};
})(module);
