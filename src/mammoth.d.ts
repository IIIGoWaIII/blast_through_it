declare module 'mammoth' {
  interface Options {
    arrayBuffer: ArrayBuffer;
  }

  interface Result {
    value: string;
  }

  export function extractRawText(options: Options): Promise<Result>;
}
