/**
 * Helper types and functions for handling datetime data.
 */

import { ExtractArgs } from '../shared.js'

const NNBSP = String.fromCharCode(8239)

export interface DateTimeFormats<T = string> {
    full: T
    long: T
    medium: T
    short: T
}

export interface RawFormatObject {
    _value: string
}

/**
 * Raw JSON datetime format data.
 */
export interface RawDateTimeData {
    dateFormats: DateTimeFormats
    timeFormats: DateTimeFormats
    dateTimeFormats: DateTimeFormats
}

/**
 * Associates locales to raw JSON datetime format data.
 */
export interface GroupedRawDateTimeData {
    [locale: string]: RawDateTimeData
}

/**
 * Datetime data that has been preprocessed.
 */
export interface DateTimeData extends RawDateTimeData {
    locales: Set<string>
}

/**
 * Arguments for extraction of datetime data.
 */
export type ExtractDateTimeArgs = ExtractArgs

/**
 * Gets elements from a datetime format for use in a key for comparison.
 */
const formatKey = (data: DateTimeFormats): string[] => {
    return [
        data.full ?? '',
        data.medium ?? '',
        data.short ?? '',
        data.long ?? '',
    ]
}

/**
 * Sanitizes a format string.
 */
const sanitize = (format: string | RawFormatObject): string => {
    // some formats have metadata
    // not dealing with all that, just grab the value
    if (typeof format === 'object') {
        format = format._value
    }

    // can't handle narrow no-break space
    format = format.replaceAll(NNBSP, ' ')

    return format
}

/**
 * Transforms each format string in a date time formats object.
 */
export const alterFormats = <A, T>(
    transform: (format: string, ...args: A[]) => T,
    formats: DateTimeFormats,
    ...args: A[]
): DateTimeFormats<T> => {
    return {
        full: transform(formats.full, ...args),
        long: transform(formats.long, ...args),
        medium: transform(formats.medium, ...args),
        short: transform(formats.short, ...args),
    }
}

/**
 * Preprocesses datetime data and groups it by locale.
 */
export const preprocessData = (
    rawData: GroupedRawDateTimeData,
): DateTimeData[] => {
    const result = []
    const processed: Record<string, DateTimeData> = {}

    for (const [locale, data] of Object.entries(rawData)) {
        const dateFormats = alterFormats(sanitize, data.dateFormats)
        const timeFormats = alterFormats(sanitize, data.timeFormats)
        const dateTimeFormats = alterFormats(sanitize, data.dateTimeFormats)

        // combine locales with identical rules for a smaller result
        const key = [
            ...formatKey(dateFormats),
            ...formatKey(timeFormats),
            ...formatKey(dateTimeFormats),
        ].join('::')

        if (!processed[key]) {
            processed[key] = {
                locales: new Set(),
                dateFormats,
                timeFormats,
                dateTimeFormats,
            }

            result.push(processed[key])
        }

        const dash = locale.indexOf('-')
        const primary = dash ? locale.slice(0, dash) : undefined

        // don't include locale if content is the same as the primary language subtag
        if (primary && !processed[key].locales.has(primary)) {
            processed[key].locales.add(locale)
        }
    }

    return result
}
