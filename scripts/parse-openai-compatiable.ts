import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "node:url";
import "load-env";
import logger from "logger";
import { openaiCompatibleModelsSafeParse } from "lib/ai/create-openai-compatiable";

const ROOT = process.cwd();
const FILE_NAME = "openai-compatible.config.ts";
const CONFIG_PATH = pathToFileURL(path.join(ROOT, FILE_NAME)).href;

async function load() {
  try {
    const config = await import(CONFIG_PATH).then((m) => m.default);
    return openaiCompatibleModelsSafeParse(config);
  } catch (error) {
    logger.error(error);
    return [];
  }
}

/**
 * Reads a .env file, modifies a specific key's value, and writes it back.
 *
 * @param {string} envFilePath - The absolute path to the .env file.
 * @param {string} keyToModify - The key of the variable to add or edit (e.g., 'DATA').
 * @param {string} newValue - The new value for the variable.
 * @returns {boolean} - True if successful, false otherwise.
 */
function updateEnvVariable(
  envFilePath: string,
  keyToModify: string,
  newValue: string,
): boolean {
  try {
    let envContent = "";
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, "utf8");
    }

    const envVars: { [key: string]: string } = {};
    const lines = envContent.split("\n");

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("#") || trimmedLine === "") {
        return;
      }

      const parts = trimmedLine.split("=");
      if (parts.length >= 2) {
        const key = parts[0];
        const value = parts.slice(1).join("=");
        envVars[key] = value;
      }
    });

    envVars[keyToModify] = newValue;

    let newEnvContent = "";
    for (const key in envVars) {
      if (Object.prototype.hasOwnProperty.call(envVars, key)) {
        newEnvContent += `${key}=${envVars[key]}\n`;
      }
    }

    newEnvContent = newEnvContent.trim();

    fs.writeFileSync(envFilePath, newEnvContent, "utf8");
    console.log(
      `Successfully updated ${keyToModify} in ${envFilePath} to: \n\n${newValue}\n`,
    );
    return true;
  } catch (error) {
    console.error(`Error updating .env file: ${error}`);
    return false;
  }
}

const rootEnvPath = path.join(ROOT, ".env");
const dockerEnvPath = path.join(ROOT, "docker", ".env");

const openaiCompatibleProviders = await load();

const jsonValue = JSON.stringify(openaiCompatibleProviders);

// Update root .env
const rootSuccess = updateEnvVariable(
  rootEnvPath,
  "OPENAI_COMPATIBLE_DATA",
  jsonValue,
);

// Update docker .env (used by Docker Compose)
const dockerSuccess = updateEnvVariable(
  dockerEnvPath,
  "OPENAI_COMPATIBLE_DATA",
  jsonValue,
);

if (rootSuccess && dockerSuccess) {
  console.log("Operation completed. Updated both .env and docker/.env files!");
  console.log("\nNext steps:");
  console.log("1. Restart the Docker container: docker compose -f docker/compose.yml restart");
  console.log("2. Or rebuild if needed: docker compose -f docker/compose.yml up -d --build");
} else {
  console.log("Operation failed.");
  if (!rootSuccess) console.log("  - Failed to update .env");
  if (!dockerSuccess) console.log("  - Failed to update docker/.env");
}
