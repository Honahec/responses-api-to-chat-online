import { callUserFunction } from "../../config/functions";

export const handleTool = async (
  toolName: string,
  parameters: any,
  conversationId: string
) => {
  console.log("Handle tool", toolName, parameters);
  return callUserFunction(toolName, parameters, conversationId);
};
