/**
 * Home page — minimal placeholder that compiles cleanly.
 * The frontend agent will replace this with the real guide + chat UI.
 */
import type { Guide } from "@/lib/guide";
import guideData from "@/data/guide.json";

const guide = guideData as Guide;

export default function Home() {
  return (
    <main style={{ padding: "2rem", maxWidth: "640px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        {guide.property.name !== "{{PROPERTY_NAME}}"
          ? guide.property.name
          : "Barrio Logan Guest Concierge"}
      </h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        {guide.property.address} &mdash; {guide.property.neighborhood}
      </p>
      <p style={{ color: "#888", fontSize: "0.9rem" }}>
        Placeholder home page. The frontend agent will build the real guide and chat UI here.
      </p>
    </main>
  );
}
