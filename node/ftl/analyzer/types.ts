/** Helper types for analysis. */

import ast from '@fluent/syntax'
import { DiagnosticSeverity } from 'vscode-languageserver'
export { DiagnosticSeverity } from 'vscode-languageserver'

/**
 * Helper type for an object containing a span.
 */
export type HasSpan = { span: ISpan }

/**
 * Helper for asserting that a node has a span.
 */
export type WithSpan<T extends ast.SyntaxNode> = T & HasSpan

/**
 * Type representing an AST span.
 */
export interface ISpan {
    start: number
    end: number
}

/**
 * Type representing a set of diagnostic information.
 */
export interface IReportable {
    code: string
    message: string
    span: ISpan
}

/**
 * AST node types, excluding junk and spans.
 */
export type ASTNode =
    | ast.Resource
    | ast.Message
    | ast.Term
    | ast.Pattern
    | ast.Attribute
    | ast.TextElement
    | ast.Variant
    | ast.NamedArgument
    | ast.Identifier
    | ast.Comment
    | ast.GroupComment
    | ast.ResourceComment
    | ast.Expression

/**
 * Options for formatting the output.
 */
export enum OutputFormat {
    /**
     * Outputs as a list of errors and warnings in plain text.
     */
    Text = 'text',

    /**
     * Outputs as JSON.
     */
    JSON = 'json',

    /**
     * Outputs in a format readable by GitHub actions.
     */
    GitHub = 'github',

    /**
     * No output.
     */
    Silent = 'silent',
}

/**
 * A start or end of a range with information about the line, column, and index.
 */
export interface DiagnosticRangeElement {
    /**
     * The 1-indexed line number of the element.
     */
    line: number

    /**
     * The 1-indexed column number of the element.
     */
    column: number

    /**
     * The 0-indexed position of the element.
     */
    index: number
}

/**
 * A range at which a problem occurred.
 */
export interface DiagnosticRange {
    /**
     * The start of the range.
     */
    start: DiagnosticRangeElement

    /**
     * The end of the range.
     * Assumed to be the same as the start if not given.
     */
    end?: DiagnosticRangeElement
}

/**
 * Information about a problem found with an .ftl file.
 */
export interface DiagnosticInfo {
    /**
     * The severity of the problem.
     */
    severity: DiagnosticSeverity

    /**
     * The error message.
     */
    message: string

    /**
     * The error code.
     */
    code: string

    /**
     * The URI of the file in which the error occurred.
     */
    uri: string

    /**
     * The range of the problem in the file.
     */
    range: DiagnosticRange
}

export interface JsonDiagnostic {
    code: string
    message: string
    file: string
    line: number
    column: number
}

export interface JsonReport {
    errors: JsonDiagnostic[]
    warnings: JsonDiagnostic[]
}

export interface ReportResult {
    output?: string

    hasWarnings: boolean

    hasErrors: boolean
}

/**
 * Describes the translation requirement type of a message, term, or attribute.
 */
export enum TranslateType {
    Required = 0,
    Optional = 1,
    Disallowed = 2,
}

/**
 * The state of annotations found in a resource.
 */
export interface AnnotationState {
    /**
     * Option for whether message translations should be marked
     * as required, optional, or disallowed.
     */
    translate: TranslateType

    /**
     * The file being read.
     */
    file: FileInfo

    /**
     * The bundle defined by the annotations, or undefined for the
     * default bundle.
     */
    bundle?: string

    /**
     * Flag for whether the resource is marked as global.
     */
    global?: boolean

    /**
     * The current set of ignored warning types and categories.
     */
    ignore: Set<string>

    /**
     * Flag for whether all diagnostics should be ignored.
     */
    ignoreAll?: boolean
}

/**
 * Container for path information.
 */
export interface PathInfo {
    /**
     * The URI for the file path.
     */
    uri: string

    /**
     * The absolute path to the file
     */
    absolute: string

    /**
     * The file path relative to the base path.
     */
    relative: string
}

/**
 * Shared information among attributes, messages, and terms.
 */
interface ElementInfo<T> {
    /**
     * The identifier name.
     */
    id: string

    /**
     * The display name for the item.
     */
    name: string

    /**
     * The pattern used for the value.
     */
    value: T

    /**
     * The span of the identifier.
     */
    idSpan: ISpan

    /**
     * Option for whether the element is marked as
     * required, optional, or disallowed for translation.
     */
    translate: TranslateType

    /**
     * Flag for whether this is marked as expecting an identical value.
     */
    expectIdentical?: boolean

    /**
     * Associates parameter names to information about `@param` annotations.
     */
    params: Record<string, ParamInfo>

    /**
     * Set of referenced variables.
     */
    variables: Set<string>
}

