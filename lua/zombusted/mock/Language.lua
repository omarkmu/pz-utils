---Mock language object for tests. Implements the minimum members for tests.
---@namespace zombusted

---@class mock.Language
---@field private _base string?
---@field private _name string
local Language = {}
Language.__index = Language

function Language:base()
    return self._base
end

function Language:name()
    return self._name
end

---@param args Args.Language
---@return mock.Language
function Language:newMock(args)
    ---@type mock.Language
    local this = setmetatable({}, self)

    this._name = args.name
    this._base = args.base

    return this
end

return Language

--#region Type Definitions

---@class Args.Language
---@field name string The language name.
---@field base? string The base language.

--#endregion
