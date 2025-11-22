---Partial implementation of UIElement for tests.
---@diagnostic disable: inject-field

require 'zombusted.env.ISBaseObject'

UIElement = {}
UIElement.__index = UIElement



function UIElement:getHeight() return self.height end

function UIElement:getX() return self.x end

function UIElement:getY() return self.y end

function UIElement:getWidth() return self.width end

function UIElement:isAnchorBottom() return self.anchorBottom end

function UIElement:isAnchorLeft() return self.anchorLeft end

function UIElement:isAnchorRight() return self.anchorRight end

function UIElement:isAnchorTop() return self.anchorTop end

function UIElement:isForceCursorVisible() return self.bForceCursorVisible end

function UIElement:isVisible() return self.visible end

function UIElement:isWantKeyEvents() return self.bWantKeyEvents end

function UIElement:setAnchorBottom(bAnchorBottom) self.anchorBottom = bAnchorBottom end

function UIElement:setAnchorLeft(bAnchorLeft) self.anchorLeft = bAnchorLeft end

function UIElement:setAnchorRight(bAnchorRight) self.anchorRight = bAnchorRight end

function UIElement:setAnchorTop(bAnchorTop) self.anchorTop = bAnchorTop end

function UIElement:setForceCursorVisible(bForce) self.bForceCursorVisible = bForce end

function UIElement:setHeight(height) self.height = height end

function UIElement:setX(x) self.x = x end

function UIElement:setY(y) self.y = y end

function UIElement:setVisible(visible) self.visible = visible end

function UIElement:setWidth(width) self.width = width end

function UIElement:setWantKeyEvents(bWantKeyEvents) self.bWantKeyEvents = bWantKeyEvents end

function UIElement:update()
    if not UIManager.doTick then
        return
    end

    local table = self.table ---@diagnostic disable-line: undefined-field
    if table and table.update then
        table.update(table)
    end
end

function UIElement.new(table)
    local o = {}
    setmetatable(o, UIElement)

    o.x = 0
    o.y = 0
    o.width = 256
    o.height = 256
    o.table = table
    o.anchorTop = true
    o.anchorLeft = true
    o.anchorRight = false
    o.anchorBottom = false
    o.bWantKeyEvents = false
    o.bForceCursorVisible = false
    o.visible = true

    return o
end
