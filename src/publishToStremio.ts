import { to } from "await-to-js";
let DEFAULT_API_URL = "https://api.strem.io";
const ADDON_URL = process.env.ADDON_URL;

(async function publishToCentral(addonURL: string, apiURL?: string) {
  if (!ADDON_URL || !ADDON_URL.endsWith("/manifest.json")) {
    console.warn("ADDON_URL not set or not valid, skipping publish to Stremio");
    console.warn(
      "Must point to a valid manifest.json and be publicly accessible"
    );
    process.exit(1);
  }

  console.info("Publishing addon to Stremio with URL:", addonURL);

  apiURL = apiURL ?? DEFAULT_API_URL;

  const [resErr, res] = await to(
    fetch(apiURL + "/api/addonPublish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transportUrl: addonURL, transportName: "http" }),
    })
  );

  if (resErr) {
    console.error("Failed to publish addon to Stremio", resErr);
    process.exit(1);
  }

  if (!res.ok) {
    console.error("Failed to publish addon to Stremio", await res.text());
    process.exit(1);
  }

  const [jsonErr, json] = await to(res.json());
  if (jsonErr) {
    console.error("Failed to parse response from Stremio", jsonErr);
    process.exit(1);
  }

  console.log("Successfully published addon to Stremio:", json);
  process.exit(0);
})(ADDON_URL!);
