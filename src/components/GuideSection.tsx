"use client";
/**
 * GuideSection — category tabs + place cards for the local guide.
 * Rendered client-side so tab state lives in React state.
 */
import { useState } from "react";
import type { Category } from "@/lib/guide";
import PlaceCard from "./PlaceCard";

interface GuideSectionProps {
  categories: Category[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  grocery: "🛒",
  food: "🍽",
  beaches: "🏖",
  activities: "🎨",
  transit: "🚇",
};

export default function GuideSection({ categories }: GuideSectionProps) {
  const [activeId, setActiveId] = useState<string>(
    categories[0]?.id ?? "grocery"
  );

  const activeCategory = categories.find((c) => c.id === activeId) ?? categories[0];

  return (
    <section aria-label="Local guide">
      {/* Category tabs */}
      <nav className="category-tabs" aria-label="Guide categories">
        <div className="category-tabs__inner" role="tablist">
          {categories.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={cat.id === activeId}
              aria-controls={`panel-${cat.id}`}
              id={`tab-${cat.id}`}
              className={`category-tab${cat.id === activeId ? " category-tab--active" : ""}`}
              onClick={() => setActiveId(cat.id)}
            >
              <span className="category-tab__emoji" aria-hidden="true">
                {CATEGORY_EMOJI[cat.id] ?? "📍"}
              </span>
              {cat.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Places panel */}
      {activeCategory && (
        <div
          role="tabpanel"
          id={`panel-${activeCategory.id}`}
          aria-labelledby={`tab-${activeCategory.id}`}
          className="places-section"
        >
          <p className="places-section__title">
            {activeCategory.places.length}{" "}
            {activeCategory.places.length === 1 ? "spot" : "spots"}
          </p>
          <div className="places-list">
            {activeCategory.places.map((place) => (
              <PlaceCard key={place.name} place={place} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
