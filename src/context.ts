import type { BindingMetadata, SFCDescriptor } from "vue/compiler-sfc";
import type { CompileResultExternalFile, CompilerOptions } from "./types";

// @ts-ignore
import hashId from "hash-sum";

import { FILENAME, ID } from "./constants";
import { getDestPath } from "./options";

export type Context = {
  filename: string;
  id: string;
  destFilename: string;
  options: CompilerOptions;
  features: SFCFeatures;
  addedProps: Array<[key: string, value: string]>;
  addedCodeList: string[];
  externalJsList: CompileResultExternalFile[];
  externalCssList: CompileResultExternalFile[];
  bindingMetadata: BindingMetadata | undefined;
};

export type SFCFeatures = {
  hasStyle?: boolean;
  hasScoped?: boolean;
  hasCSSModules?: boolean;
  hasScriptSetup?: boolean;
  hasTemplate?: boolean;
  hasTS?: boolean;
};

export const resolveFeatures = (descriptor: SFCDescriptor, context: Context) => {
  const { filename, features, addedProps, addedCodeList, id } = context;
  const scriptLang =
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang) || 'js';
  features.hasTS = scriptLang === "ts";
  descriptor.styles.some((style) => {
    if (style.scoped) {
      features.hasScoped = true;
    }
    if (style.module) {
      features.hasCSSModules = true;
    }
    features.hasStyle = true;
    return features.hasScoped && features.hasCSSModules && features.hasStyle;
  });
  addedProps.push(["__file", JSON.stringify(filename)]);
  if (features.hasScoped) {
    addedProps.push(["__scopeId", JSON.stringify(`data-v-${id}`)]);
  }
  if (features.hasCSSModules) {
    addedProps.push(["__cssModules", `cssModules`]);
    addedCodeList.push("const cssModules= {}");
  }
};

export const createContext = (source: string, options?: CompilerOptions): Context => {
  const filename = options?.filename ?? FILENAME;
  const destFilename = getDestPath(options?.filename ?? FILENAME);
  const id = options?.filename ? hashId(options.filename + source) : ID;
  const context: Context = {
    filename,
    id,
    destFilename,
    options: options ?? {},
    features: {},
    addedProps: [],
    addedCodeList: [],
    externalJsList: [],
    externalCssList: [],
    bindingMetadata: undefined,
  };
  return context;
}
