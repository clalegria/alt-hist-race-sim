import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShareCardsPreview } from "../../components/ShareCardsPreview.js";

/**
 * `/dev/share-cards` — the four share cards drawn from the open run, for
 * looking at while they are built. Dev builds only; the preview dialog
 * replaces it (`docs/design/share-image.md`, step 3).
 */
export const Route = createFileRoute("/dev/share-cards")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: ShareCardsPreview,
});
