/** Handles writing analysis reports. */

import { fileURLToPath } from 'url'
import path from 'path'
import * as core from '@actions/core'

import {
    DiagnosticInfo,
    DiagnosticSeverity,
    FileInfo,
    JsonDiagnostic,
    JsonReport,
    OutputFormat,
    ReportResult,
} from './types.js'

/**
 * Gets a string indicating the error and warning count.
 */
const getCountText = (
    errCount: number,
    warnCount: number,
    prefix = 'Finished with',
): string => {
    if (errCount === 0 && warnCount === 0) {
        return `${prefix} no errors`
    }

    const errors = errCount === 1 ? 'error' : 'errors'
    const warns = warnCount === 1 ? 'warning' : 'warnings'

    if (errCount === 0) {
        return `${prefix} ${warnCount} ${warns}`
    }

    if (warnCount === 0) {
        return `${prefix} ${errCount} ${errors}`
    }

    return `${prefix} ${errCount} ${errors} and ${warnCount} ${warns}`
}

/**
 * Gets a diagnostic as an object to be written as JSON.
 */
const getJSONError = (err: DiagnosticInfo): JsonDiagnostic => {
    return {
        code: err.code,
        message: err.message,
        file: fileURLToPath(err.uri),
        line: err.range.start.line,
        column: err.range.start.column,
    }
}

/**
 * Gets the text to use for an error for a plain text report.
 */
const getErrorText = (err: DiagnosticInfo, isError: boolean): string => {
    const output: (string | number)[] = [isError ? '[ERROR] ' : '[WARN] ']

    output.push(err.message)

    if (err.code.indexOf('-file') === -1) {
        output.push(' at ')
        output.push(fileURLToPath(err.uri))
        output.push(':')
        output.push(err.range.start.line)

        if (err.range.start.column > 1) {
            output.push(':')
            output.push(err.range.start.column)
        }
    }

    return output.join('')
}

/**
 * Gets the text to use for an error for a GitHub report.
 */
const getGitHubAnnotFromError = (
    err: DiagnosticInfo,
    basePath: string,
    isError: boolean,
): string => {
    const output: (string | number)[] = [isError ? '::error' : '::warning']

    if (err.code !== 'missing-file') {
        output.push(' file=')
        output.push(path.relative(basePath, fileURLToPath(err.uri)))
        output.push(',line=')
        output.push(err.range.start.line)
        output.push(',col=')
        output.push(err.range.start.column)
    }

    output.push('::')
    output.push(err.message)

    return output.join('')
}

/**
 * Gets the text to use for an error for a JSON report.
 */
const getJSON = (
    errors: DiagnosticInfo[],
    warnings: DiagnosticInfo[],
): string => {
    const data: JsonReport = {
        errors: errors.map((x) => getJSONError(x)),
        warnings: warnings.map((x) => getJSONError(x)),
    }

    return JSON.stringify(data)
}

/**
 * Determines the text to use for an annotations-only GitHub report.
 */
const getReportGitHubAnnotations = (
    errors: DiagnosticInfo[],
    warnings: DiagnosticInfo[],
    basePath: string,
): string => {
    if (errors.length === 0 && warnings.length === 0) {
        return getCountText(0, 0)
    }

    const output = [getCountText(errors.length, warnings.length), '']

    for (const err of errors) {
        output.push(getGitHubAnnotFromError(err, basePath, true))
    }

    for (const err of warnings) {
        output.push(getGitHubAnnotFromError(err, basePath, false))
    }

    return output.join('\n')
}

/**
 * Gets the URL of a file in a GitHub repository.
 * Assumes GitHub action environment variables are set.
 */
const getGitHubFileURL = (filePath: string, basePath: string): string => {
    const cwd = process.cwd()
    filePath = path.relative(cwd, path.join(basePath, filePath))

    if (filePath.startsWith('..')) {
        filePath = filePath.slice(2)
    }

    const env = process.env
    const commitSHA = env.GITHUB_SHA
    const repo = env.GITHUB_REPOSITORY
    if (!commitSHA || !repo) {
        // not a GitHub action but using the GitHub output anyway?
        // okay, you do you
        return filePath
    }

    filePath = filePath.replaceAll('\\', '/')
    const serverURL = env.GITHUB_SERVER_URL || 'https://github.com'
    return `${serverURL}/${repo}/blob/${commitSHA}/${filePath}`
}

/**
 * Writes an error to the GitHub Actions summary.
 */
const writeGitHubSummaryError = (
    err: DiagnosticInfo,
    fileURL: string,
    withListItemTags = true,
) => {
    const summary = core.summary
    const message = err.message.replaceAll(/"(.*?)"/g, '<code>$1</code>')

    if (withListItemTags) {
        summary.addRaw('<li>', true)
    }

    summary.addRaw(message)
    summary.addRaw(' at ')

    const start = err.range.start
    const end = err.range.end

    let lineText = `L${start.line}C${start.column}`
    if (end && end.line !== start.line) {
        lineText += `-L${end.line}`
    }

    core.summary.addLink(
        `line ${start.line}, column ${start.column}`,
        `${fileURL}#${lineText}`,
    )

    if (withListItemTags) {
        summary.addRaw('</li>', true)
    }
}

