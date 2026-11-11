"use client";

import dynamic from "next/dynamic";

// The panel restores the chat from localStorage, so it only renders in the browser.
export const RappiAgentPanel = dynamic(() => import("./rappi-agent-panel"), { ssr: false });
