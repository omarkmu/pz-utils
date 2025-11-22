/** Contains helpers for running the analyzer from a command. */

import fs from 'fs-extra'
import path from 'path'
import { Argv } from 'yargs'
import { AnalyzeCommandArgs, OutputFormat } from './helpers'
import FtlAnalyzer from './FtlAnalyzer'
import { getReport } from './report'

/**
 * Checks .ftl files for problems.
 */
export const analyzeFromCommand = async (args: AnalyzeCommandArgs) => {
    const isGitHub = args.format === OutputFormat.GitHub
    const analyzer = new FtlAnalyzer({
        ...args,
        useRelativePaths: isGitHub,
    })

    const discovered = await analyzer.discover(args.path)

    if (discovered.uris.size === 0) {
        console.log(`No .ftl files found in ${args.path}`)
        return
    }

    await analyzer.processDiscoveredFiles(discovered)

    const report = getReport(
        analyzer.getDiagnostics(),
        args.format,
        args.path,
        isGitHub && args.strict,
    )

    if (report.output) {
        console.log(report.output)
    }

    if (report.hasErrors || (args.strict && report.hasWarnings)) {
        process.exitCode = 1
    }
}

/**
 * Builds the analyze command.
 */
export const buildAnalyzeCommand = (yargs: Argv) => {
    return yargs
        .requiresArg(['path', 'format', 'source-locale', 'ignore'])
        .positional('path', {
            type: 'string',
            default: '.',
            desc: 'The path to search for .ftl files within',
        })
        .option('format', {
            type: 'string',
            alias: 'f',
            // default to github format when running as a github action
            default:
                process.env.GITHUB_ACTIONS === 'true'
                    ? OutputFormat.GitHub
                    : OutputFormat.Text,
            desc: 'The format to use for output',
            choices: ['text', 'json', 'github', 'silent'],
        })
        .option('ignore', {
            type: 'array',
            string: true,
            default: [],
            desc: 'List of warning types and categories to ignore',
        })
        .option('strict', {
            type: 'boolean',
            default: false,
            desc: 'Treat warnings as errors for the exit code',
        })
        .option('source-locale', {
            type: 'string',
            alias: 's',
            default: 'en',
            desc: 'The locale to use for comparing against other locales',
        })
        .coerce({
            format: (format: string) => {
                switch (format.toUpperCase()) {
                    case 'SILENT':
                        return OutputFormat.Silent

                    case 'JSON':
                        return OutputFormat.JSON

                    case 'GITHUB':
                        return OutputFormat.GitHub

                    default:
                        return OutputFormat.Text
                }
            },
            path: (inputPath: string) => {
                inputPath = path.resolve(inputPath)
                try {
                    const stat = fs.statSync(inputPath)
                    if (!stat.isDirectory()) {
                        throw new Error(`"${inputPath}" is not a directory`)
                    }

                    return inputPath
                } catch (err) {
                    if (!err || typeof err !== 'object' || !('code' in err)) {
                        throw err
                    }

                    if (err.code === 'ENOENT') {
                        throw new Error(`"${inputPath}" does not exist`)
                    }

                    throw err
                }
            },
        })
        .parserConfiguration({ 'boolean-negation': false })
        .wrap(Math.min(yargs.terminalWidth(), 125))
        .strict() as unknown as Argv<AnalyzeCommandArgs>
}