/**
 * Determines the text to use for a GitHub report, and writes a markdown summary
 * to the GITHUB_STEP_SUMMARY file.
 */
const getReportGitHubSummary = async (
    errors: DiagnosticInfo[],
    warnings: DiagnosticInfo[],
    analyzedFiles: FileInfo[],
    basePath: string,
): Promise<string> => {
    const summary = core.summary.addHeading('Results')
    const output = [getCountText(errors.length, warnings.length), '']

    const result = getCountText(errors.length, warnings.length, 'Found') + '.'
    summary.addRaw(result, true)

    const otherFiles: FileInfo[] = []
    const warningsToAdd: DiagnosticInfo[] = []
    for (const file of analyzedFiles) {
        const fileErrors = errors.filter((x) => x.uri === file.path.uri)
        const fileWarns = warnings.filter((x) => x.uri === file.path.uri)

        if (fileErrors.length === 0 && fileWarns.length === 0) {
            otherFiles.push(file)
            continue
        }

        const fileURL = getGitHubFileURL(file.path.relative, basePath)
        summary.addRaw('<h2>')
        summary.addLink(file.path.relative, fileURL)
        summary.addRaw('</h2>')

        if (fileErrors.length > 0) {
            summary.addHeading('Errors', 3)
            summary.addRaw('<ul>', true)

            for (const err of fileErrors) {
                output.push(getGitHubAnnotFromError(err, basePath, true))
                writeGitHubSummaryError(err, fileURL)
            }

            summary.addRaw('</ul>', true)
        }

        if (fileWarns.length > 0) {
            summary.addHeading('Warnings', 3)
            summary.addRaw('<ul>', true)

            for (const err of fileWarns) {
                warningsToAdd.push(err)
                writeGitHubSummaryError(err, fileURL)
            }

            summary.addRaw('</ul>', true)
        }
    }

    // add warnings after errors, since GitHub only allows 10 in-file annotations
    for (const err of warningsToAdd) {
        output.push(getGitHubAnnotFromError(err, basePath, false))
    }

    const otherHeading =
        errors.length === 0 && warnings.length === 0
            ? 'Analyzed files'
            : 'Other analyzed files (no errors or warnings)'

    if (otherFiles.length > 0) {
        summary.addHeading(otherHeading, 2)
        summary.addRaw('<ul>', true)
        for (const file of otherFiles) {
            const filePath = file.path.relative

            summary.addRaw('<li>', true)
            summary.addLink(filePath, getGitHubFileURL(filePath, basePath))
            summary.addRaw('</li>', true)
        }

        summary.addRaw('</ul>', true)
    }

    await summary.write()
    return output.join('\n')
}

/**
 * Determines the text to use for a text-based report.
 */
const getReportText = (
    errors: DiagnosticInfo[],
    warnings: DiagnosticInfo[],
): string => {
    if (errors.length === 0 && warnings.length === 0) {
        return getCountText(0, 0)
    }

    const output = [getCountText(errors.length, warnings.length), '']

    for (const err of errors) {
        output.push(getErrorText(err, true))
    }

    if (errors.length > 0 && warnings.length > 0) {
        output.push('')
    }

    for (const err of warnings) {
        output.push(getErrorText(err, false))
    }

    return output.join('\n')
}

/**
 * Sorts diagnostic list entries.
 * @returns
 */
const sortDiagnostics = (a: DiagnosticInfo, b: DiagnosticInfo): number => {
    const fileSort = a.uri.localeCompare(b.uri)
    if (fileSort !== 0) {
        return fileSort
    }

    const lineSort = a.range.start.line - b.range.start.line
    if (lineSort !== 0) {
        return lineSort
    }

    return a.range.start.column - b.range.start.column
}

/**
 * Gets the report text to write to the console,
 * or `undefined` if nothing should be written.
 */
export const getReport = async (
    diagnostics: DiagnosticInfo[],
    format: OutputFormat,
    basePath: string,
    analyzedFiles: FileInfo[],
    warningsAsErrors = false,
): Promise<ReportResult> => {
    // split into errors and warnings
    const errors: DiagnosticInfo[] = []
    const warnings: DiagnosticInfo[] = []

    for (const diag of diagnostics) {
        if (warningsAsErrors || diag.severity === DiagnosticSeverity.Error) {
            errors.push(diag)
        } else {
            warnings.push(diag)
        }
    }

    const result: ReportResult = {
        hasWarnings: warnings.length > 0,
        hasErrors: errors.length > 0,
    }

    if (format === OutputFormat.Silent) {
        return result
    }

    errors.sort(sortDiagnostics)
    warnings.sort(sortDiagnostics)

    switch (format) {
        case OutputFormat.JSON:
            result.output = getJSON(errors, warnings)
            break

        case OutputFormat.GitHubAnnotations:
            result.output = getReportGitHubAnnotations(
                errors,
                warnings,
                basePath,
            )
            break

        case OutputFormat.GitHubSummary:
            result.output = await getReportGitHubSummary(
                errors,
                warnings,
                analyzedFiles,
                basePath,
            )

            break

        default:
            result.output = getReportText(errors, warnings)
            break
    }

    return result
}
