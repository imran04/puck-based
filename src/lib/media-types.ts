export type MediaAsset = {
  id: string;
  originalFileName: string;
  storedFileName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  hashSha256?: string | null;
  altText?: string | null;
  caption?: string | null;
  tags: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type ListMediaResponse = {
  assets: MediaAsset[];
  total: number;
  limit: number;
  offset: number;
};

export type UploadMediaResponse = {
  assets: MediaAsset[];
};

export type UpdateMediaAssetPayload = {
  altText?: string | null;
  caption?: string | null;
  tags?: string[] | null;
};
