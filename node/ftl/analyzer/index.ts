#!/usr/bin/env node
/** Entry point for analysis of .ftl files. */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { analyzeFromCommand, buildAnalyzeCommand } from './cli'

import FtlAnalyzer from './FtlAnalyzer'
export { FtlAnalyzer }
export * from './types'

/**
 * Parses arguments and runs the script.
 */
export const main = async () => {
    await yargs(hideBin(process.argv))
        .scriptName('pz-ftl-analyze')
        .command(
            '$0 [path]',
            'Analyzes Fluent translation files for syntax errors and problems.',
            buildAnalyzeCommand,
            analyzeFromCommand,
        )
        .parse()
}

if (require.main === module) {
    void main()
}
