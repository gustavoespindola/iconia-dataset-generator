const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const sharp = require("sharp");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
require("dotenv").config();

// Variable to specify the icon library folder
const iconLibrary = process.env.ICON_LIBRARY || "default";
const DATASET_PATH = "./icons/dataset.json";
const ICON_SIZE = 128;

// Constants for AI configuration
const AI_CONFIG = {
	generativeModel: {
		model: "gemini-1.5-flash", // gemini-2.0-flash
		generationConfig: {
			maxOutputTokens: 256,
			temperature: 0,
			responseMimeType: "application/json",
		},
	},
	embeddingModel: "text-embedding-004",
};

// Schema for AI response
const ICON_SCHEMA = {
	description: "Icon description",
	type: SchemaType.ARRAY,
	items: {
		type: SchemaType.OBJECT,
		properties: {
			name: {
				type: SchemaType.STRING,
				description: "Name of the icon",
				nullable: false,
			},
			commonnames: {
				type: SchemaType.ARRAY,
				items: { type: SchemaType.STRING },
				description: "Common names for the icon",
				nullable: false,
			},
			description: {
				type: SchemaType.STRING,
				description: "Description of the icon",
				nullable: false,
			},
			tags: {
				type: SchemaType.ARRAY,
				items: { type: SchemaType.STRING },
				description: "Tags associated with the icon",
				nullable: false,
			},
			categories: {
				type: SchemaType.ARRAY,
				items: { type: SchemaType.STRING },
				description: "Categories associated with the icon",
				nullable: false,
			},
		},
		required: ["name", "commonnames", "description", "tags", "categories"],
	},
};

/**
 * Converts an SVG to PNG
 * @param {string} svgContent - SVG content
 * @param {string} outputPath - PNG output path
 * @returns {Promise<string>} - Generated file path
 */
