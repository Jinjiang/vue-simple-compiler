import { join } from 'path'
import { ensureDirSync, writeFileSync, rmSync, existsSync } from "fs-extra";
import { beforeEach, expect, it } from "vitest";
import { defineComponent } from "vue";
import { render } from '@testing-library/vue'

import { compile } from "../src/compiler";
import { mvp, imports, nonCss, scoped, cssModules, setup, ts } from "./fixtures";

// TODO:
// features
// - options: custom resolver
// - multiple style blocks
// - multiple script blocks
// complexity
// - import vue files without extension name
// - import js/css files with the same name

const testDistDir = './test/dist'

beforeEach(() => {
  document.body.innerHTML = '';
})

it('works', async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(mvp);
  expect(destFilename).toBe('anonymous.vue.js')
  expect(css.length).toBe(1);
  expect(css[0].filename).toBe("anonymous.vue.css");
  expect(css[0].content).toBeTruthy();
  const dir = join(testDistDir, 'mvp')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true })
  }
  ensureDirSync(dir)
  writeFileSync(modulePath, jsCode)
  writeFileSync(join(dir, css[0].filename), css[0].content)
  const HelloWorld = (await import(modulePath)).default
  const result = render(defineComponent(HelloWorld))
  expect(result.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
});

it("works without <style>", async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(nonCss);
  expect(destFilename).toBe("anonymous.vue.js");
  expect(css.length).toBe(0);
  const dir = join(testDistDir, 'non-css')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  ensureDirSync(dir);
  writeFileSync(modulePath, jsCode);
  const HelloWorld = (await import(modulePath)).default;
  const wrapper = render(defineComponent(HelloWorld));
  expect(wrapper.html().trim().replace(/\n/g, "")).toBe(
    "<h1>Hello World!</h1><input>"
  );
});

it("works with custom filename", async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(mvp, { filename: "custom.vue" });
  expect(destFilename).toBe("custom.vue.js");
  expect(css.length).toBe(1);
  expect(css[0].filename).toBe("custom.vue.css");
  expect(css[0].content).toBeTruthy();
  const dir = join(testDistDir, 'custom-filename')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  ensureDirSync(dir);
  writeFileSync(modulePath, jsCode);
  writeFileSync(join(dir, css[0].filename), css[0].content);
  const HelloWorld = (await import(modulePath)).default;
  const wrapper = render(defineComponent(HelloWorld));
  expect(wrapper.html().trim().replace(/\n/g, "")).toBe(
    "<h1>Hello World!</h1><input>"
  );
});

it('works with <script setup>', async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(setup, { filename: "setup.vue" });
  expect(destFilename).toBe('setup.vue.js')
  expect(css.length).toBe(1);
  expect(css[0].filename).toBe("setup.vue.css");
  expect(css[0].content).toBeTruthy();
  const dir = join(testDistDir, 'setup')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true })
  }
  ensureDirSync(dir)
  writeFileSync(modulePath, jsCode)
  writeFileSync(join(dir, css[0].filename), css[0].content)
  const HelloWorld = (await import(modulePath)).default
  const result = render(defineComponent(HelloWorld))
  expect(result.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
});

it('works with typescript', async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(ts, { filename: "ts.vue" });
  expect(destFilename).toBe('ts.vue.js')
  expect(css.length).toBe(0);
  const dir = join(testDistDir, 'ts')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true })
  }
  ensureDirSync(dir)
  writeFileSync(modulePath, jsCode)
  const HelloWorld = (await import(modulePath)).default
  const result = render(defineComponent(HelloWorld))
  expect(result.html().trim().replace(/\n/g, '')).toBe('<h1>Hello from Component A!</h1>')
})

it("works with importing other vue files", async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(mvp, { filename: "foo.vue" });
  const {
    js: { filename: destFilename2, content: jsCode2 },
    css: css2,
  } = compile(imports, { filename: "bar.vue" });
  expect(destFilename).toBe("foo.vue.js");
  expect(destFilename2).toBe("bar.vue.js");
  expect(css.length).toBe(1);
  expect(css2.length).toBe(1);
  expect(css[0].content).toBeTruthy();
  expect(css2[0].content).toBeTruthy();
  const dir = join(testDistDir, 'imports')
  const modulePath = join(dir, destFilename)
  const modulePath2 = join(dir, destFilename2)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  ensureDirSync(dir);
  writeFileSync(modulePath, jsCode);
  writeFileSync(join(dir, css[0].filename), css[0].content);
  writeFileSync(modulePath2, jsCode2);
  writeFileSync(join(dir, css2[0].filename), css2[0].content);
  const Bar = (await import(modulePath2)).default;
  const wrapper = render(defineComponent(Bar));
  expect(wrapper.html().trim().replace(/\n/g, "")).toBe(
    "1<h1>Hello World!</h1><input>2"
  );
});

