---Partial implementation of ISUIElement for tests.

require 'zombusted.env.ISBaseObject'
require 'zombusted.env.ui.UIElement'

ISUIElement = ISBaseObject:derive('ISUIElement')
local ISUIElement = ISUIElement

ISUIElement.IDMax = 1


function ISUIElement:addToUIManager()
    if not self.javaObject then
        self:instantiate()
    end

    UIManager.AddUI(self.javaObject)
end

function ISUIElement:createChildren() end

function ISUIElement:getIsVisible() return self:isVisible() end

function ISUIElement:initialise()
    self.children = {}
    self.ID = ISUIElement.IDMax
    ISUIElement.IDMax = ISUIElement.IDMax + 1
end

function ISUIElement:instantiate()
    self.javaObject = UIElement.new(self)
    self.javaObject:setX(self.x)
    self.javaObject:setY(self.y)
    self.javaObject:setHeight(self.height)
    self.javaObject:setWidth(self.width)
    self.javaObject:setAnchorLeft(self.anchorLeft)
    self.javaObject:setAnchorRight(self.anchorRight)
    self.javaObject:setAnchorTop(self.anchorTop)
    self.javaObject:setAnchorBottom(self.anchorBottom)
    self.javaObject:setWantKeyEvents(self.wantKeyEvents or false)
    self.javaObject:setForceCursorVisible(self.forceCursorVisible or false)
    self:createChildren()
end

function ISUIElement:isVisible()
    if self.javaObject == nil then
        self:instantiate()
    end

    ---@diagnostic disable-next-line: need-check-nil
    return self.javaObject:isVisible()
end

function ISUIElement:removeFromUIManager()
    if not self.javaObject then
        return
    end

    UIManager.RemoveElement(self.javaObject)
    self.removed = true
end

function ISUIElement:setVisible(bVisible)
    if self.javaObject == nil then
        self:instantiate()
    end

    ---@diagnostic disable-next-line: need-check-nil
    self.javaObject:setVisible(bVisible)
end

function ISUIElement:new(x, y, width, height)
    local o = {}
    setmetatable(o, self)
    self.__index = self

    o.x = x
    o.y = y
    o.width = width
    o.height = height
    o.anchorLeft = true
    o.anchorRight = false
    o.anchorTop = true
    o.anchorBottom = false
    o.dock = 'none'
    o.minimumWidth = 0
    o.minimumHeight = 0
    o.scrollwidth = 0
    o.removed = false
    return o
end
