import { parameterSchemas as parameterSchemasV1 } from "./parameterSchemas.v1.js";
import parameterSchemasV2 from "./parameterSchemas.v2.json";
import parameterSchemasV3 from "./parameterSchemas.v3.json";
import parameterSchemasV4 from "./parameterSchemas.v4.json";

export const parameterSchemas = {
  ...parameterSchemasV1,
  ...parameterSchemasV2,
  ...parameterSchemasV3,
  ...parameterSchemasV4,
};
