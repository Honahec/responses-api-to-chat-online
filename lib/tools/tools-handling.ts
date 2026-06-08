import { callUserFunction } from "../../config/functions";

export const handleTool = async (toolName: string, parameters: any) => {
  console.log("Handle tool", toolName, parameters);
  return callUserFunction(toolName, parameters);
};
