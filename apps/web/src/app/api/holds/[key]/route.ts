/**
 * Source for the generated BFF route `DELETE /api/holds/$key`.
 *
 * The generator maps `[key]` to `$key` and emits
 * `webBffHandlers["DELETE /api/holds/$key"]`; the generated Start handler
 * supplies `params.key` to the real handler in `api-route-handler.ts`.
 */
import { webBffHandlers } from "@/lib/api-route-handler";

export async function DELETE(request: Request) {
    return webBffHandlers["DELETE /api/holds/$key"]({ request });
}
