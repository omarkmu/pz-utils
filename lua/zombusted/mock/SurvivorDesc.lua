---Mock `SurvivorDesc` for tests.
---@namespace zombusted

---@class mock.SurvivorDesc
---@field private _forename string
---@field private _surname string
local SurvivorDesc = {}
SurvivorDesc.__index = SurvivorDesc

function SurvivorDesc:getForename() return self._forename end

function SurvivorDesc:getSurname() return self._surname end

---@param args Args.SurvivorDesc
---@return mock.SurvivorDesc
function SurvivorDesc:newMock(args)
    ---@type mock.SurvivorDesc
    local this = setmetatable({}, self)

    this._forename = args.forename or 'John'
    this._surname = args.surname or 'Zomboid'

    return this
end

return SurvivorDesc

--#region Type Definitions

---@class Args.SurvivorDesc
---@field forename? string A forename for the character. Defaults to `John`.
---@field surname? string A surname for the character. Defaults to `Zomboid`.

--#endregion
