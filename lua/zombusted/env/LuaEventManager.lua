---Partial implementation of the LuaEventManager class for tests.
---@diagnostic disable: missing-fields, duplicate-set-field

local Event = require 'zombusted.env.Event'

Events = {}
LuaEventManager = {}
local LuaEventManager = LuaEventManager

function LuaEventManager.AddEvent(name)
    if Events[name] then
        return
    end

    Events[name] = Event:newMock()
end

function LuaEventManager.triggerEvent(name, ...)
    if not Events[name] then
        Events[name] = Event:newMock()
    end

    local ev = Events[name] --[[@as any]]
    ev:trigger(...)
end
