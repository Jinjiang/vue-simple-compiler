// The version of source-map is v0.6.x since:
// 1. source-map v0.7.x doesn't support sync APIs.
// 2. vue/compiler-sfc also uses source-map v0.6.x.
import type { RawSourceMap } from "source-map";
import type { BindingMetadata } from "vue/compiler-sfc";

export type { RawSourceMap }

export type FileInfo = {
  code: string
  // The "version" inside RawSourceMap is string type rather than number type
  // since it's based on source-map v0.6.x.
  sourceMap?: RawSourceMap | undefined
}

export type TransformResult = FileInfo

export type FileResolver = (filename: string) => string;

export type CompilerOptions = {
  filename?: string;
  resolver?: FileResolver;
  autoImportCss?: boolean;
  autoResolveImports?: boolean;
  isProd?: boolean;
};

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

