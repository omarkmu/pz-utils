/** Handles analysis of .ftl files. */

import fs from 'fs-extra'
import path from 'path'
import murmurhash from 'murmurhash'
import ast from '@fluent/syntax'
import { fileURLToPath } from 'url'

import {
    getOrDefault,
    spanToRange,
    readAnnots,
    createWarning,
    getWarningCategory,
    getBundleDisplay,
    DiagnosticSeverity,
    TranslateType,
    WarnCode,
    patternsEqual,
} from './helpers'

import type {
    AnalyzerArgs,
    FileCollection,
    DiscoveryResult,
    FileInfo,
    WithSpan,
    DiagnosticInfo,
    FileGroup,
    MessageInfo,
    TermInfo,
    ISpan,
    ASTNode,
    AnnotationItem,
    AnnotationState,
    ParamInfo,
    HasSpan,
    AttributeInfo,
    IReportable,
    EntryInfo,
} from './types'
import { discover } from './discover'

const REGEXP_PARAM = /^\$([A-Za-z][\w_-]*)(\??)(?:\s+([^# ]+))?(.*)$/

const REGEXP_PARAM_ATTR =
    /^([A-Za-z][\w_-]*)\s+\$([A-Za-z][\w_-]*)(\??)(?:\s+([^# ]+))?(.*)$/

/**
 * Analyzer for .ftl files.
 */
export default class FtlAnalyzer {
    /**
     * The source locale to use for comparisons.
     */
    sourceLocale: string

    /**
     * Associates file URIs to diagnostics found during analysis.
     */
    diagnostics: Map<string, DiagnosticInfo[]>

    /**
     * Set of warning types and categories that should always be ignored.
     */
    ignore: Set<string>

    /**
     * Flag for whether relative paths should be used in messages.
     */
    useRelativePaths: boolean

    /**
     * Creates a new analyzer.
     */
    constructor(args: AnalyzerArgs) {
        this.sourceLocale = args.sourceLocale
        this.ignore = new Set(args.ignore)
        this.diagnostics = new Map()
        this.useRelativePaths = args.useRelativePaths ?? false
    }

    /**
     * Runs discovery on a path.
     */
    async discover(basePath: string): Promise<DiscoveryResult> {
        return discover(basePath)
    }

    /**
     * Gets all diagnostics as a list.
     */
    getDiagnostics(): DiagnosticInfo[] {
        const allDiagnostics: DiagnosticInfo[] = []
        for (const list of this.diagnostics.values()) {
            allDiagnostics.push(...list)
        }

        return allDiagnostics
    }

    /**
     * Gets diagnostics associated with a URI.
     */
    getDiagnosticsForUri(uri: string): DiagnosticInfo[] {
        return this.diagnostics.get(uri) ?? []
    }

    /**
     * Performs analysis on a collection of .ftl files.
     */
    async processCollection(collection: FileCollection) {
        for (const group of collection.groups.values()) {
            await this.readGroup(group)
        }

        const srcGroup = collection.groups.get(this.sourceLocale)
        if (srcGroup === undefined) {
            // no source group → no warnings from comparison
            return
        }

        for (const group of collection.groups.values()) {
            if (group === srcGroup) {
                this.checkSourceGroup(group)
            } else {
                this.compareGroups(group, srcGroup)
            }
        }
    }

    /**
     * Performs analysis on discovered collections and files.
     */
    async processDiscoveredFiles(discovered: DiscoveryResult) {
        for (const collection of discovered.collections) {
            await this.processCollection(collection)
        }

        await this.readGroup(discovered.ungrouped)
        this.checkSourceGroup(discovered.ungrouped)
    }

    /**
     * Adds a diagnostic associated with a file.
     */
    private addDiagnostic(
        severity: DiagnosticSeverity,
        file: FileInfo,
        report: IReportable,
    ) {
        getOrDefault(this.diagnostics, file.path.uri, []).push({
            severity,
            message: report.message,
            code: report.code,
            uri: file.path.uri,
            range: spanToRange(report.span, file.content),
        })
    }

    /**
     * Adds a warning associated with a message, term, or attribute.
     */
    private addEntryWarning(
        file: FileInfo,
        entry: EntryInfo,
        code: WarnCode,
        ...args: string[]
    ) {
        if ('isTerm' in entry) {
            if (entry.ignoreAll) {
                return
            }

            if (this.shouldIgnore(code, entry.ignore)) {
                return
            }
        }

        this.addDiagnostic(
            DiagnosticSeverity.Warning,
            file,
            createWarning(code, entry.idSpan, ...args),
        )
    }

    /**
     * Adds an error associated with a file.
     */
    private addError(file: FileInfo, report: IReportable) {
        this.addDiagnostic(DiagnosticSeverity.Error, file, report)
    }

    /**
     * Adds a warning about a file missing from a locale,
     * unless the source file indicates that it should be ignored.
     */
    private addMissingFileWarning(srcFile: FileInfo, locale: string) {
        if (srcFile.ignore?.has('missing-file')) {
            return
        }

        this.addWarning(
            srcFile,
            'missing-file',
            { start: 0, end: 0 },
            path.join(
                path.dirname(path.dirname(this.getDisplayPath(srcFile))),
                locale,
                `${srcFile.name}.ftl`,
            ),
        )
    }

    /**
     * Adds a warning about a message missing from a file.
     */
    private addMissingMessageWarning(file: FileInfo, message: MessageInfo) {
        if (file.ignore?.has('missing-message')) {
            return
        }

        if (message.translate !== TranslateType.Required) {
            return
        }

        this.addWarning(
            file,
            'missing-message',
            { start: -1, end: -1 },
            message.name,
        )
    }

    /**
     * Adds a warning about a file existing which does not exist in the source locale.
     */
    private addUnknownFileWarning(file: FileInfo) {
        if (file.ignore?.has('unknown-file')) {
            return
        }

        this.addWarning(
            file,
            'unknown-file',
            { start: 0, end: 0 },
            this.getDisplayPath(file),
        )
    }

    /**
     * Adds a warning associated with a file.
     */
    private addWarning(
        file: FileInfo,
        code: WarnCode,
        span: ISpan,
        ...args: string[]
    ) {
        this.addDiagnostic(
            DiagnosticSeverity.Warning,
            file,
            createWarning(code, span, ...args),
        )
    }

    /**
     * Validates parameter annotations on a message and its attributes.
     */
    private checkMessageParams(
        file: FileInfo,
        message: MessageInfo,
        srcMessage?: MessageInfo,
        isSrc?: boolean,
    ) {
        this.checkParams(file, message, srcMessage, isSrc)

        const srcAttributes = srcMessage?.attributes ?? {}
        for (const attr of Object.values(message.attributes)) {
            this.checkParams(file, attr, srcAttributes[attr.id], isSrc, true)
        }
    }

    /**
     * Validates parameter annotations and variable references on an entry.
     */
    private checkParams(
        file: FileInfo,
        entry: EntryInfo,
        srcEntry?: EntryInfo,
        isSrc?: boolean,
        isAttr?: boolean,
    ) {
        const type = isAttr ? 'attribute' : 'message'
        const params: Record<string, ParamInfo> = {}

        if (srcEntry) {
            for (const param of Object.values(srcEntry.params)) {
                params[param.id] = param
            }
        }

        for (const param of Object.values(entry.params)) {
            const srcParam = params[param.id]
            params[param.id] = param

            if (srcParam && srcParam.type !== param.type) {
                this.addEntryWarning(
                    file,
                    entry,
                    'annotation-type-mismatch',
                    isAttr
                        ? `@param-attribute ${entry.id} $${param.id}`
                        : `@param $${param.id}`,
                    type,
                    entry.name,
                )
            }
        }

        // check for missing annots and unknown variable references
        for (const variable of entry.variables) {
            if (isSrc && !params[variable]) {
                this.addEntryWarning(
                    file,
                    entry,
                    'annotation-missing',
                    isAttr
                        ? `@param-attribute ${entry.id} $${variable}`
                        : `@param $${variable}`,
                    type,
                    entry.name,
                )
            }

            if (isSrc || !srcEntry) {
                continue
            }

            if (!srcEntry.variables.has(variable) && !params[variable]) {
                this.addEntryWarning(
                    file,
                    entry,
                    'unknown-variable',
                    `$${variable}`,
                    type,
                )
            }
        }

        // check for missing required vars
        for (const param of Object.values(params)) {
            if (!param.required || entry.variables.has(param.id)) {
                continue
            }

            this.addEntryWarning(
                file,
                entry,
                'missing-required-variable',
                `$${param.id}`,
                type,
                entry.name,
            )
        }
    }

    /**
     * Validates a group with no source group (a source locale group or an ungrouped "group").
     */
    private checkSourceGroup(group: FileGroup) {
        for (const file of group.files.values()) {
            const seenMessages = new Set<string>()
            for (const message of file.messages) {
                if (seenMessages.has(message.id)) {
                    this.addEntryWarning(
                        file,
                        message,
                        'duplicate',
                        'message',
                        message.name,
                    )
                }

                seenMessages.add(message.id)
                this.checkMessageParams(file, message, undefined, true)
            }

            const seenTerms = new Set<string>()
            for (const term of file.terms) {
                if (seenTerms.has(term.id)) {
                    this.addEntryWarning(
                        file,
                        term,
                        'duplicate',
                        'term',
                        term.name,
                    )
                }

                seenTerms.add(term.id)
            }
        }
    }

    /**
     * Collects identifiers for variables referenced in a pattern.
     */
    private collectVariables(pattern?: ast.Pattern | null): Set<string> {
        const vars = new Set<string>()

        if (!pattern) {
            return vars
        }

        const stack: ASTNode[] = [...pattern.elements]

        while (stack.length > 0) {
            const el = stack.pop()!

            switch (el.type) {
                case 'VariableReference':
                    vars.add(el.id.name)
                    break

                case 'Placeable':
                    stack.push(el.expression)
                    break

                case 'FunctionReference':
                    // named arguments can only use literals
                    stack.push(...el.arguments.positional)
                    break

                case 'SelectExpression':
                    stack.push(el.selector)
                    stack.push(...el.variants)
                    break
            }
        }

        return vars
    }

    /**
     * Compares sets of attributes between a locale and the source locale.
     */
    private compareAttributes(
        file: FileInfo,
        entry: MessageInfo | TermInfo,
        srcAttributes: Record<string, AttributeInfo>,
    ) {
        const attributes = entry.attributes

        // terms attributes only need the do-not-translate annotation
        if (entry.isTerm) {
            for (const attr of Object.values(attributes)) {
                const srcAttr = srcAttributes[attr.id]

                if (srcAttr?.translate === TranslateType.Disallowed) {
                    this.addEntryWarning(
                        file,
                        attr,
                        'do-not-translate',
                        'Attribute',
                        attr.name,
                    )
                }
            }

            return
        }

        const attrSet = new Set<string>()
        for (const attr of Object.values(attributes)) {
            attrSet.add(attr.id)

            const srcAttr = srcAttributes[attr.id]
            if (!srcAttr) {
                if (!this.shouldIgnore('unknown-attribute', entry.ignore)) {
                    this.addEntryWarning(
                        file,
                        attr,
                        'unknown-attribute',
                        attr.id,
                    )
                }

                continue
            }

            if (srcAttr.translate === TranslateType.Disallowed) {
                if (!this.shouldIgnore('do-not-translate', entry.ignore)) {
                    this.addEntryWarning(
                        file,
                        attr,
                        'do-not-translate',
                        'Attribute',
                        attr.name,
                    )
                }
            }

            const isEq = patternsEqual(attr.value, srcAttr.value)
            const expectEq =
                (attr.expectIdentical || srcAttr.expectIdentical) ?? false

            if (isEq !== expectEq) {
                this.addEntryWarning(
                    file,
                    attr,
                    isEq ? 'identical' : 'mismatch-identical',
                    'Attribute',
                    attr.name,
                )
            }
        }

        for (const srcAttr of Object.values(srcAttributes)) {
            if (srcAttr.translate !== TranslateType.Required) {
                continue
            }

            if (!attrSet.has(srcAttr.id)) {
                this.addEntryWarning(
                    file,
                    entry,
                    'missing-attribute',
                    `${entry.name}.${srcAttr.id}`,
                )
            }
        }
    }

    /**
     * Compares files between a locale and the source locale.
     */
    private compareFiles(file: FileInfo, srcFile: FileInfo, locale: string) {
        if (!file) {
            this.addMissingFileWarning(srcFile, locale)
            return
        }

        if (file.bundle !== srcFile.bundle) {
            this.addWarning(
                file,
                'mismatch-file-bundle',
                { start: 0, end: 0 },
                this.getDisplayPath(file),
                getBundleDisplay(file.bundle),
                getBundleDisplay(srcFile.bundle),
            )

            return
        }

        // compare terms
        const srcTermById = srcFile.terms.reduce((rec, term) => {
            rec[term.id] = term
            return rec
        }, {} as Record<string, TermInfo | undefined>)

        file.terms.reduce((rec, term) => {
            if (rec[term.id]) {
                this.addEntryWarning(file, term, 'duplicate', 'term', term.name)
            }

            const srcTerm = srcTermById[term.id]
            if (srcTerm) {
                this.compareAttributes(file, term, srcTerm.attributes)
            }

            return rec
        }, {} as Record<string, TermInfo | undefined>)

        // compare messages
        const messageById = file.messages.reduce((rec, msg) => {
            if (rec[msg.id]) {
                this.addEntryWarning(
                    file,
                    msg,
                    'duplicate',
                    'message',
                    msg.name,
                )
            }

            rec[msg.id] = msg
            return rec
        }, {} as Record<string, MessageInfo | undefined>)

        const srcMessageSet = new Set<string>()
        for (const srcMessage of srcFile.messages) {
            srcMessageSet.add(srcMessage.id)

            const message = messageById[srcMessage.id]
            if (!message) {
                this.addMissingMessageWarning(file, srcMessage)
                continue
            }

            this.compareMessages(file, message, srcMessage)
        }

        for (const message of file.messages) {
            if (!srcMessageSet.has(message.id)) {
                this.addEntryWarning(
                    file,
                    message,
                    'unknown-message',
                    message.id,
                )
            }
        }
    }

    /**
     * Compares a group with the source locale group to create warnings.
     */
    private compareGroups(group: FileGroup, srcGroup: FileGroup) {
        // compare files, handle unknown-file & mismatch-file-bundle
        const fileByName = [...group.files.values()].reduce((rec, file) => {
            rec[file.name] = file
            return rec
        }, {} as Record<string, FileInfo | undefined>)

        const srcFileSet = new Set<string>()
        for (const srcFile of srcGroup.files.values()) {
            srcFileSet.add(srcFile.name)

            const file = fileByName[srcFile.name]
            if (!file) {
                this.addMissingFileWarning(srcFile, group.locale)
                continue
            }

            this.compareFiles(file, srcFile, group.locale)
        }

        for (const file of group.files.values()) {
            if (!srcFileSet.has(file.name)) {
                this.addUnknownFileWarning(file)
            }
        }
    }

    /**
     * Compares messages between a locale and the source locale.
     */
    private compareMessages(
        file: FileInfo,
        message: MessageInfo,
        srcMessage: MessageInfo,
    ) {
        if (srcMessage.translate === TranslateType.Disallowed) {
            this.addEntryWarning(
                file,
                message,
                'do-not-translate',
                'Message',
                message.name,
            )
        }

        const isEq = patternsEqual(message.value, srcMessage.value)
        const expectEq =
            (message.expectIdentical || srcMessage.expectIdentical) ?? false

        if (isEq !== expectEq && (!isEq || message.value)) {
            this.addEntryWarning(
                file,
                message,
                isEq ? 'identical' : 'mismatch-identical',
                'Message',
                message.name,
            )
        }

        this.checkMessageParams(file, message, srcMessage)
        this.compareAttributes(file, message, srcMessage.attributes)
    }

    private convertMessage(
        message: WithSpan<ast.Message>,
        state: AnnotationState,
        isTerm: false,
    ): MessageInfo

    private convertMessage(
        term: WithSpan<ast.Term>,
        state: AnnotationState,
        isTerm: true,
    ): TermInfo

    /**
     * Converts a message or term into an information object.
     */
    private convertMessage(
        entry: WithSpan<ast.Term | ast.Message>,
        state: AnnotationState,
        isTerm: boolean,
    ): TermInfo | MessageInfo {
        const span = entry.id.span as ISpan
        const ignore = new Set(state.ignore) // shared among a message and its attributes

        const name = isTerm ? `-${entry.id.name}` : entry.id.name
        const info: MessageInfo | TermInfo = {
            isTerm: isTerm as false,
            id: entry.id.name,
            name,
            idSpan: {
                start: isTerm ? span.start - 1 : span.start,
                end: span.end,
            },
            ignore,
            translate: state.translate,
            value: entry.value ?? undefined,
            variables: this.collectVariables(entry.value),
            params: {},
            attributes: entry.attributes.reduce((rec, attr) => {
                const attrInfo: AttributeInfo = {
                    id: attr.id.name,
                    name: `${name}.${attr.id.name}`,
                    idSpan: (attr.id as HasSpan).span,
                    translate: state.translate,
                    value: attr.value,
                    params: {},
                    variables: this.collectVariables(attr.value),
                }

                if (rec[attr.id.name]) {
                    this.addEntryWarning(
                        state.file,
                        attrInfo,
                        'duplicate',
                        'attribute',
                        attrInfo.name,
                    )
                }

                rec[attr.id.name] = attrInfo
                return rec
            }, {} as Record<string, AttributeInfo>),
        }

        if (entry.comment) {
            const { comment, annotations } = readAnnots(entry.comment.content)

            this.handleEntryAnnotations(info, annotations)
            if (comment) {
                info.comment = comment
            }
        }

        return info
    }

    /**
     * Gets the display path to use in a message for a file.
     */
    private getDisplayPath(file: FileInfo) {
        return this.useRelativePaths ? file.path.relative : file.path.absolute
    }

    /**
     * Handles annotations on an entry item.
     */
    private handleEntryAnnotations(
        info: MessageInfo | TermInfo,
        annotations: AnnotationItem[],
    ) {
        for (const annot of annotations) {
            switch (annot.name) {
                case '@diagnostic':
                    this.handleDiagnosticAnnotation(info, annot)
                    break

                case '@param':
                case '@param-attribute':
                    this.handleParamAnnotation(info, annot)
                    break

                case '@expect-identical':
                    this.handleTargetedAnnotation(info, annot)
                    break

                case '@translate':
                case '@do-not-translate':
                case '@translate-optional':
                    this.handleTargetedAnnotation(info, annot)
                    break
            }
        }
    }

    /**
     * Handles a `@diagnostic` annotation.
     */
    private handleDiagnosticAnnotation(
        target: MessageInfo | TermInfo | AnnotationState,
        annot: AnnotationItem,
    ) {
        let { value } = annot

        const space = value.indexOf(' ')
        const firstWord = value.slice(0, space !== -1 ? space : undefined)
        const enable = firstWord === 'enable'
        value = value.slice(space + 1).trim()

        if (!enable && firstWord !== 'disable') {
            return
        }

        const sliceEnd = value.indexOf('#')
        value = value.slice(0, sliceEnd !== -1 ? sliceEnd : undefined).trim()

        if (value === '') {
            target.ignoreAll = !enable
        }

        const list = value
            .split(',')
            .map((x) => x.trim())
            .filter((x) => x)

        if (enable) {
            list.forEach((x) => target.ignore.add(x))
        } else {
            list.forEach((x) => target.ignore.delete(x))
        }
    }

    /**
     * Handles a `@param` or `@param-attribute` annotation.
     */
    private handleParamAnnotation(
        info: MessageInfo | TermInfo,
        annot: AnnotationItem,
    ) {
        const { name, value } = annot
        const isAttr = name === '@param-attribute'

        const matches = value.match(isAttr ? REGEXP_PARAM_ATTR : REGEXP_PARAM)
        if (!matches) {
            return
        }

        const shift = isAttr ? 2 : 1
        const attrName = isAttr ? matches[1] : undefined

        const id = matches[shift]
        const required = matches[shift + 1] !== '?'
        const type = matches[shift + 2].trim()
        const comment = matches[shift + 3].trim()

        const param: ParamInfo = {
            id,
            required,
            type: type !== '' ? type : undefined,
            comment: comment !== '' ? comment : undefined,
        }

        if (!attrName) {
            info.params[id] = param
            return
        }

        const attr = info.attributes[attrName]
        if (attr) {
            attr.params[id] = param
        }
    }

    /**
     * Handles annotations in resource comments.
     */
    private handleResourceAnnotations(
        state: AnnotationState,
        annotations: AnnotationItem[],
    ) {
        for (const annot of annotations) {
            switch (annot.name) {
                case '@diagnostic':
                    this.handleDiagnosticAnnotation(state, annot)
                    break

                case '@global':
                    state.global = true
                    break

                case '@bundle':
                    state.bundle = annot.value !== '' ? annot.value : undefined
                    break

                case '@translate':
                    state.translate = TranslateType.Required
                    break

                case '@do-not-translate':
                    state.translate = TranslateType.Disallowed
                    break

                case '@translate-optional':
                    state.translate = TranslateType.Optional
                    break
            }
        }
    }

    /**
     * Handles an annotation on an entry item that can accept an attribute.
     */
    private handleTargetedAnnotation(
        info: MessageInfo | TermInfo,
        annot: AnnotationItem,
    ) {
        let { value: annotValue } = annot

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value: any
        let prop: keyof MessageInfo | TermInfo

        switch (annot.name) {
            case '@expect-identical':
                prop = 'expectIdentical'
                value = true
                break

            case '@translate':
                prop = 'translate'
                value = TranslateType.Required
                break

            case '@do-not-translate':
                prop = 'translate'
                value = TranslateType.Disallowed
                break

            case '@translate-optional':
                prop = 'translate'
                value = TranslateType.Optional
                break

            default:
                throw new Error(`Bad argument: ${annot.name}`)
        }

        const sliceEnd = annotValue.indexOf('#')
        annotValue = annotValue
            .slice(0, sliceEnd !== -1 ? sliceEnd : undefined)
            .trim()

        if (annotValue === '') {
            // @ts-expect-error not an error
            info[prop] = value
            return
        }

        if (annotValue === '*') {
            for (const attr of Object.values(info.attributes)) {
                // @ts-expect-error not an error
                attr[prop] = value
            }

            return
        }

        const attr = info.attributes[annotValue]
        if (attr) {
            // @ts-expect-error not an error
            attr[prop] = value
            return
        }
    }

    /**
     * The first pass of analysis.
     *
     * Parses the file, collects messages and terms,
     * reads resource-level annotations, and checks for syntax errors.
     */
    private async read(file: FileInfo) {
        this.diagnostics.delete(file.path.uri)
        const entries = await this.parse(file)
        if (!entries) {
            return
        }

        const state: AnnotationState = {
            file,
            ignore: new Set(),
            translate: TranslateType.Required,
        }

        for (const entry of entries) {
            switch (entry.type) {
                case 'Term':
                    file.terms.push(this.convertMessage(entry, state, true))
                    break

                case 'Message':
                    file.messages.push(this.convertMessage(entry, state, false))
                    break

                case 'ResourceComment':
                    this.handleResourceAnnotations(
                        state,
                        readAnnots(entry.content).annotations,
                    )

                    break

                case 'Junk':
                    for (const annot of entry.annotations as WithSpan<ast.Annotation>[]) {
                        this.addError(file, annot)
                    }

                    break
            }
        }

        if (state.global) {
            file.bundle = ''
        } else if (state.bundle) {
            file.bundle = state.bundle
        }

        const ignoreUnknownFile =
            state.ignoreAll ||
            state.ignore.has('unknown-file') ||
            state.ignore.has('unknown')

        if (ignoreUnknownFile) {
            file.ignore ??= new Set()
            file.ignore.add('unknown-file')
        }

        // ignore missing-file if translation is optional or disallowed,
        // or if explicitly ignored
        const ignoreMissingFile =
            state.ignoreAll ||
            state.translate !== TranslateType.Required ||
            state.ignore.has('missing-file') ||
            state.ignore.has('missing')

        if (ignoreMissingFile) {
            file.ignore ??= new Set()
            file.ignore.add('missing-file')
        }
    }

    /**
     * Performs initial analysis on a group of files.
     */
    private async readGroup(group: FileGroup) {
        for (const file of group.files.values()) {
            await this.read(file)
        }
    }

    /**
     * Parses a file AST and updates its hash.
     */
    private async parse(
        file: FileInfo,
        content?: string,
    ): Promise<WithSpan<ast.Entry>[] | undefined> {
        const filePath = fileURLToPath(file.path.uri)

        if (content === undefined) {
            try {
                content = (await fs.readFile(filePath)).toString()
            } catch (e: unknown) {
                console.error(`Failed to read file: ${e as Error}`)
                return
            }
        }

        const resource = ast.parse(content, { withSpans: true })

        file.content = content
        file.hash = murmurhash.v3(content)

        return resource.body as WithSpan<ast.Entry>[]
    }

    /**
     * Checks whether a warning type should be ignored.
     */
    private shouldIgnore(code: string, ...ignoreSets: Set<string>[]): boolean {
        ignoreSets.push(this.ignore)

        const cat = getWarningCategory(code)
        for (const set of ignoreSets) {
            if (set.has(code) || set.has(cat)) {
                return true
            }
        }

        return false
    }
}
