/**
 * Handles extracting CLDR plural data to a usable format.
 */

import type { Argv } from 'yargs'
import { parseData } from './parse'
import { ExtractPluralsArgs, PluralRules } from './helpers'
import { buildExtractCommand, getOutput, writeFileOrConsole } from '../shared'

const DEFAULT_HEADER_LUA = `---Data for pluralization rules.
---This is a generated file; see https://github.com/omarkmu/pz-utils.
`

/**
 * Builds arguments for the `plurals` command.
 */
export const buildPluralsCommand = (yargs: Argv): Argv<ExtractPluralsArgs> => {
    return buildExtractCommand(yargs)
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

/**
 * Writes plural data to an output file.
 */
export const writeData = async (
    args: ExtractPluralsArgs,
    cardinal: PluralRules[],
    ordinal: PluralRules[],
) => {
    await writeFileOrConsole(
        args.output,
        getOutput({ cardinal, ordinal }, args, DEFAULT_HEADER_LUA),
    )
}
