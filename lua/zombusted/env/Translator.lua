---Partial implementation of the Translator class.

Translator = {}
local Translator = Translator
Translator.__index = Translator

local GlobalHelpers = require 'zombusted.mock.Globals'

Translator.debug = false

function Translator.getDefaultLanguage()
    return GlobalHelpers.DEFAULT_LANGUAGE
end

function Translator.getLanguage()
    return GlobalHelpers.LANGUAGE
end
