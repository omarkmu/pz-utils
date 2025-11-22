/**
 * Helper types and functions for handling plural data.
 */

import { OutputFormat } from '../output-format'

/**
 * Operands for plural rules.
 */
export const OPERANDS = new Set(['n', 'i', 'v', 'w', 'f', 't', 'c', 'e'])

/**
 * Operands for plural rules.
 */
export type PluralOperand = 'n' | 'i' | 'v' | 'w' | 'f' | 't' | 'c' | 'e'

/**
 * Conditions for selection of plural rules.
 */
export type PluralConditions = PluralExpression[][]

/**
 * Associates optional plural rule categories to values.
 */
export interface PluralRuleTable<T> {
    zero?: T
    one?: T
    two?: T
    few?: T
    many?: T
}

/**
 * Pluralization rules that have been processed for output.
 */
export interface PluralRules {
    locales: string[]
    rules: PluralRuleTable<PluralConditions>
}

/**
 * Associates locales to raw JSON plural data.
 */
export interface RawPluralData {
    [locale: string]: {
        ['pluralRule-count-zero']?: string
        ['pluralRule-count-one']?: string
        ['pluralRule-count-two']?: string
        ['pluralRule-count-few']?: string
        ['pluralRule-count-many']?: string
        ['pluralRule-count-other']: string
    }
}

/**
 * Plural data that has been preprocessed.
 */
export interface PluralData extends PluralRuleTable<string> {
    locales: Set<string>
}

/**
 * A single expression in a plural rule.
 */
export interface PluralExpression {
    /**
     * The operand to check.
     */
    op: PluralOperand

    /**
     * A modulus value to apply to the operand.
     */
    mod?: number

    /**
     * Flag for whether the check should be negated.
     */
    neq?: true

    /**
     * A single value to compare the operand with.
     * Mutually exclusive with `values`.
     */
    value?: number

    /**
     * Ranges to compare the operand with.
     * Mutually exclusive with `value`.
     */
    values?: PluralValueRange[]
}

/**
 * A range or set of values in a plural rule.
 */
export interface PluralValueRange {
    /**
     * The start value of the range.
     */
    start: number

    /**
     * The end value of the range.
     *
     * If not given, this is the same as `start`.
     * That is, a range with no stop should be interpreted as a single value.
     */
    stop?: number
}

/**
 * Arguments for extraction of plural data.
 */
export interface ExtractPluralsArgs {
    /**
     * The path to use for the output file.
     */
    output?: string

    /**
     * The format to use for output.
     */
    format?: OutputFormat

    /**
     * The header to include with a newline.
     */
    header?: string | false

    /**
     * The prefix to include directly before the generated statement or expression.
     */
    prefix?: string | false

    /**
     * The trailer to include.
     */
    trailer?: string | false

    /**
     * Flag for whether output should be written with newlines and indentation.
     */
    pretty: boolean

    /**
     * Flag for whether output should be written with a return statement.
     */
    return?: boolean
}

/**
 * Returns a rule string with samples removed.
 */
const removeSamples = (rule?: string): string | undefined => {
    if (!rule) {
        return
    }

    const sampleStart = rule.indexOf('@')
    if (sampleStart == -1) {
        return rule.trim()
    }

    const extracted = rule.slice(0, sampleStart).trim()
    return extracted === '' ? undefined : extracted
}

/**
 * Checks whether a character is a valid operand for a plural rule.
 */
export const isOp = (c: string): c is PluralOperand => OPERANDS.has(c)

/**
 * Preprocesses plural data and groups it by locale.
 */
export const preprocessData = (rawData: RawPluralData): PluralData[] => {
    const result = []
    const processed: Record<string, PluralData> = {}

    for (const [locale, data] of Object.entries(rawData)) {
        // get raw rules (ignore 'other', since it's always the default)
        let zero = data['pluralRule-count-zero']
        let one = data['pluralRule-count-one']
        let two = data['pluralRule-count-two']
        let few = data['pluralRule-count-few']
        let many = data['pluralRule-count-many']

        // only 'other', skip
        if (!zero && !one && !two && !few && !many) {
            continue
        }

        zero = removeSamples(zero)
        one = removeSamples(one)
        two = removeSamples(two)
        few = removeSamples(few)
        many = removeSamples(many)

        // combine locales with identical rules for a smaller result
        const key = [
            zero ?? '',
            one ?? '',
            two ?? '',
            few ?? '',
            many ?? '',
        ].join(',')

        if (!processed[key]) {
            processed[key] = {
                locales: new Set(),
                zero: zero,
                one: one,
                two: two,
                few: few,
                many: many,
            }

            result.push(processed[key])
        }

        processed[key].locales.add(locale)
    }

    return result
}
