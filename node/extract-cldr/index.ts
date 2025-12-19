#!/usr/bin/env node
/**
 * Entry point for CLDR data extraction.
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { buildPluralsCommand, extractPlurals } from './plurals'
import { buildDatetimeCommand, extractDateTime } from './datetime'

/**
 * Parses arguments and runs the script.
 */
export const main = async () => {
    await yargs(hideBin(process.argv))
        .scriptName('pz-extract-cldr')
        .command(
            'plurals',
            'Extracts CLDR plural data.',
            buildPluralsCommand,
            extractPlurals,
        )
        .command(
            'datetime',
            'Extracts CLDR datetime data.',
            buildDatetimeCommand,
            extractDateTime,
        )
        .strictCommands()
        .demandCommand()
        .parseAsync()
        .catch((e) => {
            console.error(e)
            process.exitCode = 1
        })
}

if (require.main === module) {
    void main()
}
