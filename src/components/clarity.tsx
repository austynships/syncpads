"use client";

import Script from "next/script";
import { ConsentBanner, useConsent, useStopAnalyticsOnDecline } from "./consent";

const CLARITY_PROJECT_ID = "zckmhjuw03";

/**
 * Microsoft Clarity (session recordings and heatmaps), for the PUBLIC pages
 * only: landing, sign-in, sign-up, privacy and terms. It shows the cookie
 * banner and loads Clarity only after the visitor clicks Accept.
 *
 * Never add it to signed-in pages (/app, /agents, /settings, /oauth): those
 * show people's own links, notes and email address. Because Next.js moves
 * between pages without reloading, links from tracked pages into the app must
 * be plain <a> tags (a full page load), so a recording can't follow the user in.
 */
export function Clarity() {
  const [consent] = useConsent();
  useStopAnalyticsOnDecline(consent);

  return (
    <>
      <ConsentBanner />
      {consent === "accepted" && process.env.NODE_ENV === "production" && (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
          window.clarity("consent");`}
        </Script>
      )}
    </>
  );
}
