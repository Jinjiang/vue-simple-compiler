// The version of source-map is v0.6.x since:
// 1. source-map v0.7.x doesn't support sync APIs.
// 2. vue/compiler-sfc also uses source-map v0.6.x.
import type { RawSourceMap } from "source-map";

import { SourceMapConsumer, SourceMapGenerator } from "source-map";

export type { RawSourceMap }

export type FileInfo = {
  code: string
  // The "version" inside RawSourceMap is string type rather than number type
  // since it's based on source-map v0.6.x.
  sourceMap?: RawSourceMap | undefined
}

/**
 * Chain source maps of two code blocks.
 * credit: https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/compileTemplate.ts
 */
export const chainSourceMap = (oldMap: RawSourceMap | undefined, newMap: RawSourceMap | undefined): RawSourceMap | undefined => {
  if (!oldMap) return newMap
  if (!newMap) return oldMap

  const oldMapConsumer = new SourceMapConsumer(oldMap)
  const newMapConsumer = new SourceMapConsumer(newMap)
  const mergedMapGenerator = new SourceMapGenerator()

  newMapConsumer.eachMapping(m => {
    if (m.originalLine == null) {
      return
    }

    const origPosInOldMap = oldMapConsumer.originalPositionFor({
      line: m.originalLine,
      column: m.originalColumn
    })

    if (origPosInOldMap.source == null) {
      return
    }

    mergedMapGenerator.addMapping({
      generated: {
        line: m.generatedLine,
        column: m.generatedColumn
      },
      original: {
        line: origPosInOldMap.line ?? 0,
        column: m.originalColumn
      },
      source: origPosInOldMap.source,
      name: origPosInOldMap.name ?? ''
    })
  })

  // source-map's type definition is incomplete
  const gen = mergedMapGenerator as any
  ;(oldMapConsumer as any).sources.forEach((sourceFile: string) => {
    gen._sources.add(sourceFile)
    const sourceContent = oldMapConsumer.sourceContentFor(sourceFile)
    if (sourceContent != null) {
      mergedMapGenerator.setSourceContent(sourceFile, sourceContent)
    }
  })

  gen._sourceRoot = oldMap.sourceRoot
  gen._file = oldMap.file

  return gen.toJSON()
}

/**
 * Bundle source maps of multiple code blocks into one.
 * - assume source roots of all the blocks are the same
 * - pick the generated file name from the first block
 */
export const bundleSourceMap = (list: FileInfo[]): FileInfo => {
  if (list.length === 1) {
    return list[0]
  }

  let code = ''
  let lineOffset = 0
  const generator = new SourceMapGenerator()

  // for hack the source map
  let firstSourceMap: RawSourceMap | undefined
  const sourceFileSet = new Set<string>()
  const gen = generator as any

  list.forEach(block => {
    code += block.code + '\n'
    if (block.sourceMap) {
      firstSourceMap = firstSourceMap || block.sourceMap
      block.sourceMap.sources.forEach(sourceFile => sourceFileSet.add(sourceFile))
      const consumer = new SourceMapConsumer(block.sourceMap)
      consumer.eachMapping(m => {
        generator.addMapping({
          generated: {
            line: m.generatedLine + lineOffset,
            column: m.generatedColumn
          },
          original: {
            line: m.originalLine,
            column: m.originalColumn
          },
          source: m.source,
          name: m.name
        })
      })
    }
    lineOffset += block.code.split(/\r?\n/).length + 1
  })

  // hack the generator
  if (firstSourceMap) {
    const sources = Array.from(sourceFileSet)
    gen._sourceRoot = firstSourceMap.sourceRoot || ''
    gen._file = firstSourceMap.file
    gen._sources = {
      toArray() {
        return sources
      },
      indexOf(source: string) {
        return sources.indexOf(source)
      }
    }
  }

  return { code, sourceMap: gen.toJSON() }
}

/**
 * Shift the source map of a single source file.
 * It's used for adjusting the source map when you generate it from a block of the whole file, which causes line offset.
 */
export const shiftSourceMap = (map: RawSourceMap, offset: number, newFileMap?: Record<string, string>): RawSourceMap => {
  const consumer = new SourceMapConsumer(map)
  const generator = new SourceMapGenerator()
  const sourceFileSet = new Set<string>()

  consumer.eachMapping(m => {
    const source = newFileMap![m.source] || m.source
    sourceFileSet.add(source)
    generator.addMapping({
      generated: {
        line: m.generatedLine,
        column: m.generatedColumn
      },
      original: {
        line: m.originalLine,
        column: m.originalColumn + offset
      },
      source,
      name: m.name
    })
  })

  // hack the generator
  const gen = generator as any
  const sourceFiles = Array.from(sourceFileSet)
  gen._sources = {
    toArray() {
      return sourceFiles
    },
    indexOf(source: string) {
      return sourceFiles.indexOf(source)
    }
  }
  gen._sourceRoot = map.sourceRoot
  gen._file = map.file

  return gen.toJSON()
}
