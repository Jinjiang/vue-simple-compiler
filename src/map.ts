// The version of source-map is v0.6.x since:
// 1. source-map v0.7.x doesn't support sync APIs.
// 2. vue/compiler-sfc also uses source-map v0.6.x.
import { SourceMapConsumer, SourceMapGenerator, RawSourceMap } from "source-map";

export type { RawSourceMap }

export type FileInfo = {
  code: string
  // The "version" inside RawSourceMap is string type rather than number type
  // since it's based on source-map v0.6.x.
  sourceMap?: RawSourceMap | undefined
}

// https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/compileTemplate.ts
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
        line: origPosInOldMap.line ?? 0, // map line
        // use current column, since the oldMap produced by @vue/compiler-sfc
        // does not
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

export const bundleSourceMap = (list: FileInfo[]): FileInfo => {
  // TODO:
  list
  return { code: '' }
}

/**
 * Shift the source map of a single source file.
 * It's used for converting the source map from a code block to the whole file, which has line offset in between.
 */
export const shiftSingleSourceMap = (map: RawSourceMap, newSourceFile: string, offset: number): RawSourceMap => {
  const consumer = new SourceMapConsumer(map)
  const generator = new SourceMapGenerator()

  consumer.eachMapping(m => {
    generator.addMapping({
      generated: {
        line: m.generatedLine,
        column: m.generatedColumn
      },
      original: {
        line: m.originalLine,
        column: m.originalColumn + offset
      },
      source: newSourceFile,
      name: m.name
    })
  })

  // hack the generator
  const gen = generator as any
  gen._sources = {
    toArray() {
      return [newSourceFile]
    }
  }
  gen._sourceRoot = map.sourceRoot
  gen._file = map.file

  return gen.toJSON()
}
