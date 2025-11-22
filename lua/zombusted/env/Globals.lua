---Declares global functions with fields for mocking.
---@diagnostic disable: deprecated, undefined-field, access-invisible

require 'zombusted.env.Kahlua'
require 'zombusted.env.ui'
require 'zombusted.env.LuaEventManager'
require 'zombusted.env.BufferedReader'
require 'zombusted.env.LuaFileWriter'
require 'zombusted.env.ModData'
require 'zombusted.env.Translator'
local GlobalHelpers = require 'zombusted.mock.Globals'

local os = os
local math = math


local function getVirtualFile(filename, createIfNull, files)
    files = files or GlobalHelpers.FILES.LuaCache
    local sep = package.config:sub(1, 1)
    filename = filename:gsub('/', sep)
    filename = filename:gsub('\\', sep)

    if not files[filename] then
        if not createIfNull then
            return
        end

        files[filename] = { content = '' }
    end

    return files[filename]
end

function isAdmin() return GlobalHelpers.IS_ADMIN end

function isClient() return GlobalHelpers.IS_CLIENT end

function isServer() return GlobalHelpers.IS_SERVER end

function getActivatedMods()
    local mods = {}
    local size = #GlobalHelpers.ACTIVATED_MODS
    for i = 1, size do mods[i - 1] = GlobalHelpers.ACTIVATED_MODS[i] end

    return {
        size = function() return size end,
        get = function(_, index) return mods[index] end,
    }
end

function getDebug() return GlobalHelpers.IS_DEBUG end

function getFileReader(filename, createIfNull)
    local file = getVirtualFile(filename, createIfNull)
    if not file then
        return
    end

    return BufferedReader.newMock(file)
end

function getFileWriter(filename, createIfNull, append)
    local file = getVirtualFile(filename, createIfNull)

    local buffer
    if append and file then
        buffer = { file.content }
    end

    -- recreate bug from game; still pass if null
    return LuaFileWriter.newMock(file, buffer)
end

function getModFileReader(modId, filename, createIfNull)
    local files = GlobalHelpers.FILES.Mod[modId]
    if not files then
        return
    end

    local file = getVirtualFile(filename, createIfNull, files)
    if not file then
        return
    end

    return BufferedReader.newMock(file)
end

function getModFileWriter(modId, filename, createIfNull, append)
    local files = GlobalHelpers.FILES.Mod[modId]
    if not files then
        return
    end

    local file = getVirtualFile(filename, createIfNull, files)

    local buffer
    if append and file then
        buffer = { file.content }
    end

    -- recreate bug from game; still pass if null
    return LuaFileWriter.newMock(file, buffer)
end

function getOnlinePlayers()
    local players = {}
    local size = #GlobalHelpers.ONLINE_PLAYERS
    for i = 1, size do players[i - 1] = GlobalHelpers.ONLINE_PLAYERS[i] end

    return {
        size = function() return size end,
        get = function(_, index) return players[index] end,
    }
end

function getPlayerByOnlineID(id)
    for i = 1, #GlobalHelpers.ONLINE_PLAYERS do
        local player = GlobalHelpers.ONLINE_PLAYERS[i]
        if player:getOnlineID() == id then
            return player
        end
    end
end

function getPlayerFromUsername(username)
    for i = 1, #GlobalHelpers.ONLINE_PLAYERS do
        local player = GlobalHelpers.ONLINE_PLAYERS[i]
        if player:getUsername() == username then
            return player
        end
    end
end

function getSpecificPlayer(player)
    for i = 1, #GlobalHelpers.ONLINE_PLAYERS do
        local playerObj = GlobalHelpers.ONLINE_PLAYERS[i]
        if playerObj:getPlayerNum() == player then
            return playerObj
        end
    end
end

function getText(id) return GlobalHelpers.STRINGS[id] or id end

function getTextOrNull(id) return GlobalHelpers.STRINGS[id] end

function getTimestamp()
    if GlobalHelpers.TIMESTAMP then
        return math.floor(GlobalHelpers.TIMESTAMP / 1000)
    end

    return os.time()
end

function getTimestampMs()
    if GlobalHelpers.TIMESTAMP then
        return GlobalHelpers.TIMESTAMP
    end

    local secs = os.time()
    local _, ms = math.modf(os.clock())
    return ((secs + ms) * 1000) --[[@as integer]]
end

---@overload fun(module: string, command: string, args: table)
---@overload fun(player: IsoPlayer, module: string, command: string, args: table)
function sendClientCommand(...) end -- no-op for tests

---@overload fun(module: string, command: string, args: table)
---@overload fun(player: IsoPlayer, module: string, command: string, args: table)
function sendServerCommand(...) end -- no-op for tests

function triggerEvent(name, ...)
    LuaEventManager.triggerEvent(name, ...)
end

unpack = unpack or table.unpack
Faction = {
    getPlayerFaction = function(player)
        if not player._faction then
            return
        end

        return {
            getName = function() return player._faction end,
        }
    end,
}
