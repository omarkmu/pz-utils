/** Helper types and functions for checking .ftl files. */

import * as ast from '@fluent/syntax'
import path from 'path'
import { pathToFileURL } from 'url'
import {
    AnnotationItem,
    DiagnosticRange,
    ExtractedComment,
    FileCollection,
    FileGroup,
    FileInfo,
    IReportable,
    ISpan,
    PathInfo,
} from './types.js'

export * from './types.js'

const REGEXP_LINE = /[^\n]*\n|[^\n]+/g

export type WarnCode = keyof typeof WARN_STRINGS

const WARN_STRINGS = {
    'do-not-translate-message': 'Message "{0}" should not be translated',
    'do-not-translate-term': 'Term "{0}" should not be translated',
    'do-not-translate-attribute': 'Attribute "{0}" should not be translated',
    'identical-message':
        'Message "{0}" is identical to the source locale message',
    'identical-attribute':
        'Attribute "{0}" is identical to the source locale attribute',
    'duplicate-message': 'Duplicate message "{0}"',
    'duplicate-term': 'Duplicate term "{0}"',
    'duplicate-attribute': 'Duplicate attribute "{0}"',
    'mismatch-message':
        'Message "{0}" should be identical to the source locale message',
    'mismatch-attribute':
        'Attribute "{0}" should be identical to the source locale attribute',
    'mismatch-file-bundle':
        'File {0} is assigned to the {1} bundle, but to the {2} bundle in the source locale',
    'unknown-file':
        'File {0} does not have a corresponding file in the source locale',
    'unknown-message':
        'Message "{0}" is defined here, but is not defined in the source locale',
    'unknown-attribute':
        'Attribute "{0}" is defined here, but is not defined in the source locale',
    'unknown-variable':
        'Variable "{0}" is used here, but is not used or declared in the source locale {1}',
    'missing-file': 'File {0} is missing',
    'missing-message': 'Message "{0}" is missing',
    'missing-attribute': 'Attribute "{0}" is missing',
    'missing-required-variable':
        'Variable {0} is required, but missing in {1} "{2}"',
    'annotation-missing': 'Annotation "{0}" is missing for {1} "{2}"',
    'annotation-type-mismatch':
        'Annotation "{0}" type does not match the source locale for {1} "{2}"',
}

/**
 * Gets a line and column from an index in a string.
 */
const getLineAndCol = (
    text: string,
    idx: number,
): [line: number, column: number] => {
    let line = 1
    let col = 1

    for (let i = 0; i < idx; i++) {
        col++
        if (text[i] === '\n') {
            line++
            col = 1
        }
    }

    return [line, col]
}

/**
 * Creates a record for an .ftl file.
 */
export const createFileRecord = (
    filePath: string,
    basePath: string,
    uri?: string,
): FileInfo => {
    const pathInfo = getPathInfo(filePath, basePath, uri)
    const name = path.basename(pathInfo.relative, '.ftl')

    return {
        content: '',
        terms: [],
        messages: [],
        name,
        path: pathInfo,
    }
}

/**
 * Creates a reportable object for a warning type.
 */
export const createWarning = (
    code: WarnCode,
    span: ISpan,
    ...args: string[]
): IReportable => {
    const message = WARN_STRINGS[code].replace(
        /{(\d+)}/g,
        (match: string, index: string) => args[parseInt(index)] || match,
    )

    return { code, message, span }
}

/**
 * Gets the display string to use for a bundle.
 */
export const getBundleDisplay = (bundle?: string) => {
    switch (bundle) {
        case '':
            return 'global'
        case undefined:
            return 'default'
        default:
            return `"${bundle}"`
    }
}

/**
 * Gets a file list from a list of collections.
 */
export const getFileList = (
    collections: FileCollection[],
    ungrouped?: FileGroup,
): FileInfo[] => {
    const analyzedFiles: FileInfo[] = []
    for (const col of collections) {
        for (const group of col.groups.values()) {
            analyzedFiles.push(...group.files.values())
        }
    }

    if (ungrouped !== undefined) {
        analyzedFiles.push(...ungrouped.files.values())
    }

    return analyzedFiles
}

/**
 * Gets information about a path, relative to a base path.
 */
export const getPathInfo = (
    itemPath: string,
    basePath: string,
    uri?: string,
): PathInfo => {
    const relative = path.relative(basePath, itemPath)
    const absolute = path.resolve(path.join(basePath, relative))
    uri ??= pathToFileURL(absolute).toString()

    return { uri, absolute, relative }
}

/**
 * Gets the category to use for a warning.
 */
export const getWarningCategory = (code: string): string => {
    // special case
    if (code.startsWith('do-not-translate')) {
        return 'do-not-translate'
    }

    const dash = code.indexOf('-')
    if (dash === -1) {
        return code
    }

    return code.slice(0, dash)
}

/**
 * Checks whether a path is within another.
 */
export const isPathInside = (childPath: string, parent: string): boolean => {
    const relative = path.relative(parent, childPath)
    if (!relative) {
        return false
    }

    return !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * Checks whether two patterns are equivalent.
 */
export const patternsEqual = (
    pattern?: ast.Pattern | null,
    other?: ast.Pattern | null,
): boolean => {
    if (!pattern || !other) {
        return pattern === other
    }

    return pattern.equals(other)
}

/**
 * Extracts annotations from a comment.
 */
export const readAnnots = (content: string): ExtractedComment => {
    const lines: string[] = []
    const annotations: AnnotationItem[] = []

    const matches = content.match(REGEXP_LINE) ?? []
    for (const match of matches) {
        if (!match.startsWith('@')) {
            lines.push(match)
            continue
        }

        const space = match.indexOf(' ')
        const name = space !== -1 ? match.slice(0, space) : match.trimEnd()
        const value = space !== -1 ? match.slice(space + 1).trim() : ''

        annotations.push({ name, value })
    }

    const comment = lines.length > 0 ? lines.join('\n').trim() : ''
    return { comment, annotations }
}

/**
 * Converts a span into a diagnostic range.
 */
export const spanToRange = (span: ISpan, content: string): DiagnosticRange => {
    const start = span.start < 0 ? content.length + span.start : span.start
    const end = span.end < 0 ? content.length + span.end : span.end

    const [startLine, startCol] = getLineAndCol(content, start)
    const [endLine, endCol] = getLineAndCol(content, end)

    return {
        start: {
            line: startLine,
            column: startCol,
            index: start,
        },
        end: {
            line: endLine,
            column: endCol,
            index: end,
        },
    }
}

/**
 * Gets a key, or inserts a default value if it's not present.
 */
export const getOrDefault = <K, V>(map: Map<K, V>, key: K, value: V): V => {
    const existing = map.get(key)
    if (existing) {
        return existing
    }

    map.set(key, value)
    return value
}
