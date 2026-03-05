import { PART_TYPE } from "../enums";

export type TOutputFormat = "text" | "json";

export type TPrintOptions = {
  outputFormat: TOutputFormat;
};

export type TTextPart = {
  type: PART_TYPE.TEXT;
  data: string;
  thoughtSignature?: string;
};
export type TImagePart = {
  type: PART_TYPE.IMAGE;
  /**
   * The s3 key of the image
   */
  data: string;
};

export type TErrorPart = {
  type: PART_TYPE.ERROR;
  data: string;
};

export type TVideoPart = {
  type: PART_TYPE.VIDEO;
  /**
   * The s3 key of the video
   */
  data: string;
};

export type TPart = TTextPart | TImagePart | TErrorPart | TVideoPart;
