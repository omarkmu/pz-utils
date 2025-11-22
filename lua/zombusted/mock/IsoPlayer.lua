---Mock player object for tests. Implements the minimum members for tests.
---@namespace zombusted

local Color = require 'zombusted.mock.Color'
local SurvivorDesc = require 'zombusted.mock.SurvivorDesc'

---@class mock.IsoPlayer
---@field private _username string
---@field private _onlineID number
---@field private _speechColor mock.Color
---@field private _survivorDesc mock.SurvivorDesc
---@field private _isDead boolean
---@field private _accessLevel string
---@field private _playerIndex integer
---@field private _faction string?
local IsoPlayer = {}
IsoPlayer.__index = IsoPlayer
IsoPlayer.NEXT_ONLINE_ID = 0

function IsoPlayer:getAccessLevel()
    local level = self._accessLevel:lower()

    if level == 'admin' then
        return 'Admin'
    elseif level == 'moderator' then
        return 'Moderator'
    elseif level == 'overseer' then
        return 'Overseer'
    elseif level == 'gm' then
        return 'GM'
    elseif level == 'observer' then
        return 'Observer'
    end

    return 'None'
end

function IsoPlayer:getDescriptor() return self._survivorDesc end

function IsoPlayer:getSpeakColour() return self._speechColor end

function IsoPlayer:getUsername() return self._username end

function IsoPlayer:getOnlineID() return self._onlineID end

function IsoPlayer:getPlayerNum() return self._playerIndex end

---@param accessLevel string
---@return boolean
function IsoPlayer:isAccessLevel(accessLevel)
    return self._accessLevel == accessLevel:lower()
end

function IsoPlayer:isDead() return self._isDead end

---@param accessLevel string
function IsoPlayer:setAccessLevel(accessLevel) self._accessLevel = accessLevel:lower() end

---@param dead boolean
function IsoPlayer:setDead(dead) self._isDead = dead end

---@param playerIndex integer
function IsoPlayer:setPlayerIndex(playerIndex) self._playerIndex = playerIndex end

---@param color mock.Color
function IsoPlayer:setSpeakColour(color) self._speechColor = color end

---@param args Args.IsoPlayer?
---@return mock.IsoPlayer
function IsoPlayer:newMock(args)
    ---@type mock.IsoPlayer
    local this = setmetatable({}, self)

    args = args or {}
    this._username = args.username or 'Username'

    if args.onlineID then
        this._onlineID = args.onlineID
    else
        this._onlineID = self.NEXT_ONLINE_ID
        self.NEXT_ONLINE_ID = self.NEXT_ONLINE_ID + 1
    end

    local color = args.speechColor or { r = 48, g = 48, b = 48 }
    this._speechColor = Color:newMock(color.r, color.g, color.b)
    this._survivorDesc = SurvivorDesc:newMock { forename = args.forename, surname = args.surname }
    this._isDead = false
    this._accessLevel = 'none'
    this._playerIndex = 0
    this._faction = args.faction

    return this
end

return IsoPlayer

--#region Type Definitions

---@class Args.IsoPlayer
---@field username? string A username for the player. Defaults to `Username`.
---@field forename? string A forename for the player character. Defaults to `John`.
---@field surname? string A surname for the player character. Defaults to `Zomboid`.
---@field onlineID? integer The online ID to use for the player. Defaults to an incrementing integer for each mock.
---@field speechColor? ColorTable<number> The speech color for the player. Defaults to #303030.
---@field faction? string The player's faction name.

--#endregion
