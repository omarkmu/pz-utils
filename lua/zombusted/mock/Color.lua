---Mock object for a `Color`.
---@namespace zombusted

---@class mock.Color
---@field private _r integer
---@field private _g integer
---@field private _b integer
local Color = {}
Color.__index = Color


function Color:getRed() return self._r end

function Color:getGreen() return self._g end

function Color:getBlue() return self._b end

---@param r integer
---@param g integer
---@param b integer
---@return mock.Color
function Color:newMock(r, g, b)
    ---@type mock.Color
    local this = setmetatable({}, self)

    this._r = r
    this._g = g
    this._b = b

    return this
end

return Color
