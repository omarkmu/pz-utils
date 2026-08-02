/** Handles transforming datetime formats to contain only Java-supported symbols. */

import { primitiveToLua, RawLuaExpression } from '../shared.js'
import { alterFormats, GroupedRawDateTimeData, preprocessData } from './helpers.js'

// eslint-disable-next-line no-control-regex
const LUA_SPLIT_REGEX = /^([\x00-\x7F]+?)?([^\x00-\x7F]+)([\x00-\x7F]+)?/

const JAVA_SPLIT_REGEX = /^([^']+?)?(''|'.+?')([^']+?)?/

interface FormatLiteral {
    value: string
}

/**
 * Converts a CLDR datetime format string to the Java format.
 * This is not exactly 1-to-1; Java does not support all of the CLDR options.
 */
const cldrToJava = (format: string): string => {
    return format
        .replaceAll('c', 'E') // no support for standalone week names (see "fi", "smn")
        .replaceAll(/[bB]/g, 'a') // no support for day periods, use am/pm (see "zh-Hant" — not a great replacement for B, but works here)
        .replaceAll(/Q/g, '') // no support for quarters (not currently in locale data)
        .replaceAll('v', 'z') // no support for timezone as v, z is equivalent (not currently in locale data)
}

const splitComponents = <T>(
    input: string,
    regex: RegExp,
    handleMatch: (match: string, components: (T | string)[]) => void,
): (T | string)[] => {
    let matches = input.match(regex)
    if (!matches) {
        return [input]
    }

    const components: (T | string)[] = []
    while (matches) {
        const full = matches[0]
        const before = matches[1]
        const nonASCII = matches[2]
        const after = matches[3]

        if (before) {
            components.push(before)
        }

        handleMatch(nonASCII, components)

        if (after) {
            components.push(after)
        }

        input = input.slice(full.length)
        matches = input.match(regex)
    }

    if (input.length > 0) {
        components.push(input)
    }

    return components
}

/**
 * Transforms a format string for PZ Lua.
 * This uses `string.char` for non-ASCII characters to avoid garbling.
 */
const transformForLua = (format: string): RawLuaExpression | string => {
    const components = splitComponents<number>(
        format,
        LUA_SPLIT_REGEX,
        (nonASCII, list) => {
            for (let i = 0; i < nonASCII.length; i++) {
                list.push(nonASCII.charCodeAt(i))
            }
        },
    )

    if (components.length === 1 && typeof components[0] === 'string') {
        return components[0]
    }

    const toConcat: string[] = []
    let currentRun: number[] = []

    for (const cmp of components) {
        if (typeof cmp === 'string') {
            if (currentRun.length > 0) {
                toConcat.push(`string.char(${currentRun.join(', ')})`)
                currentRun = []
            }

            toConcat.push(primitiveToLua(cmp))
        } else {
            currentRun.push(cmp)
        }
    }

    if (currentRun.length > 0) {
        toConcat.push(`string.char(${currentRun.join(', ')})`)
    }

    // include comment with original format for clarity
    const expr = toConcat.join(' .. ') + ` --[[${format}]]`
    return new RawLuaExpression(expr)
}

/**
 * Transforms a format string for Java DateTime format.
 */
const transformForJava = (format: string): string => {
    return splitComponents<FormatLiteral>(
        format,
        JAVA_SPLIT_REGEX,
        (literal, list) => {
            list.push({ value: literal })
        },
    )
        .map((x) => (typeof x === 'object' ? x.value : cldrToJava(x)))
        .join('')
}

/**
 * Transforms a format string for the output.
 */
const transform = (
    format: string,
    forLua: boolean,
): string | RawLuaExpression => {
    if (forLua) {
        return transformForLua(transformForJava(format))
    }

    return transformForJava(format)
}

/**
 * Parses raw datetime data into a list of datetime format objects.
 */
export const transformData = (
    raw: GroupedRawDateTimeData,
    forLua: boolean,
): object => {
    return preprocessData(raw).map((data) => {
        return {
            locales: [...data.locales],
            dateFormats: alterFormats(transform, data.dateFormats, forLua),
            timeFormats: alterFormats(transform, data.timeFormats, forLua),
            dateTimeFormats: alterFormats(
                transformForLua,
                data.dateTimeFormats,
            ),
        }
    })
}
