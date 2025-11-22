---Implementation of ISBaseObject for tests.

ISBaseObject = {}
local ISBaseObject = ISBaseObject

function ISBaseObject:initialise() end

function ISBaseObject:derive(type)
    local o = {}
    setmetatable(o, self)
    self.__index = self
    o.Type = type
    return o
end

function ISBaseObject:new()
    local o = {}
    setmetatable(o, self)
    self.__index = self
    return o
end
