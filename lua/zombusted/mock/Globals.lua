---Helpers for mocking global function behavior.
---@namespace zombusted

local EventList = require 'zombusted.env.EventList'
local Language = require 'zombusted.mock.Language'
local AddEvent = LuaEventManager.AddEvent

---@class mock.Globals
local GlobalHelpers = {
    IS_ADMIN = false,
    IS_DEBUG = false,
    IS_CLIENT = true,
    IS_SERVER = false,
    TIMESTAMP = nil, ---@type integer?
    STRINGS = {},
    ONLINE_PLAYERS = {},
    MOD_DATA = {},
    ACTIVATED_MODS = {},
    LANGUAGE = Language:newMock({ name = 'EN' }),
    DEFAULT_LANGUAGE = Language:newMock({ name = 'EN' }),
    FILES = {
        Mod = {},
        LuaCache = {},
    },
}

---Resets the event list with built-in events.
function GlobalHelpers.resetEvents()
    ---@diagnostic disable-next-line: global-in-non-module
    Events = {}
    for i = 1, #EventList do
        AddEvent(EventList[i])
    end
end

return GlobalHelpers
