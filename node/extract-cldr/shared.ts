/** Shared helpers and types for CLDR extraction scripts. */

import fs from 'fs-extra'
import { Argv } from 'yargs'

const INLINE_LIMIT = 120
export const INDENT = '    '
export const LUA_TABLE_TEMPLATE = `{header}{prefix}{return}{content}{trailer}`
export const LUA_FUNCTION_TEMPLATE = `{header}{prefix}{return}function()
    return {content}
end{trailer}`

type WritableType = object | string | number | boolean

/**
 * Generic arguments for extraction of data.
 */
export interface ExtractArgs {
    /**
     * The path to use for the output file.
     */
    output?: string

    /**
     * The format to use for output.
     */
    format?: OutputFormat

    /**
     * The header to include with a newline.
     */
    header?: string | false

    /**
     * The prefix to include directly before the generated statement or expression.
     */
    prefix?: string | false

    /**
     * The trailer to include.
     */
    trailer?: string | false

    /**
     * Flag for whether output should be written with newlines and indentation.
     */
    pretty: boolean

    /**
     * Flag for whether output should be written with a return statement.
     */
    return?: boolean
}

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

/**
 * Wrapper for writing a Lua expression as-is.
 */
export class RawLuaExpression {
    expr: string

    constructor(expr: string) {
        this.expr = expr
    }
}

/**
 * Gets a Lua string representation of a string, boolean, or number.
 */
export const primitiveToLua = (data: WritableType) => {
    switch (typeof data) {
        case 'string':
            // don't need anything more sophisticated than this
            if (data.includes("'")) {
                return `"${data}"`
            } else {
                return `'${data}'`
            }
        case 'boolean':
            return data ? 'true' : 'false'
        case 'number':
            return data.toString()
        default:
            throw new Error(`Unexpected type: ${typeof data}`)
    }
}

/**
 * Gets the length that an object would take up if written inline.
 * Returns -1 if the length exceeds 120.
 */
const getInlineLength = (
    curLen: number,
    data: WritableType,
    key?: string,
): number => {
    if (key) {
        curLen += key.length + 3 // "X = "
    }

    if (curLen > INLINE_LIMIT) {
        return -1
    }

    if (typeof data !== 'object') {
        curLen += primitiveToLua(data).length
        return curLen > INLINE_LIMIT ? -1 : curLen
    }

    curLen++ // {
    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            const value = data[i]
            curLen++ // space

            curLen = getInlineLength(curLen, value)
            if (curLen === -1) {
                return -1
            }

            if (i < data.length - 1) {
                curLen++ // ,
            }
        }

        curLen += 3 // space + } + comma
        return curLen > INLINE_LIMIT ? -1 : curLen
    }

    const entries = Object.entries(data)
    for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i]

        curLen++ // space

        curLen = getInlineLength(curLen, value, key)
        if (curLen === -1) {
            return -1
        }

        if (i < entries.length - 1) {
            curLen++ // ,
        }
    }

    curLen += 3 // space + } + comma
    return curLen > INLINE_LIMIT ? -1 : curLen
}

/**
 * Checks whether an object or array value should be written inline.
 */
const canWriteInline = (
    curLineLength: number,
    value: WritableType,
    key?: string,
) => {
    if (key === 'rules' || typeof value !== 'object') {
        return false
    }

    return getInlineLength(curLineLength, value) !== -1
}

/**
 * Builds arguments for an extraction command.
 */
export const buildExtractCommand = (yargs: Argv): Argv<ExtractArgs> => {
    return yargs
        .option('output', {
            alias: 'o',
            type: 'string',
            desc: 'The path to use for the output file',
        })
        .option('format', {
            alias: 'f',
            type: 'string',
            desc: 'The format to use for output',
            default: 'lua-function',
            choices: ['lua-function', 'lua-table', 'json'],
        })
        .option('header', {
            type: 'string',
            desc: 'Content to include at the top of the file',
            default: undefined,
            defaultDescription: 'format-dependent',
        })
        .option('trailer', {
            type: 'string',
            desc: 'Content to include at the end of the file',
            default: undefined,
        })
        .option('prefix', {
            type: 'string',
            desc: 'Content to include before the statement or expression',
            default: undefined,
        })
        .option('pretty', {
            type: 'boolean',
            default: true,
            hidden: true,
        })
        .option('no-pretty', {
            type: 'boolean',
            desc: 'Write output without newlines and indentation',
        })
        .option('return', {
            type: 'boolean',
            default: true,
            hidden: true,
        })
        .option('no-return', {
            type: 'boolean',
            desc: 'Write Lua output without a return statement',
        })
        .coerce({
            format: (format: string) => {
                switch (format.toUpperCase()) {
                    case 'JSON':
                        return OutputFormat.JSON

                    case 'LUA-TABLE':
                        return OutputFormat.LuaTable

                    default:
                        return OutputFormat.LuaFunction
                }
            },
        })
        .wrap(Math.min(yargs.terminalWidth(), 130))
        .strict()
}

