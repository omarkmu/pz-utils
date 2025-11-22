/**
 * Formats for output of data.
 */
export enum OutputFormat {
    /**
     * Output the data as JSON.
     */
    JSON = 'json',

    /**
     * Output a Lua module that returns the data table.
     */
    LuaTable = 'lua-table',

    /**
     * Output a Lua module that returns a single function
     * which returns the data table.
     */
    LuaFunction = 'lua-function',
}
