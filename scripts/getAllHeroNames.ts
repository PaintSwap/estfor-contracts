import * as fs from "fs/promises";
import {sleep} from "./utils";

const filePath = "./export/players.txt";

// Fetch players function
async function fetchPlayers(): Promise<void> {
  // Ensure directory and file exist
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  try {
    await fs.mkdir(dir, {recursive: true});
    await fs.writeFile(filePath, "");
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
      const url = `https://api.estfor.com/players?numToFetch=1000&numToSkip=${skip}`;

      // Make the request
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Parse the JSON response
      const data = await response.json();

      // Check if we have any players in the response
      if (!data.players || data.players.length === 0) {
        console.log(`No more players found after ${skip} entries`);
        break;
      }

      // Extract and save player names
      const playerNames = data.players.map((player: {name: string}) => player.name).join("\n") + "\n";
      await fs.appendFile(filePath, playerNames);

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
  console.log("Starting to fetch players...");
  await fetchPlayers();
  console.log("Finished fetching players");
})();