it("works with auto-import css", async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(mvp, { filename: "foo.vue", autoImportCss: true });
  expect(destFilename).toBe("foo.vue.js");
  expect(css.length).toBe(1);
  expect(css[0].content).toBeTruthy();
  expect(jsCode.includes(`import './foo.vue.css'`)).toBe(true);
  const dir = join(testDistDir, 'auto-import-css')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  ensureDirSync(dir);
  writeFileSync(modulePath, jsCode);
  writeFileSync(join(dir, css[0].filename), css[0].content);
  const HelloWorld = (await import(modulePath)).default;
  const wrapper = render(defineComponent(HelloWorld));
  expect(wrapper.html().trim().replace(/\n/g, "")).toBe(
    "<h1>Hello World!</h1><input>"
  );
});

it("works with auto-import css without <style>", async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(nonCss, { filename: "foo.vue", autoImportCss: true });
  expect(destFilename).toBe("foo.vue.js");
  expect(css.length).toBe(0);
  expect(jsCode.includes(`import './foo.vue.css'`)).toBe(false);
  const dir = join(testDistDir, 'auto-import-non-css')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  ensureDirSync(dir);
  writeFileSync(modulePath, jsCode);
  const HelloWorld = (await import(modulePath)).default;
  const wrapper = render(defineComponent(HelloWorld));
  expect(wrapper.html().trim().replace(/\n/g, "")).toBe(
    "<h1>Hello World!</h1><input>"
  );
});

it("works with scoped CSS", async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(scoped, { filename: "scoped.vue" });
  expect(destFilename).toBe("scoped.vue.js");
  expect(css.length).toBe(1);
  expect(css[0].content).toBeTruthy();
  expect(css[0].filename).toBe("scoped.vue.css");
  const dir = join(testDistDir, 'scoped')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  ensureDirSync(dir);
  writeFileSync(modulePath, jsCode);
  writeFileSync(join(dir, css[0].filename), css[0].content);
  const HelloWorld = (await import(modulePath)).default;
  const wrapper = await render(defineComponent(HelloWorld));
  const rootElement = wrapper.baseElement.firstElementChild!;
  expect(rootElement.childElementCount).toEqual(2);
  expect(rootElement.children[0].tagName).toEqual("H1");
  expect(rootElement.children[0].className).toEqual("title");
  expect(rootElement.children[0].textContent).toEqual("Hello World!");
  expect(rootElement.children[0].attributes.item(1)!.name).toMatch(
    /^data\-v\-/
  );
  expect(rootElement.children[1].tagName).toEqual("INPUT");
  expect(rootElement.children[1].attributes.item(0)!.name).toEqual(
    rootElement.children[0].attributes.item(1)!.name
  );
  expect(css[0].content).toMatch(
    rootElement.children[0].attributes.item(1)!.name
  );
});

it("works with CSS Modules", async () => {
  const {
    js: { filename: destFilename, content: jsCode },
    css,
  } = compile(cssModules, { filename: "css.modules.vue", autoImportCss: true });
  expect(destFilename).toBe("css.modules.vue.js");
  expect(css.length).toBe(1);
  expect(css[0].content).toBeTruthy();
  expect(css[0].filename).toBe("css.modules.vue.0.module.css");
  const dir = join(testDistDir, 'css-modules')
  const modulePath = join(dir, destFilename)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  ensureDirSync(dir);
  writeFileSync(modulePath, jsCode);
  writeFileSync(join(dir, css[0].filename), css[0].content);
  const HelloWorld = (await import(modulePath)).default;
  expect(HelloWorld).toHaveProperty("__cssModules");
  const wrapper = await render(defineComponent(HelloWorld));
  const rootElement = wrapper.baseElement.firstElementChild!;
  expect(rootElement.childElementCount).toEqual(2);
  // console.log(wrapper.html())
  // TODO: test without auto-import-css
});
