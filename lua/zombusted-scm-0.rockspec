rockspec_format = "3.0"
package = "zombusted"
version = "scm-0"
dependencies = {
    "lua >= 5.2"
}
source = {
    url = "git://github.com/omarkmu/pz-utils.git"
}
build = {
    type = "builtin",
    modules = {
        zombusted = "zombusted/init.lua",
        ["zombusted.env.ui"] = "zombusted/env/ui/init.lua",
        ["zombusted.env.ui.ISUIElement"] = "zombusted/env/ui/ISUIElement.lua",
        ["zombusted.env.ui.UIElement"] = "zombusted/env/ui/UIElement.lua",
        ["zombusted.env.ui.UIManager"] = "zombusted/env/ui/UIManager.lua",
        ["zombusted.env.Globals"] = "zombusted/env/Globals.lua",
        ["zombusted.env.BufferedReader"] = "zombusted/env/BufferedReader.lua",
        ["zombusted.env.Event"] = "zombusted/env/Event.lua",
        ["zombusted.env.EventList"] = "zombusted/env/EventList.lua",
        ["zombusted.env.ISBaseObject"] = "zombusted/env/ISBaseObject.lua",
        ["zombusted.env.Kahlua"] = "zombusted/env/Kahlua.lua",
        ["zombusted.env.LuaEventManager"] = "zombusted/env/LuaEventManager.lua",
        ["zombusted.env.LuaFileWriter"] = "zombusted/env/LuaFileWriter.lua",
        ["zombusted.env.ModData"] = "zombusted/env/ModData.lua",
        ["zombusted.env.Translator"] = "zombusted/env/Translator.lua",
        ["zombusted.mock"] = "zombusted/mock/init.lua",
        ["zombusted.mock.Color"] = "zombusted/mock/Color.lua",
        ["zombusted.mock.Globals"] = "zombusted/mock/Globals.lua",
        ["zombusted.mock.IsoPlayer"] = "zombusted/mock/IsoPlayer.lua",
        ["zombusted.mock.Language"] = "zombusted/mock/Language.lua",
        ["zombusted.mock.SurvivorDesc"] = "zombusted/mock/SurvivorDesc.lua",
    }
}
