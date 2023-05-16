/* eslint-disable no-console */
/* eslint-disable no-param-reassign */

import type { SFCBlock } from 'vue/compiler-sfc';
import type { RawSourceMap } from 'source-map';

import fs from 'fs';
import path from 'path';
import { SourceMapConsumer } from 'source-map';
import { Context } from './types';

export const debugMap = (map: RawSourceMap | undefined) => {
  if (!map) {
    console.log('-----------------');
    console.log('No map');
    console.log('-----------------');
    return;
  }
  const info = new SourceMapConsumer(map);
  console.log('-----------------');
  console.log((info as any)._file);
  console.log('-----------------');
  console.log((info as any)._sourceRoot);
  console.log('-----------------');
  console.log((info as any)._sources);
  console.log('-----------------');
  console.log((info as any)._mappings);
  console.log('-----------------');
};

export const debugBlock = ({ content, map }: SFCBlock) => {
  const info = new SourceMapConsumer(map!);
  console.log('-----------------');
  console.log(content);
  console.log('-----------------');
  console.log((info as any).sourcesContent[0]);
  console.log('-----------------');
  console.log((info as any)._mappings);
  console.log('-----------------');
};

export const writeMap = (
  map: RawSourceMap,
  context: Context,
  sourceContent: string,
  generatedContent: string
) => {
  // write source file, generated file and source map file into ./temp
  const baseDir = './temp';
  map.sources = [context.filename];
  map.file = context.destFilename;
  map.sourceRoot = '';
  delete map.sourcesContent;
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, context.filename), sourceContent);
  fs.writeFileSync(path.join(baseDir, context.destFilename), generatedContent);
  fs.writeFileSync(
    path.join(baseDir, `${context.destFilename}.map`),
    JSON.stringify(map)
  );
};
