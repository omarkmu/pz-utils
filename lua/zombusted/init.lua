---Helpers for testing Project Zomboid code with busted.
---@class zombusted
zombusted = {}

require 'zombusted.env.Globals'

---@type zombusted.mock
zombusted.mock = require 'zombusted.mock'

---Returns the environment in use for tests.
---@return table
function zombusted.getTestEnv()
    if getfenv then
        error('Lua 5.2 or greater required')
    end

    local level = 1
    while true do
        local idx = 1
        while true do
            local info = debug.getinfo(level, 'f')
            local name, value = debug.getupvalue(info.func, idx)

            if name == '_ENV' and type(value) == 'table' and type(value.assert) == 'table' then
                return value
            elseif not name then
                break
            end

            idx = idx + 1
        end

        level = level + 1
    end

    error('Failed to load test environment')
end

---Unloads a required module then requires it.
---@param mod string
---@return ...any
function zombusted.reload(mod)
    package.loaded[mod] = nil
    return require(mod)
end

---Unloads a required module.
---@param mod string
function zombusted.unload(mod)
    package.loaded[mod] = nil
end

---@class ColorTable<T: number>
---@field r T
---@field g T
---@field b T
