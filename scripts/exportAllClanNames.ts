import * as fs from "fs/promises";
import {exportClanNamesFilePath, isBeta, sleep} from "./utils";
import "dotenv/config";

// Fetch clans function
export async function exportAllClanNames(): Promise<void> {
  // Ensure directory and file exist
  const dir = exportClanNamesFilePath.substring(0, exportClanNamesFilePath.lastIndexOf("/"));
  try {
    await fs.mkdir(dir, {recursive: true});
    await fs.writeFile(exportClanNamesFilePath, "");
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  let skip = 0;

  while (true) {
    try {
      console.log(`Processed batch starting at ${skip}`);

      // Construct URL with current skip value
      const apiBaseUrl = isBeta ? process.env.API_BETA_URL : process.env.API_URL;
      const url = `${apiBaseUrl}/clans?numToFetch=1000&numToSkip=${skip}`;

      // Make the request
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Parse the JSON response
      const data = await response.json();

      // Check if we have any clans in the response
      if (!data.clans || data.clans.length === 0) {
        console.log(`No more clans found after ${skip} entries`);
        break;
      }

      // Extract and save clan names
      const clanNames = data.clans.map((clan: {name: string}) => clan.name).join("\n") + "\n";
      await fs.appendFile(exportClanNamesFilePath, clanNames);

      // Increment skip for the next batch
      skip += 1000;

      await sleep(1500);
    } catch (error) {
      console.error(`Error: ${error}`);
      break;
    }
  }
}

// Main function
(async () => {
  console.log("Starting to fetch clans...");
  await exportAllClanNames();
  // await clanBitPositions();
  console.log("Finished fetching clans");
})();
