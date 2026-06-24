declare module 'epubjs' {
  interface SpineItem {
    href: string;
  }

  interface TocItem {
    label: string;
    href?: string;
    subitems?: TocItem[];
  }

  interface Archive {
    getBlob(path: string): Promise<Blob | null>;
    getText(path: string): Promise<string | null>;
  }

  interface Packaging {
    metadata: {
      title?: string;
      creator?: string;
    };
  }

  interface Navigation {
    toc: TocItem[];
  }

  interface EpubDocument {
    body: HTMLElement;
  }

  interface Book {
    ready: Promise<void>;
    packaging: Packaging;
    navigation: Navigation;
    archive: Archive;
    spine: {
      each(callback: (section: SpineItem) => void): void;
    };
    load(href: string): Promise<EpubDocument>;
    destroy(): void;
  }

  function ePub(data: ArrayBuffer): Book;
  export default ePub;
}
