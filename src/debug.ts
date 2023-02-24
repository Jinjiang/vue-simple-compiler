import type { SFCBlock } from "vue/compiler-sfc"

import { SourceMapConsumer } from "source-map"

export const debugBlock = ({ content, map }: SFCBlock) => {
  const info = new SourceMapConsumer(map!)
  console.log('-----------------')
  console.log(content)
  console.log('-----------------')
  console.log((info as any).sourcesContent[0])
  console.log('-----------------')
  console.log((info as any)._mappings)
  console.log('-----------------')
}
