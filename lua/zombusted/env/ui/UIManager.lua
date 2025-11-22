---Partial implementation of UIManager for tests.
---@diagnostic disable: missing-fields, inject-field

UIManager = {}
local UIManager = UIManager

UIManager.UI = {}
UIManager.uiUpdateTimeMS = 0
UIManager.uiUpdateIntervalMS = 0
UIManager.doTick = false

UIManager._toRemove = {}
UIManager._toAdd = {}


local function removeElement(t, el)
    for i = 1, #t do
        if t[i] == el then
            table.remove(t, i)
            return
        end
    end
end


function UIManager.AddUI(el)
    removeElement(UIManager._toRemove, el)
    UIManager._toRemove[#UIManager._toRemove + 1] = el

    removeElement(UIManager._toAdd, el)
    UIManager._toAdd[#UIManager._toAdd + 1] = el
end

function UIManager.getMillisSinceLastUpdate() return UIManager.uiUpdateIntervalMS end

function UIManager.getSecondsSinceLastUpdate() return UIManager.uiUpdateIntervalMS / 1000 end

function UIManager.RemoveElement(el)
    removeElement(UIManager._toAdd, el)
    removeElement(UIManager._toRemove, el)
    UIManager._toRemove[#UIManager._toRemove + 1] = el
end

function UIManager.update()
    for i = 1, #UIManager._toRemove do
        removeElement(UIManager.UI, UIManager._toRemove[i])
    end

    for i = 1, #UIManager._toAdd do
        UIManager.UI[#UIManager.UI + 1] = UIManager._toAdd[i]
    end

    UIManager._toAdd = {}
    UIManager._toRemove = {}

    local now = getTimestampMs() ---@type integer
    if now - UIManager.uiUpdateTimeMS >= 100 then
        UIManager.doTick = true
        UIManager.uiUpdateIntervalMS = math.min(now - UIManager.uiUpdateTimeMS, 1000)
        UIManager.uiUpdateTimeMS = now
    else
        UIManager.doTick = false
    end

    for i = 1, #UIManager.UI do
        UIManager.UI[i]:update()
    end
end
