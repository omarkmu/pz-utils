/**
 * Handles extracting CLDR datetime data to a usable format.
 */

import type { Argv } from 'yargs'
import { transformData } from './transform'
import {
    buildExtractCommand,
    getOutput,
    OutputFormat,
    writeFileOrConsole,
} from '../shared'
import {
    DateTimeFormats,
    ExtractDateTimeArgs,
    GroupedRawDateTimeData,
} from './helpers'

const DEFAULT_HEADER_LUA = `---Data for formatting dates and times.
---This is a generated file; see https://github.com/omarkmu/pz-utils.
---@format disable
`

/**
 * Builds arguments for the `datetime` command.
 */
export const buildDatetimeCommand = (
    yargs: Argv,
): Argv<ExtractDateTimeArgs> => {
    return buildExtractCommand(yargs)
}

/**
 * Extracts datetime data to the specified output format.
 */
export const extractDateTime = async (args: ExtractDateTimeArgs) => {
    const cldrLocales = await import('cldr-core/availableLocales.json')

    const grouped: GroupedRawDateTimeData = {}
    for (const locale of cldrLocales.availableLocales.full) {
        const gregorianPath = `cldr-dates-full/main/${locale}/ca-gregorian`
        const gregorianData = await import(gregorianPath)

        const localeData = gregorianData.default.main[locale]

        const formats = localeData.dates.calendars.gregorian
        grouped[locale] = {
            dateFormats: copyFormats(formats.dateFormats),
            timeFormats: copyFormats(formats.timeFormats),
            dateTimeFormats: copyFormats(formats.dateTimeFormats),
        }
    }

    const format = args.format ?? OutputFormat.LuaFunction
    await writeData(transformData(grouped, format !== OutputFormat.JSON), args)
}

/**
 * Creates a copy of a DateTimeFormats object, containing only the relevant fields.
 */
export const copyFormats = (dt: DateTimeFormats): DateTimeFormats => {
    return {
        full: dt.full,
        long: dt.long,
        medium: dt.medium,
        short: dt.short,
    }
}

/**
 * Writes datetime data to an output file.
 */
export const writeData = async (data: object, args: ExtractDateTimeArgs) => {
    await writeFileOrConsole(
        args.output,
        getOutput(data, args, DEFAULT_HEADER_LUA),
    )
}
