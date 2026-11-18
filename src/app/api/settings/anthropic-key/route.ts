import { body, handle, schemas } from "@/server/api";
import { anthropicKeyStatus, removeAnthropicKey, saveAnthropicKey } from "@/server/user-ai-key";

// The user's own Anthropic API key for the widget builder. The key itself is
// never returned: only whether there is one and its last 4 characters.
export function GET(request: Request) {
  return handle(request, ({ userId }) => anthropicKeyStatus(userId));
}

export function PUT(request: Request) {
  return handle(request, async ({ userId }) => saveAnthropicKey(userId, (await body(request, schemas.anthropicKey)).key));
}

export function DELETE(request: Request) {
  return handle(request, ({ userId }) => removeAnthropicKey(userId));
}
