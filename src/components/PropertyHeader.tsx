/**
 * PropertyHeader — shows property name, WiFi, check-in/out, and house rules.
 * Token values (e.g. {{PROPERTY_NAME}}) are detected and hidden gracefully.
 */
import type { Property } from "@/lib/guide";

/** Returns true when a value is still an unfilled {{TOKEN}} placeholder. */
function isToken(value: string): boolean {
  return /^\{\{[^}]+\}\}$/.test(value.trim());
}

interface PropertyHeaderProps {
  property: Property;
}

export default function PropertyHeader({ property }: PropertyHeaderProps) {
  const displayName =
    !isToken(property.name) ? property.name : "Barrio Logan Guest Concierge";

  const showWifi =
    !isToken(property.wifi.ssid) || !isToken(property.wifi.password);
  const showCheckin = !isToken(property.checkin);
  const showCheckout = !isToken(property.checkout);

  // Filter house rules that are not placeholder tokens
  const houseRules = property.houseRules.filter(
    (r) => r && !isToken(r)
  );

  return (
    <>
      <header className="property-header">
        <div className="property-header__inner">
          <h1 className="property-header__name">{displayName}</h1>
          <p className="property-header__neighborhood">
            {property.neighborhood}
          </p>
          <div className="property-header__details">
            {showWifi && (
              <span className="detail-chip">
                <span className="detail-chip__label">WiFi</span>
                {!isToken(property.wifi.ssid) ? property.wifi.ssid : ""}
                {!isToken(property.wifi.ssid) && !isToken(property.wifi.password) && " · "}
                {!isToken(property.wifi.password) ? property.wifi.password : ""}
              </span>
            )}
            {showCheckin && (
              <span className="detail-chip">
                <span className="detail-chip__label">Check-in</span>
                {property.checkin}
              </span>
            )}
            {showCheckout && (
              <span className="detail-chip">
                <span className="detail-chip__label">Check-out</span>
                {property.checkout}
              </span>
            )}
          </div>
        </div>
      </header>
      {houseRules.length > 0 && (
        <div className="house-rules">
          <div className="container">
            <p className="house-rules__title">House Rules</p>
            <ul className="house-rules__list">
              {houseRules.map((rule, i) => (
                <li key={i} className="house-rules__item">
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
