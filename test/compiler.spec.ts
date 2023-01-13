import { it } from 'vitest'
import { compile } from "../src/compiler";
import { imports as source } from "./source";

it('works', () => {
  const [jsCode, cssCode, destFilename] = compile(source);
  console.log(jsCode);
  console.log(cssCode);
  console.log(destFilename);
  console.log('a.jsx'.replace(/\.(j|t)sx?$/, '.js'))
})