async function generatePNGFromSVG(svgContent, outputPath) {
	try {
		const svgBuffer = Buffer.from(svgContent);
		await sharp(svgBuffer)
			.resize(ICON_SIZE, ICON_SIZE, {
				fit: "contain",
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toFile(outputPath);
		return outputPath;
	} catch (error) {
		console.error("PNG Error:", error);
		throw error;
	}
}

/**
 * Reads or creates the dataset.json file
 * @returns {Promise<Array>} - Dataset data
 */
async function readOrCreateDataset() {
	try {
		if (!fsSync.existsSync(DATASET_PATH)) {
			await fs.writeFile(DATASET_PATH, JSON.stringify([]));
			return [];
		}
		const data = await fs.readFile(DATASET_PATH, "utf8");
		return JSON.parse(data);
	} catch (error) {
		console.error("Error reading dataset:", error);
		return [];
	}
}

/**
 * Saves data to the dataset.json file
 * @param {Array} data - Data to save
 * @returns {Promise<void>}
 */
async function saveDataset(data) {
	try {
		await fs.writeFile(DATASET_PATH, JSON.stringify(data, null, 2));
	} catch (error) {
		console.error("Error writing to dataset:", error);
		throw error;
	}
}

/**
 * Gets the description of an icon using AI
 * @param {string} name - Icon name
 * @param {string} prompt - Prompt for the AI
 * @param {string} imagePath - Image path
 * @returns {Promise<void>}
 */
async function getDescription(name, prompt, imagePath) {
	// Initialize Google API
	const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

	// Read the dataset
	const data = await readOrCreateDataset();

	// Check if the icon already exists
	if (data.some((icon) => icon.name === name)) {
		console.log(`"${name}" already exists`);
		return;
	}

	try {
		// Configure the generative model
		const model = genAI.getGenerativeModel({
			model: AI_CONFIG.generativeModel.model,
			generationConfig: {
				...AI_CONFIG.generativeModel.generationConfig,
				responseSchema: ICON_SCHEMA,
			},
		});

		// Optimize the image
		const imageBuffer = await sharp(imagePath)
			.resize(ICON_SIZE, ICON_SIZE, {
				fit: "contain",
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();

		const imageBase64 = imageBuffer.toString("base64");

		// Generate content with AI
		const completionResponse = await model.generateContent([
			{
				inlineData: {
					data: imageBase64,
					mimeType: "image/png",
				},
			},
			prompt,
		]);

		const completion =
			completionResponse.response.candidates[0].content.parts[0].text;
		const iconObject = JSON.parse(completion)[0];

		// Add the library property
		iconObject.library = iconLibrary;

		console.log(iconObject);

		// Create string for embedding
		const objectString = formatIconForEmbedding(iconObject);
		console.log(objectString);

		// Generate embedding
		const embeddingModel = genAI.getGenerativeModel({
			model: AI_CONFIG.embeddingModel,
		});

		const embeddingResult = await embeddingModel.embedContent(objectString);
		iconObject.embedding = embeddingResult.embedding.values;

		// Save to dataset
		data.push(iconObject);
		await saveDataset(data);
		console.log(`${iconObject.name} has been added to dataset.json`);
	} catch (error) {
		console.error(`Error processing description for "${name}":`, error);
	}
}

/**
 * Formats an icon object for embedding
 * @param {Object} iconObject - Icon object
 * @returns {string} - Formatted string
 */
function formatIconForEmbedding(iconObject) {
	const { name, commonnames, description, tags, categories } = iconObject;
	return `# Icon\nname: **${name}** or ${commonnames.join(
		", "
	)}\t**Description:** ${description}\t**Tags:** ${tags.join(
		", "
	)}\t**Categories:** ${categories.join(", ")}\n`;
}

/**
 * Creates a temporary JSON object for an icon
 * @param {string} name - Icon name
 * @returns {Object} - Temporary JSON object
 */
function createTemporaryIconJson(name) {
	return {
		name,
		commonnames: [name],
		description: "Icon description",
		tags: [],
		categories: [],
		library: iconLibrary,
	};
}

/**
 * Processes icon files
 */
async function processIconFiles() {
	// Path to the icons folder with the specific library
	const iconsPath = path.join(process.cwd(), "icons", iconLibrary);

	try {
		// Check if the folder exists, if not, create it
		if (!fsSync.existsSync(iconsPath)) {
			console.error(`The "icons/${iconLibrary}" folder does not exist`);
			fsSync.mkdirSync(iconsPath, { recursive: true });
			console.log(`Created "icons/${iconLibrary}" folder`);
			return;
		}

		// Get all files
		const files = await fs.readdir(iconsPath);
		const fileMap = processFiles(files, iconsPath);

		// Show pair information
		logFileInfo(fileMap);

		// Process each icon
		await processIcons(fileMap, iconsPath);

		console.log("Done");
	} catch (error) {
		console.error("Error processing icon files:", error);
	}
}

/**
 * Processes files and creates a map
 * @param {Array} files - File list
 * @param {string} iconsPath - Icons path
 * @returns {Map} - File map
 */
function processFiles(files, iconsPath) {
	const fileMap = new Map();

	files.forEach((file) => {
		const extension = path.extname(file);
		const baseName = path.basename(file, extension);

		// Only process SVG and JSON
		if (extension !== ".svg" && extension !== ".json") {
			return;
		}

		if (!fileMap.has(baseName)) {
			fileMap.set(baseName, {
				name: baseName,
				svg: "",
				json: null,
				jsonPath: null,
			});
		}

		const pair = fileMap.get(baseName);

		if (extension === ".svg") {
			pair.svg = fsSync.readFileSync(path.join(iconsPath, file), "utf-8");
		} else if (extension === ".json") {
			pair.jsonPath = path.join(iconsPath, file);
			pair.json = fsSync.readFileSync(pair.jsonPath, "utf-8");
		}
	});

	return fileMap;
}

/**
 * Shows file information
 * @param {Map} fileMap - File map
 */
function logFileInfo(fileMap) {
	// Show complete pairs
	fileMap.forEach((pair, name) => {
		if (pair.svg && pair.json) {
			const iconJson = JSON.parse(pair.json);
			const tags = iconJson.tags.join(", ");
			const categories = iconJson.categories.join(", ");
			console.log(
				`# Icon\n**name:** ${name}\t**Tags:** ${tags}\t**Categories:** ${categories}\n`
			);
		}
	});

	// Show files without a pair
	fileMap.forEach((pair, name) => {
		if (!pair.svg || !pair.json) {
			console.log(
				`⚠️ Warning: The file "${name}" does not have its corresponding pair`
			);
		}
	});
}

/**
 * Processes each icon
 * @param {Map} fileMap - File map
 * @param {string} iconsPath - Icons path
 * @returns {Promise<void>}
 */
async function processIcons(fileMap, iconsPath) {
	for (const [name, pair] of fileMap.entries()) {
		if (!pair.svg) continue;

		const pngOutputPath = path.join(iconsPath, `${name}.png`);
		try {
			await generatePNGFromSVG(pair.svg, pngOutputPath);

			// Check if the corresponding JSON exists, if not, create it
			let iconJson;
			let jsonPath;

			if (!pair.json) {
				console.log(`JSON file for "${name}" does not exist. Creating it...`);
				iconJson = createTemporaryIconJson(name);
				jsonPath = path.join(iconsPath, `${name}.json`);
				await fs.writeFile(jsonPath, JSON.stringify(iconJson, null, 2));
				pair.json = JSON.stringify(iconJson);
				pair.jsonPath = jsonPath;
				console.log(`Created temporary JSON file for "${name}"`);
			} else {
				iconJson = JSON.parse(pair.json);
				jsonPath = pair.jsonPath;
			}

			const prompt = createPrompt(name, iconJson);
			await getDescription(name, prompt, pngOutputPath);
			await delay(1000); // 1 second delay
		} catch (error) {
			console.error(`Error processing icon "${name}":`, error);
		}
	}
}

/**
 * Creates a prompt for the AI
 * @param {string} name - Icon name
 * @param {Object} iconJson - Icon JSON object
 * @returns {string} - Prompt for the AI
 */
function createPrompt(name, iconJson) {
	return `Will be provided with an image of the User Interface icon and a list of tags and categories associated with it.
Your task is to generate a JSON object with the following structure about the icon:
[{
name: string, // provided name of the icon
commonnames: string[], // 3 maximum.
description: string, // describe the icon and its meaning in the user interface.
tags: string[], // add the provided tags and propose new ones if necessary. 5 maximum.
categories: string[], // add the provided categories and propose new ones if necessary. 5 maximum.
}]\n

- All the text must be in English.
- All descriptions must be concise and to the point prevent start with "this icon represents" and go directly to the meaning of the icon.
- Prevent any prose.
\n\n# Icon
Icon name: ${name}, Tags: ${iconJson.tags.join(
		", "
	)}, Categories: ${iconJson.categories.join(", ")}`;
}

/**
 * Delay function
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Execute the process
processIconFiles();
