import * as fs from "fs/promises";
import {sleep} from "./utils";

export const exportPetNamesFilePath = "./export/pets.txt";

// Fetch pets function
export async function exportAllPetNames(): Promise<void> {
  // Ensure directory and file exist
  const dir = exportPetNamesFilePath.substring(0, exportPetNamesFilePath.lastIndexOf("/"));
  try {
    await fs.mkdir(dir, {recursive: true});
    await fs.writeFile(exportPetNamesFilePath, "");
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
      const url = `https://api.estfor.com/pets?numToFetch=1000&numToSkip=${skip}`;

      // Make the request
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Parse the JSON response
      const data = await response.json();

      // Check if we have any pets in the response
      if (!data.pets || data.pets.length === 0) {
        console.log(`No more pets found after ${skip} entries`);
        break;
      }

      // Extract and save pet names
      const petNames = data.pets.map((pet: {name: string}) => pet.name).join("\n") + "\n";
      await fs.appendFile(exportPetNamesFilePath, petNames);

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
  console.log("Starting to fetch pets...");
  await exportAllPetNames();
  // await petBitPositions();
  console.log("Finished fetching pets");
})();
