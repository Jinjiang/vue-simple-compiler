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

export const getConsumerSources = (consumer: SourceMapConsumer): string[] => {
  // source-map's type definition is incomplete
  const con = consumer as any
  return con.sources
}

export const getGeneratorSources = (generator: SourceMapGenerator): string[] => {
  // source-map's type definition is incomplete
  const gen = generator as any
  return gen._sources.toArray()
}

export const hackGeneratorProps = (generator: SourceMapGenerator, props: Partial<{
  file: string
  sourceRoot: string
  sources: string[]
}>) => {
  // source-map's type definition is incomplete
  const gen = generator as any
  if (props.file) {
    gen._file = props.file
  }
  if (props.sourceRoot) {
    gen._sourceRoot = props.sourceRoot
  }
  if (props.sources) {
    gen._sources = {
      toArray() {
        return props.sources!
      },
      indexOf(source: string) {
        return props.sources!.indexOf(source)
      }
    }
  }
}

const genJSON = (generator: SourceMapGenerator): RawSourceMap => {
  // source-map's type definition is incomplete
  const gen = generator as any
  return gen.toJSON()
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

  const sourceFileSet = new Set<string>(getGeneratorSources(mergedMapGenerator))
  getConsumerSources(oldMapConsumer).forEach(sourceFile => sourceFileSet.add(sourceFile))
  hackGeneratorProps(mergedMapGenerator, {
    file: oldMap.file,
    sourceRoot: oldMap.sourceRoot,
    sources: Array.from(sourceFileSet)
  })
  return genJSON(mergedMapGenerator)
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
  // const gen = generator as any

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
    lineOffset += block.code.split(/\r?\n/).length
  })

  if (firstSourceMap) {
    const sources = Array.from(sourceFileSet)
    hackGeneratorProps(generator, {
      file: firstSourceMap.file,
      sourceRoot: firstSourceMap.sourceRoot,
      sources
    })
  }

  return { code, sourceMap: genJSON(generator) }
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
    const source = (newFileMap || {})[m.source] || m.source
    sourceFileSet.add(source)
    generator.addMapping({
      generated: {
        line: m.generatedLine,
        column: m.generatedColumn
      },
      original: {
        line: m.originalLine + offset,
        column: m.originalColumn
      },
      source,
      name: m.name
    })
  })

  hackGeneratorProps(generator, {
    file: map.file,
    sourceRoot: map.sourceRoot,
    sources: Array.from(sourceFileSet)
  })

  return genJSON(generator)
}