interface BaseMessageInfo<
    Value = ast.Pattern | undefined,
    IsTerm extends boolean = false,
> extends ElementInfo<Value> {
    /**
     * Flag for whether this represents a term.
     */
    isTerm: IsTerm

    /**
     * The comment of the message.
     */
    comment?: string

    /**
     * Associates attribute identfiers to information about attributes.
     */
    attributes: Record<string, AttributeInfo>

    /**
     * Flag for whether all diagnostics should be ignored.
     */
    ignoreAll?: boolean

    /**
     * The set of warning types and categories ignored by the element.
     */
    ignore: Set<string>
}

/**
 * Information about an attribute.
 */
export type AttributeInfo = ElementInfo<ast.Pattern>

/**
 * Information about a message.
 */
export type MessageInfo = BaseMessageInfo

/**
 * Information about a term.
 */
export type TermInfo = BaseMessageInfo<ast.Pattern, true>

/**
 * Information about a message, term, or attribute.
 */
export type EntryInfo = MessageInfo | TermInfo | AttributeInfo

/**
 * Information about an `@param` annotation.
 */
export interface ParamInfo {
    /**
     * The name of the parameter.
     */
    id: string

    /**
     * Flag for whether the parameter is required.
     */
    required: boolean

    /**
     * The type specified in the annotation.
     */
    type?: string

    /**
     * The parameter description.
     */
    comment?: string
}

/**
 * Information about an .ftl file.
 */
export interface FileInfo {
    /**
     * The filename of the file, without the extension.
     */
    name: string

    /**
     * The path to the file.
     */
    path: PathInfo

    /**
     * The file content.
     * If `hash` is unset, this value is uninitialized.
     */
    content: string

    /**
     * The terms in the parsed file AST.
     */
    terms: TermInfo[]

    /**
     * The messages in the parsed file AST.
     */
    messages: MessageInfo[]

    /**
     * The bundle defined by annotations.
     *
     * The default bundle is indicated by a value of `undefined`.
     * The empty string denotes the global bundle.
     */
    bundle?: string

    /**
     * A set of file-level diagnostics to ignore.
     */
    ignore?: Set<string>

    /**
     * The last hash of the file's content.
     * If this is undefined, the file needs to be parsed.
     */
    hash?: number
}

/**
 * A collection of files that share a locale.
 */
export interface FileGroup {
    /**
     * The locale of the file group.
     */
    locale: string

    /**
     * Associates file URIs to information about files.
     */
    files: Map<string, FileInfo>
}

/**
 * A collection of .ftl files associated with different locales.
 *
 * This represents a folder which contains multiple locale folders,
 * each containing .ftl files.
 */
export interface FileCollection {
    /**
     * The path to the collection folder.
     */
    path: PathInfo

    /**
     * Associates locale folder names to file groups.
     */
    groups: Map<string, FileGroup>
}

/**
 * The result of .ftl discovery.
 */
export interface DiscoveryResult {
    /**
     * The .ftl collections that were found.
     */
    collections: FileCollection[]

    /**
     * Loose .ftl files that don't belong to a collection.
     */
    ungrouped: FileGroup

    /**
     * A set of URIs of the files that were collected.
     */
    uris: Set<string>
}

/**
 * Information about a single annotation in a comment.
 */
export interface AnnotationItem {
    /**
     * The name of the annotation, without the `@` sign.
     */
    name: string

    /**
     * The text following the annotation.
     */
    value: string
}

/**
 * The result of extracting annotations out of a comment.
 */
export interface ExtractedComment {
    /**
     * The comment lines without annotations.
     * If no non-annotation lines are found, this is the empty string.
     */
    comment: string

    /**
     * The extracted annotations.
     */
    annotations: AnnotationItem[]
}

/**
 * Arguments for the `ftl analyze` command.
 */
export interface AnalyzeCommandArgs {
    /**
     * The path to read files from.
     */
    path: string

    /**
     * The format to use for output.
     */
    format: OutputFormat

    /**
     * The source locale to use for comparisons.
     */
    sourceLocale: string

    /**
     * Warning types and categories to ignore.
     */
    ignore: string[]

    /**
     * Flag for treating warnings as errors,
     * for the purpose of determining the exit code.
     */
    strict: boolean
}

/**
 * Type representing which attributes
 */
export const enum AttributeAnnotationType {
    None,
    All,
}

/**
 * Arguments for creation of an FtlAnalyzer.
 */
export interface AnalyzerArgs {
    /**
     * Warning types and categories to ignore.
     */
    ignore: Iterable<string>

    /**
     * The source locale to use for comparisons.
     */
    sourceLocale: string

    /**
     * Flag for whether relative paths should be used in messages.
     * Defaults to `false`.
     */
    useRelativePaths?: boolean
}
