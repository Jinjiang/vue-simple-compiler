import { ensureDirSync, writeFileSync } from 'fs-extra'
import { expect, it } from 'vitest'
import { mount } from "@vue/test-utils";

import { compile } from "../src/compiler";
import { mvp } from "./source";
import { defineComponent } from 'vue';

it('works', async () => {
  const [jsCode, cssCode, destFilename] = compile(mvp);
  ensureDirSync('./test/dist')
  writeFileSync('./test/dist/mvp.vue.js', jsCode)
  writeFileSync('./test/dist/mvp.vue.css', cssCode)
  expect(destFilename).toBe('anonymous.vue.js')
  const modulePath = `./dist/mvp.vue.js`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})
