import type { FileInfo, RawSourceMap } from "./map";
import type { FileResolver, CompilerOptions } from "./options";
import type { SFCFeatures, Context } from "./context"

export type { FileInfo, RawSourceMap, FileResolver, CompilerOptions, SFCFeatures, Context }

export type TransformResult = FileInfo

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
