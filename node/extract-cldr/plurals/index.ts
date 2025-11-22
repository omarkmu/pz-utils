/**
 * Handles extracting CLDR plural data to a usable format.
 */

import { OutputFormat } from '../output-format'
import { ExtractPluralsArgs } from './helpers'
import type { Argv } from 'yargs'
import { parseData } from './parse'
import { writeData } from './write'

/**
 * Builds arguments for the `plurals` command.
 */
export const buildPluralsCommand = (yargs: Argv): Argv<ExtractPluralsArgs> => {
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
 * Extracts plural data to the specified output format.
 */
export const extractPlurals = async (args: ExtractPluralsArgs) => {
    const rawCardinals = await import('cldr-core/supplemental/plurals.json')
    const rawOrdinals = await import('cldr-core/supplemental/ordinals.json')

    const ordinal = parseData(rawOrdinals.supplemental['plurals-type-ordinal'])
    const cardinal = parseData(
        rawCardinals.supplemental['plurals-type-cardinal'],
    )

    await writeData(args, cardinal, ordinal)
}
