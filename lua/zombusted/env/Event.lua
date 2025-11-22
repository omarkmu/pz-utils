---Implementation of the Event class for tests.
---@namespace zombusted

---@class mock.Event
---@field Add fun(f: function | luassert.spy)
---@field Remove fun(f: function | luassert.spy)
---@field private _callbacks function[]
local Event = {}
Event.__index = Event


function Event:addCallback(cb)
    self._callbacks[#self._callbacks + 1] = cb
end

function Event:removeCallback(cb)
    for i = 1, #self._callbacks do
        if self._callbacks[i] == cb then
            table.remove(self._callbacks, i)
            break
        end
    end
end

function Event:trigger(...)
    for i = 1, #self._callbacks do
        self._callbacks[i](...)
    end
end

---@return mock.Event
function Event:newMock()
    local this = setmetatable({}, self) --[[@as mock.Event]]

    this._callbacks = {}
    this.Add = function(f) this:addCallback(f) end
    this.Remove = function(f) this:removeCallback(f) end

    return this
end

return Event
