---Partial implementation of a buffered reader that reads from a virtual file.
---@diagnostic disable: undefined-field, inject-field

BufferedReader = {}
local BufferedReader = BufferedReader
BufferedReader.__index = BufferedReader


function BufferedReader:read()
    if self.ptr > #self.text then
        return -1
    end

    local char = self.text:sub(self.ptr, self.ptr + 1)
    self.ptr = self.ptr + 1

    return char:byte()
end

function BufferedReader:readLine()
    if self.ptr > #self.text then
        return
    end

    local str
    local nextLF = self.text:find('\n')
    if not nextLF then
        str = self.text:sub(self.ptr)
        self.ptr = #self.text + 1
    else
        str = self.text:sub(self.ptr, nextLF - 1)
        self.ptr = nextLF + 1
    end

    return str
end

function BufferedReader:close()
    self.closed = true
    self.fileHandle.isReading = false
end

function BufferedReader.newMock(fileHandle)
    local this = setmetatable({}, BufferedReader)

    this.closed = false
    this.text = fileHandle.content
    this.ptr = 1
    this.fileHandle = fileHandle

    fileHandle.isReading = true

    return this
end
