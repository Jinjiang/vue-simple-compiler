import { BindingMetadata } from "vue/compiler-sfc";
import { CompilerOptions } from "./options";
import { TransformResult } from "./transform";

export type SFCFeatures = {
  hasStyle?: boolean;
  hasScoped?: boolean;
  hasCSSModules?: boolean;
  hasScriptSetup?: boolean;
  hasTemplate?: boolean;
  hasTS?: boolean;
};

export type CompileResultFile = {
  filename: string;
} & TransformResult;

export type CompileResultExternalFile = {
  filename: string;
  query: Record<string, string>;
};

export type CompileResult = {
  js: CompileResultFile;
  css: CompileResultFile[];
  externalJs: CompileResultExternalFile[];
  externalCss: CompileResultExternalFile[];
  errors: Error[];
};

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

