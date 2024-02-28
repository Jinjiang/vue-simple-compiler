import type { FileInfo, RawSourceMap } from './map';
import type { FileResolver, CompilerOptions } from './options';
import type { SFCFeatures, Context } from './context';
import type { TsTransform } from './transform';

export type {
  FileInfo,
  RawSourceMap,
  FileResolver,
  CompilerOptions,
  SFCFeatures,
  Context,
  TsTransform,
};

export type TransformResult = FileInfo;

export type CompileResultFile = {
  filename: string;
} & TransformResult;

export type CssFileParams = {
  lang?: string;
  scoped?: string;
  module?: string;
};

export type CompileResultCssFile = CompileResultFile & CssFileParams;

export type CompileResultExternalFile = {
  filename: string;
  query: Record<string, string>;
};

export type CompileResultExternalCssFile = CompileResultExternalFile & CssFileParams;

export type CompileResult = {
  js: CompileResultFile;
  css: CompileResultCssFile[];
  externalJs: CompileResultExternalFile[];
  externalCss: CompileResultExternalCssFile[];
  errors: Error[];
};
