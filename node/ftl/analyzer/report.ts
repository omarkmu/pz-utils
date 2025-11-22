/** Handles writing analysis reports. */

import { fileURLToPath } from 'url'
import {
    DiagnosticInfo,
    DiagnosticSeverity,
    JsonDiagnostic,
    JsonReport,
    OutputFormat,
    ReportResult,
} from './types'
import path from 'path'

/**
 * Gets a string indicating the error and warning count.
 */
const getCountText = (errCount: number, warnCount: number): string => {
    if (errCount === 0 && warnCount === 0) {
        return 'Finished with no errors'
    }

    const errors = errCount === 1 ? 'error' : 'errors'
    const warns = warnCount === 1 ? 'warning' : 'warnings'

    if (errCount === 0) {
        return `Finished with ${warnCount} ${warns}`
    }

    if (warnCount === 0) {
        return `Finished with ${errCount} ${errors}`
    }

    return `Finished with ${errCount} ${errors} and ${warnCount} ${warns}`
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
const getGitHubText = (
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
 * Determines the text to use for a GitHub report.
 */
const getReportGitHub = (
    errors: DiagnosticInfo[],
    warnings: DiagnosticInfo[],
    basePath: string,
): string => {
    if (errors.length === 0 && warnings.length === 0) {
        return getCountText(0, 0)
    }

    const output = [getCountText(errors.length, warnings.length), '']

    for (const err of errors) {
        output.push(getGitHubText(err, basePath, true))
    }

    for (const err of warnings) {
        output.push(getGitHubText(err, basePath, false))
    }

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
export const getReport = (
    diagnostics: DiagnosticInfo[],
    format: OutputFormat,
    basePath: string,
    warningsAsErrors = false,
): ReportResult => {
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

        case OutputFormat.GitHub:
            result.output = getReportGitHub(errors, warnings, basePath)
            break

        default:
            result.output = getReportText(errors, warnings)
            break
    }

    return result
}
