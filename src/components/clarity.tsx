import Script from "next/script";

const CLARITY_PROJECT_ID = "zckmhjuw03";

/**
 * Microsoft Clarity (session recordings and heatmaps), for the PUBLIC pages
 * only: the landing page, sign-in and sign-up.
 *
 * Never add it to signed-in pages (/app, /agents, /settings, /oauth): those
 * show people's own links, notes and email address. Because Next.js moves
 * between pages without reloading, links from tracked pages into the app must
 * be plain <a> tags (a full page load), so a recording can't follow the user in.
 */
export function Clarity() {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
    </Script>
  );
}
