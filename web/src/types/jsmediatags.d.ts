declare module 'jsmediatags' {
  interface PictureTag {
    format: string;
    type: string;
    description: string;
    data: number[];
  }

  interface Tags {
    title?: string;
    artist?: string;
    album?: string;
    track?: string;
    picture?: PictureTag;
  }

  interface TagResult {
    type: string;
    tags: Tags;
  }

  interface ReadCallbacks {
    onSuccess: (result: TagResult) => void;
    onError: (error: { type: string; info: string }) => void;
  }

  interface Reader {
    read(callbacks: ReadCallbacks): void;
  }

  function read(file: File | Blob | string, callbacks: ReadCallbacks): void;

  export { read, Tags, TagResult, PictureTag, ReadCallbacks, Reader };
  export default { read };
}
