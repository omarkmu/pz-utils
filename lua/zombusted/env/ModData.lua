---Declares a mock ModData table.
---@diagnostic disable: unused-local

local GlobalHelpers = require 'zombusted.mock.Globals'

ModData = {}
local ModData = ModData

function ModData.add(tag, table)
    GlobalHelpers.MOD_DATA[tag] = table
end

function ModData.get(tag)
    return GlobalHelpers.MOD_DATA[tag]
end

function ModData.getOrCreate(tag)
    if not GlobalHelpers.MOD_DATA[tag] then
        GlobalHelpers.MOD_DATA[tag] = {}
    end

    return GlobalHelpers.MOD_DATA[tag]
end
