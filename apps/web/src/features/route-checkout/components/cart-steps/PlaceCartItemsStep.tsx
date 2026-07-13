import { IoTrashOutline } from "react-icons/io5";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { localizePlaceCategoryLabel, useUiText } from "@/lib/uiText";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";

type PlaceCartItemsStepProps = {
  savedPlaces: SavedPlaceItem[];
  onSelectPlace: (place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
};

function PlaceCartItemsStep({
  savedPlaces,
  onSelectPlace,
  onRemovePlace,
}: PlaceCartItemsStepProps) {
  const text = useUiText();

  if (savedPlaces.length === 0) {
    return (
      <div className="mt-12">
        <PotatoLoadingCard
          title={text.cart.emptyTitle}
          description={text.cart.emptyDescription}
          footerText={text.cart.emptyFooter}
          animation="empty"
          compact
          className="shadow-sm"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {savedPlaces.map((item) => {
        const thumbnailUrl = item.thumbnailUrl || item.place.images[0] || "";
        const contentTypeLabel = localizePlaceCategoryLabel(
          item.place.contentTypeLabel,
          text
        );
        const categoryName = localizePlaceCategoryLabel(
          item.place.categoryName,
          text
        );

        return (
          <div
            key={item.id}
            className="flex items-center rounded-2xl border border-brand-200 bg-white px-3 py-3 shadow-sm"
          >
            <button
              type="button"
              onClick={() => onSelectPlace(item.place)}
              className="flex min-w-0 flex-1 items-center text-left"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-brand-100 bg-brand-50">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={text.cart.thumbnailAlt(item.place.title)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg">
                    {item.place.icon}
                  </div>
                )}
              </div>
              <div className="ml-3 min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {item.place.title}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {contentTypeLabel} · {categoryName}
                </p>
              </div>
            </button>
            <div className="ml-2 shrink-0">
              <button
                type="button"
                aria-label={text.cart.removeAria(item.place.title)}
                onClick={() => onRemovePlace(item.id)}
                className="rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-600"
              >
                <IoTrashOutline />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PlaceCartItemsStep;
