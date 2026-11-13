"use client";

import dynamic from "next/dynamic";

// The start page renders only in the browser, straight from the local cache
// (SP-2: paint in under 300 ms, then sync), so there's no server render.
const StartPage = dynamic(() => import("./start-page").then((m) => m.StartPage), { ssr: false });

export function StartPageLoader(props: { userId: string; email: string; admin?: boolean }) {
  return <StartPage {...props} />;
}

