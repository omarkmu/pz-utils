---Helpers for creating mocks.
---@namespace zombusted

require 'zombusted.env.Globals'

---@class mock
local mock = {}

---@type mock.Color
mock.Color = require 'zombusted.mock.Color'

---@type mock.Globals
mock.Globals = require 'zombusted.mock.Globals'

---@type mock.SurvivorDesc
mock.SurvivorDesc = require 'zombusted.mock.SurvivorDesc'

---@type mock.IsoPlayer
mock.IsoPlayer = require 'zombusted.mock.IsoPlayer'

---@type mock.Language
mock.Language = require 'zombusted.mock.Language'

local Globals = mock.Globals
local IsoPlayer = mock.IsoPlayer


---Adds a mock file to the Lua cache directory.
---@param filename any
---@param content any
function mock.addCacheFile(filename, content)
    local files = Globals.FILES.LuaCache
    files[filename] = { content = content }
end

---Adds a mod to the mock file system.
---@param modId any
function mock.addMod(modId)
    local files = Globals.FILES.Mod
    files[modId] = {}
end

---Adds a mock file to a Lua mod directory.
---@param modId any
---@param filename any
---@param content any
function mock.addModFile(modId, filename, content)
    local files = Globals.FILES.Mod
    if not files[modId] then
        files[modId] = {}
    end

    files[modId][filename] = { content = content }
end

---Removes all player mocks from the list of online players.
function mock.clearPlayers()
    Globals.ONLINE_PLAYERS = {}
    IsoPlayer.NEXT_ONLINE_ID = 0
end

---Creates a mock `IsoPlayer` object.
---Also adds the player to the list of online players.
---@param args zombusted.Args.IsoPlayer?
---@return zombusted.mock.IsoPlayer
function mock.createPlayer(args)
    local player = IsoPlayer:newMock(args)
    Globals.ONLINE_PLAYERS[#Globals.ONLINE_PLAYERS + 1] = player

    return player
end

---Resets all mock data to its original state.
function mock.reset()
    mock.resetAdmin()
    mock.resetActivatedMods()
    mock.resetDebug()
    mock.resetEvents()
    mock.resetFiles()
    mock.resetModData()
    mock.resetStrings()
    mock.resetTimestamp()
    mock.resetTranslator()
    mock.resetUI()
    mock.setIsServer(false)
    mock.clearPlayers()
end

---Resets the return value of `isAdmin` to `false`.
function mock.resetAdmin()
    Globals.IS_ADMIN = false
end

---Resets the return value of `getActivatedMods` to an empty list.
function mock.resetActivatedMods()
    Globals.ACTIVATED_MODS = {}
end

---Resets the return value of `getDebug` to `false`.
function mock.resetDebug()
    Globals.IS_DEBUG = false
end

---Resets events to their original state, clearing listeners and newly created events.
function mock.resetEvents()
    Globals.resetEvents()
end

---Resets the mock filesystem to its original state.
function mock.resetFiles()
    Globals.FILES.Mod = {}
    Globals.FILES.LuaCache = {}
end

---Resets the mock mod data to its original state.
function mock.resetModData()
    Globals.MOD_DATA = {}
end

---Resets `getTimestampMs` so that it gets a real timestamp.
---Also affects `getTimestamp`.
function mock.resetTimestamp()
    Globals.TIMESTAMP = nil
end

---Resets strings to their original state.
function mock.resetStrings()
    Globals.STRINGS = {}
end

---Resets the translator to its original state.
function mock.resetTranslator()
    Translator.debug = false
    Globals.LANGUAGE = mock.Language:newMock({ name = 'EN' })
    Globals.DEFAULT_LANGUAGE = mock.Language:newMock({ name = 'EN' })
end

---Resets the UI to its original state, removing all elements.
function mock.resetUI()
    ---@diagnostic disable-next-line: missing-fields
    UIManager.UI = {}
    UIManager.uiUpdateTimeMS = 0
    UIManager.uiUpdateIntervalMS = 0
    UIManager.doTick = false
    UIManager._toRemove = {}
    UIManager._toAdd = {}
end

---Sets whether `isAdmin` should return `true`.
---@param admin boolean
function mock.setAdmin(admin)
    Globals.IS_ADMIN = admin
end

---Sets the list of mods that should be returned by `getActivatedMods`
---@param list string[]
function mock.setActivatedMods(list)
    Globals.ACTIVATED_MODS = list
end

---Sets whether `getDebug` should return `true`.
---@param debug boolean
function mock.setDebug(debug)
    Globals.IS_DEBUG = debug
end

---Sets the language used as the default Translator language.
---@param language zombusted.mock.Language
function mock.setDefaultLanguage(language)
    Globals.DEFAULT_LANGUAGE = language
end

---Sets the language used as the current Translator language.
---@param language zombusted.mock.Language
function mock.setLanguage(language)
    Globals.LANGUAGE = language
end

---Sets whether `isServer` should return `true`.
---This also updates `isClient`.
---@param isServer boolean
function mock.setIsServer(isServer)
    Globals.IS_SERVER = isServer
    Globals.IS_CLIENT = not isServer
end

---Sets the value of a string.
---@param id string
---@param value string?
function mock.setString(id, value)
    Globals.STRINGS[id] = value
end

---Sets the return value of `getTimestampMs`.
---Also affects `getTimestamp`.
---@param n integer
function mock.setTimestampMs(n)
    Globals.TIMESTAMP = n
end

---Sets the debug state of the Translator.
---@param debug boolean
function mock.setTranslatorDebug(debug)
    Translator.debug = debug
end

---Triggers an update for UI elements.
---@param newTimestamp integer? A new value for the mock timestamp. If given `-1`, the timestamp won't be set.
function mock.triggerUIUpdate(newTimestamp)
    if newTimestamp and newTimestamp > 0 then
        Globals.TIMESTAMP = newTimestamp
    end

    UIManager.update()
end

mock.resetEvents()
return mock
