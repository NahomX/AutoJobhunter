/**
 * PlaceCard — displays a single place entry with tier badge, meta, tags,
 * host tip, and a map link.
 */
import type { Place } from "@/lib/guide";

interface PlaceCardProps {
  place: Place;
}

const TIER_LABELS: Record<Place["tier"], string> = {
  walk: "Walk",
  "short-hop": "Short hop",
};

const TIER_EMOJI: Record<Place["tier"], string> = {
  walk: "🚶",
  "short-hop": "🚗",
};

export default function PlaceCard({ place }: PlaceCardProps) {
  return (
    <article className="place-card">
      <div className="place-card__header">
        <h3 className="place-card__name">{place.name}</h3>
        <div className="place-card__badges">
          <span className={`tier-badge tier-badge--${place.tier}`}>
            <span aria-hidden="true">{TIER_EMOJI[place.tier]}</span>
            {TIER_LABELS[place.tier]}
          </span>
        </div>
      </div>

      <p className="place-card__blurb">{place.blurb}</p>

      <div className="place-card__meta">
        <span className="place-card__meta-item">
          <span className="place-card__meta-icon" aria-hidden="true">
            {place.tier === "walk" ? "🚶" : "🚗"}
          </span>
          {place.distanceText}
        </span>
        {place.hours && (
          <span className="place-card__meta-item">
            <span className="place-card__meta-icon" aria-hidden="true">
              🕐
            </span>
            {place.hours}
          </span>
        )}
      </div>

      {place.tags.length > 0 && (
        <div className="place-card__tags" aria-label="Tags">
          {place.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {place.hostTip && (
        <div className="place-card__host-tip">
          <span className="place-card__host-tip-label">Host tip:</span>
          {place.hostTip}
        </div>
      )}

      <div className="place-card__footer">
        <span className="price-level" aria-label={`Price level: ${place.priceLevel}`}>
          {place.priceLevel}
        </span>
        <a
          href={place.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="map-link"
          aria-label={`Open ${place.name} in Google Maps`}
        >
          <span aria-hidden="true">📍</span> Map
        </a>
      </div>
    </article>
  );
}
