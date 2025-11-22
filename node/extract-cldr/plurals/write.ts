/**
 * Handles writing data to an output file.
 */

import fs from 'fs-extra'
import { OutputFormat } from '../output-format'
import { ExtractPluralsArgs, PluralRules } from './helpers'

type WritableType = object | string | number | boolean

const INDENT = '    '
const DEFAULT_HEADER_LUA = `---Data for pluralization rules.
---This is a generated file; see https://github.com/omarkmu/pz-utils.
`

const LUA_TABLE_TEMPLATE = `{header}{prefix}{return}{content}{trailer}`
const LUA_FUNCTION_TEMPLATE = `{header}{prefix}{return}function()
    return {content}
end{trailer}`

const INLINE_LIMIT = 120

/**
 * Gets the string to use for a template insertion option.
 */
const getTemplateOption = (
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
 * Gets the output string to write.
 */
const getOutput = (
    data: object,
    format: OutputFormat,
    header?: string | false,
    prefix?: string | false,
    trailer?: string | false,
    pretty?: boolean,
    withReturn?: boolean,
): string => {
    const isJSON = format === OutputFormat.JSON

    pretty ??= true
    header = getTemplateOption(header, isJSON ? '' : DEFAULT_HEADER_LUA)
    prefix = getTemplateOption(prefix, '', true)
    trailer = getTemplateOption(trailer)

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

    const template = isFunction ? LUA_FUNCTION_TEMPLATE : LUA_TABLE_TEMPLATE
    return template
        .replace('{content}', rope.join(''))
        .replace('{header}', header)
        .replace('{prefix}', prefix)
        .replace('{trailer}', trailer)
        .replace('{return}', withReturn ? 'return ' : '')
}

/**
 * Gets a Lua string representation of a string, boolean, or number.
 */
const primitiveToLua = (data: WritableType) => {
    switch (typeof data) {
        case 'string':
            return `'${data}'`
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
 * Converts an object to its Lua equivalent.
 * Doesn't handle string escapes, cycles, or any other complex data;
 * they aren't needed for the purpose of this script.
 */
const writeLuaToRope = (
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
 * Writes plural data to an output file.
 */
export const writeData = async (
    args: ExtractPluralsArgs,
    cardinal: PluralRules[],
    ordinal: PluralRules[],
) => {
    const data = { cardinal, ordinal }
    const content = getOutput(
        data,
        args.format ?? OutputFormat.LuaFunction,
        args.header,
        args.prefix,
        args.trailer,
        args.pretty,
        args.return,
    )

    if (!args.output) {
        console.log(content)
        return
    }

    try {
        await fs.outputFile(args.output, content)
    } catch (err: unknown) {
        console.error(`Failed to write file "${args.output}"`)
        console.error(err)
    }
}
