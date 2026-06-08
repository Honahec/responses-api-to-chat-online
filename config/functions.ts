export const callUserFunction = async (
  name: string,
  parameters: any,
  conversationId: string
) => {
  const response = await fetch("/api/user/functions/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parameters, conversationId }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Function call failed");
  }
  return payload.output;
};
