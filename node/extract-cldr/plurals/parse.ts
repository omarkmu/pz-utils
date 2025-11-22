/**
 * Handles parsing plural rules.
 */

import {
    isOp,
    PluralExpression,
    PluralConditions,
    PluralRules,
    PluralRuleTable,
    RawPluralData,
    preprocessData,
} from './helpers'

interface ParseContext {
    /**
     * The current index in the rule.
     */
    i: number

    /**
     * The rule text.
     */
    rule: string

    /**
     * The current expression being read.
     */
    expr: Partial<PluralExpression>

    /**
     * The current set of conditions joined by "and".
     */
    exprList: PluralExpression[]

    /**
     * The current list of "or" conditions.
     */
    conditions: PluralConditions
}

/**
 * Reads a number from the current position.
 * The index pointer ends on the last digit of the number.
 */
const readNumber = (ctx: ParseContext): number => {
    let j = ctx.i

    const chars: string[] = []
    while (j < ctx.rule.length) {
        const c = ctx.rule[j]
        if (c == ' ') {
            j += 1
            continue
        }

        if (c < '0' || c > '9') {
            break
        }

        chars.push(c)
        j += 1
    }

    if (chars.length === 0) {
        throw new Error(`Expected number in rule ${ctx.rule}`)
    }

    ctx.i = j
    return Number.parseInt(chars.join(''))
}

/**
 * Checks whether an object is empty.
 */
const isEmpty = (obj: object) => Object.keys(obj).length === 0

/**
 * Checks that an expression contains an operand.
 * If it doesn't, an error is thrown.
 */
function assertExpressionValid(
    expr: Partial<PluralExpression>,
    rule: string,
): asserts expr is PluralExpression {
    if (expr.op === undefined) {
        throw new Error(`Expected expression before 'or' in rule ${rule}`)
    }
}

/**
 * Parses a single plural rule string.
 *
 * This cannot handle the deprecated keywords of the rule grammar,
 * which are not found in newer plural data.
 */
export const parseRule = (rule: string): PluralExpression[][] => {
    const ctx: ParseContext = {
        rule,
        i: 0,
        expr: {},
        exprList: [],
        conditions: [],
    }

    while (ctx.i < rule.length) {
        const c = rule[ctx.i]
        if (c == ' ') {
            ctx.i += 1
            continue
        } else if (isOp(c)) {
            ctx.i += 1
            ctx.expr.op = c
            continue
        } else if (c === '%') {
            ctx.i += 1
            ctx.expr.mod = readNumber(ctx)
            continue
        } else if (c === '=') {
            ctx.i += 1
            ctx.expr.value = readNumber(ctx)
            continue
        } else if (c === ',') {
            ctx.i += 1
            ctx.expr.values ??= []

            if (ctx.expr.value !== undefined) {
                ctx.expr.values.push({ start: ctx.expr.value })
                delete ctx.expr.value
            }

            const value = readNumber(ctx)
            ctx.expr.values.push({ start: value })
            continue
        }

        switch (rule.slice(ctx.i, ctx.i + 2)) {
            case '!=':
                ctx.i += 2
                ctx.expr.neq = true
                ctx.expr.value = readNumber(ctx)
                break
            case '..':
                ctx.i += 2
                if (ctx.expr.value !== undefined) {
                    ctx.expr.values ??= []

                    ctx.expr.values.push({
                        start: ctx.expr.value,
                        stop: readNumber(ctx),
                    })

                    delete ctx.expr.value
                } else if (ctx.expr.values) {
                    const range = ctx.expr.values[ctx.expr.values.length - 1]
                    range.stop = readNumber(ctx)
                } else {
                    throw new Error(
                        `Expected digit before range in rule ${rule}`,
                    )
                }

                break
            case 'or':
                assertExpressionValid(ctx.expr, rule)
                ctx.i += 2
                ctx.exprList.push(ctx.expr)
                ctx.conditions.push(ctx.exprList)
                ctx.exprList = []
                ctx.expr = {}
                break
            default:
                if (rule.slice(ctx.i, ctx.i + 3) !== 'and') {
                    throw new Error(`Unexpected character ${c} in rule ${rule}`)
                }

                ctx.i += 3
                assertExpressionValid(ctx.expr, rule)
                ctx.exprList.push(ctx.expr)
                ctx.expr = {}
        }
    }

    if (!isEmpty(ctx.expr)) {
        assertExpressionValid(ctx.expr, rule)
        ctx.exprList.push(ctx.expr)
    }

    if (ctx.exprList.length > 0) {
        ctx.conditions.push(ctx.exprList)
    }

    return ctx.conditions
}

/**
 * Parses raw plural data into a list of plural rules.
 */
export const parseData = (raw: RawPluralData): PluralRules[] => {
    return preprocessData(raw).map((data) => {
        const rules: PluralRuleTable<PluralConditions> = {}

        if (data.zero) {
            rules.zero = parseRule(data.zero)
        }

        if (data.one) {
            rules.one = parseRule(data.one)
        }

        if (data.two) {
            rules.two = parseRule(data.two)
        }

        if (data.few) {
            rules.few = parseRule(data.few)
        }

        if (data.many) {
            rules.many = parseRule(data.many)
        }

        return {
            locales: [...data.locales],
            rules,
        }
    })
}
