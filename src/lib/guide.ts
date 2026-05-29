/**
 * Contract A — shared TypeScript types for guide.json.
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH for guide.json shapes.
 * Every agent / module must import from here — no duplicate type definitions.
 *
 * Canonical import path: @/lib/guide
 */

/** WiFi credentials for the property. */
export interface Wifi {
  ssid: string;
  password: string;
}

/** Top-level property metadata. */
export interface Property {
  name: string;
  address: string;
  neighborhood: string;
  wifi: Wifi;
  checkin: string;
  checkout: string;
  houseRules: string[];
}

/** A single place entry within a category. */
export interface Place {
  name: string;
  /** 1-2 sentence guest-facing description. */
  blurb: string;
  /** walk = ≤15 min on foot; short-hop = ≤15 min by drive/transit/bike */
  tier: "walk" | "short-hop";
  /** Human-readable distance/time, e.g. "6 min walk" or "10 min drive" */
  distanceText: string;
  address: string;
  mapUrl: string;
  hours: string;
  priceLevel: "$" | "$$" | "$$$";
  tags: string[];
  hostTip: string;
}

/** A named category containing a list of places. */
export interface Category {
  /** Must be one of the five canonical category IDs. */
  id: "grocery" | "food" | "beaches" | "activities" | "transit";
  label: string;
  places: Place[];
}

/** Root shape of guide.json. */
export interface Guide {
  property: Property;
  categories: Category[];
}
