/** Handles discovery of .ftl files. */

import fs from 'fs-extra'
import path from 'path'
import { pathToFileURL } from 'url'
import {
    createFileRecord,
    FileCollection,
    DiscoveryResult,
    getPathInfo,
} from './helpers'

/**
 * Checks whether a path is within another.
 */
const isPathInside = (childPath: string, parent: string): boolean => {
    const relative = path.relative(parent, childPath)
    if (!relative) {
        return false
    }

    return !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * Attempts to collect .ftl files from locale subdirectories within a top-level directory.
 * Returns nothing if the directory does not match the expected structure.
 */
const getCollection = async (
    curPath: string,
    basePath: string,
): Promise<FileCollection | undefined> => {
    const collection: FileCollection = {
        groups: new Map(),
        path: getPathInfo(curPath, basePath),
    }

    const localeDirs: string[] = []
    const entries = await fs.readdir(curPath, { withFileTypes: true })
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            return
        }

        localeDirs.push(entry.name)
    }

    for (const locale of localeDirs) {
        const dirPath = path.join(curPath, locale)
        const ftlEntries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of ftlEntries) {
            if (!entry.isFile() || !entry.name.toUpperCase().endsWith('.FTL')) {
                return
            }

            const file = createFileRecord(
                path.join(dirPath, entry.name),
                basePath,
            )

            let group = collection.groups.get(locale)
            if (!group) {
                group = {
                    locale: locale,
                    files: new Map(),
                }

                collection.groups.set(locale, group)
            }

            group.files.set(file.path.uri, file)
        }
    }

    return collection
}

/**
 * Discovers .ftl files within the given path.
 */
const discoverInternal = async (
    curPath: string,
    basePath = curPath,
    ctx?: DiscoveryResult,
): Promise<DiscoveryResult> => {
    ctx ??= {
        collections: [],
        ungrouped: {
            locale: '',
            files: new Map(),
        },
        uris: new Set(),
    }

    const subdirs: string[] = []
    const entries = await fs.readdir(curPath, { withFileTypes: true })

    for (const entry of entries) {
        if (entry.isDirectory()) {
            subdirs.push(entry.name)
            continue
        }

        if (!entry.isFile() || !entry.name.toUpperCase().endsWith('.FTL')) {
            continue
        }

        const filePath = path.join(entry.parentPath, entry.name)

        // check if already added to collection
        const uri = pathToFileURL(filePath).toString()
        if (ctx.uris.has(uri)) {
            continue
        }

        // group locale folders into collections
        let collection: FileCollection | undefined
        const grandparent = path.dirname(entry.parentPath)
        if (isPathInside(grandparent, basePath)) {
            collection = await getCollection(grandparent, basePath)
        }

        // not a collection → add to extra files
        if (!collection) {
            ctx.uris.add(uri)
            ctx.ungrouped.files.set(
                uri,
                createFileRecord(filePath, basePath, uri),
            )

            continue
        }

        // add collection files to URI set
        for (const group of collection.groups.values()) {
            for (const uri of group.files.keys()) {
                ctx.uris.add(uri)
            }
        }

        ctx.collections.push(collection)
    }

    for (const dir of subdirs) {
        if (dir.startsWith('.')) {
            continue
        }

        await discoverInternal(path.join(curPath, dir), basePath, ctx)
    }

    return ctx
}

/**
 * Discovers .ftl files within the given path.
 */
export const discover = (basePath: string) => discoverInternal(basePath)
