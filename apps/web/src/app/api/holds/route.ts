/**
 * Source for the generated BFF route `POST /api/holds`.
 *
 * The generator reads the inline `POST` export and emits
 * `webBffHandlers["POST /api/holds"]`; the real handler lives in
 * `src/lib/api-route-handler.ts` so it can forward the `hold_owner` cookie.
 */
import { webBffHandlers } from "@/lib/api-route-handler";

export async function POST(request: Request) {
    return webBffHandlers["POST /api/holds"]({ request });
}