/**
 * Gets the string to use for a template insertion option.
 */
export const getTemplateOption = (
    text?: string | false,
    defaultText = '',
    noTrailingNewline = false,
): string => {
    if (text === false) {
        return ''
    }

    text ??= defaultText
    text = text.replaceAll('\\n', '\n')

    return text + (noTrailingNewline ? '' : '\n')
}

/**
 * Resolves a Lua template with the given substitutions.
 */
export const resolveLuaTemplate = (
    vars: Record<string, string>,
    isFunction: boolean = false,
    withReturn: boolean = false,
): string => {
    const template = isFunction ? LUA_FUNCTION_TEMPLATE : LUA_TABLE_TEMPLATE
    return template
        .replace('{content}', vars.content ?? '')
        .replace('{header}', vars.header ?? '')
        .replace('{prefix}', vars.prefix ?? '')
        .replace('{trailer}', vars.trailer ?? '')
        .replace('{return}', withReturn ? 'return ' : '')
}

/**
 * Converts an object to its Lua equivalent.
 * Doesn't handle string escapes, cycles, or any other complex data;
 * they aren't needed for the purpose of this script.
 */
export const writeLuaToRope = (
    data: WritableType,
    rope: string[],
    indent: string,
    skipIndent = false,
    inline = false,
    space = ' ',
) => {
    if (typeof data !== 'object') {
        rope.push(primitiveToLua(data))
        return
    }

    if (data instanceof RawLuaExpression) {
        rope.push(data.expr)
        return
    }

    if (!skipIndent) {
        rope.push(indent)
    }

    rope.push('{')
    const innerIndent = indent + INDENT
    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            const value = data[i]

            rope.push(inline ? space : '\n')
            rope.push(inline ? '' : innerIndent)

            writeLuaToRope(
                value,
                rope,
                innerIndent,
                true,
                inline || canWriteInline(innerIndent.length, value),
                space,
            )

            rope.push(!inline || i < data.length - 1 ? ',' : '')
        }

        rope.push(inline ? space : '\n')
        rope.push(inline ? '' : indent)
        rope.push('}')
        return
    }

    const entries = Object.entries(data)
    for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i]

        rope.push(inline ? space : '\n')
        rope.push(inline ? '' : innerIndent)
        rope.push(key) // always a valid identfier from plural data
        rope.push(space)
        rope.push('=')
        rope.push(space)

        const curLen = innerIndent.length + key.length + 3
        writeLuaToRope(
            value,
            rope,
            innerIndent,
            true,
            inline || canWriteInline(curLen, value, key),
            space,
        )

        rope.push(!inline || i < entries.length - 1 ? ',' : '')
    }

    rope.push(inline ? space : '\n')
    rope.push(inline ? '' : indent)
    rope.push('}')
}

/**
 * Gets a Lua output string to write for an object.
 */
export const getOutput = (
    data: object,
    args: ExtractArgs,
    defaultHeader?: string,
): string => {
    const format = args.format ?? OutputFormat.LuaFunction
    const isJSON = format === OutputFormat.JSON

    const pretty = args.pretty ?? true
    const header = getTemplateOption(args.header, isJSON ? '' : defaultHeader)
    const prefix = getTemplateOption(args.prefix, '', true)
    const trailer = getTemplateOption(args.trailer)

    if (isJSON) {
        return (
            (header.trim() !== '' ? header : '') +
            JSON.stringify(data, undefined, pretty ? 2 : undefined) +
            trailer
        )
    }

    const isFunction = format === OutputFormat.LuaFunction
    const rope: string[] = []
    writeLuaToRope(
        data,
        rope,
        isFunction ? INDENT : '', // function starts with an indentation level
        isFunction,
        !pretty,
        pretty ? ' ' : '',
    )

    return resolveLuaTemplate(
        {
            content: rope.join(''),
            header,
            prefix,
            trailer,
        },
        isFunction,
        args.return,
    )
}

/**
 * Writes content to an output file.
 * If no output file is specified, writes to the console.
 */
export const writeFileOrConsole = async (
    path: string | undefined,
    content: string,
) => {
    if (!path) {
        console.log(content)
        return
    }

    try {
        await fs.outputFile(path, content)
    } catch (err: unknown) {
        console.error(`Failed to write file "${path}"`)
        console.error(err)
    }
}
