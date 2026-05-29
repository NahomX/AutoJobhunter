/**
 * Home page — server component that renders:
 *   1. PropertyHeader (server-rendered, no client state needed)
 *   2. GuideSection (client component, category tab state)
 *   3. ChatSection (client component, useChat streaming)
 */
import type { Guide } from "@/lib/guide";
import guideData from "@/data/guide.json";
import PropertyHeader from "@/components/PropertyHeader";
import GuideSection from "@/components/GuideSection";
import ChatSection from "@/components/ChatSection";

const guide = guideData as Guide;

export default function Home() {
  return (
    <div className="page-wrapper">
      {/* 1. Property info — name, WiFi, check-in/out, house rules */}
      <PropertyHeader property={guide.property} />

      {/* 2. Local guide — category tabs + place cards */}
      <GuideSection categories={guide.categories} />

      {/* 3. AI concierge chat */}
      <ChatSection />
    </div>
  );
}
