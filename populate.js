const fs = require("fs").promises;
const { sql } = require("@vercel/postgres");
require("dotenv").config();

// Environment variable configuration
const DATASET_PATH = "./icons/dataset.json";
const BATCH_SIZE = 250;
const DELAY_MS = 250;

// Verify database connection
async function testDatabaseConnection() {
	try {
		const result = await sql`SELECT NOW();`;
		console.log(
			"✅ Database connection established",
			result.rowCount > 0 && "– ok"
		);
		return true;
	} catch (error) {
		console.error("❌ Error connecting to the database:", error);
		return false;
	}
}

/**
 * Inserts icon data into the database
 * @param {Object} iconData - Icon data to insert
 * @returns {Promise<Object>} - Result of the insertion
 */
async function insertIcon(iconData) {
	try {
		// Verify connection before inserting
		const isConnected = await testDatabaseConnection();
		if (!isConnected) {
			throw new Error("Could not establish a connection to the database");
		}

		// Convert embedding to the required format for vector storage
		const embedding = `[${iconData.embedding}]`;

		// Use sql tagged template for the query
		const result = await sql`
            INSERT INTO icons
            (name, commonnames, description, tags, categories, embedding, library)
            VALUES (
                ${iconData.name},
                ${iconData.commonnames},
                ${iconData.description},
                ${iconData.tags},
                ${iconData.categories},
                ${embedding}::vector,
                ${iconData.library}
            )
        `;

		console.log(`✅ Icon inserted: ${iconData.name}`);
		return { success: true, result };
	} catch (error) {
		console.error("❌ Error inserting icon:", error);
		console.error("Error details:", error.message, error.detail);
		return { success: false, error };
	}
}

/**
 * Batch inserts multiple icons into the database
 * @param {Array} icons - Array of icon data objects
 * @param {number} batchSize - Number of icons to insert in each batch
 * @param {number} delayMs - Delay between batches in milliseconds
 * @returns {Promise<Object>} - Result of the batch insertion
 */
async function batchInsertIcons(icons, batchSize = 250, delayMs = 250) {
	try {
		// Verify connection before starting the batch process
		const isConnected = await testDatabaseConnection();
		if (!isConnected) {
			throw new Error("Could not establish a connection to the database");
		}

		let counter = 0;
		const results = [];
		const totalIcons = icons.length;

		console.log(`🚀 Starting batch insertion of ${totalIcons} icons...`);

		for (let i = 0; i < icons.length; i += batchSize) {
			const batch = icons.slice(i, i + batchSize);
			console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}...`);

			for (const icon of batch) {
				const result = await insertIcon(icon);
				counter++;
				const percentage = ((counter / totalIcons) * 100).toFixed(2);
				console.log(`⏳ Progress: ${counter}/${totalIcons} (${percentage}%)`);
				results.push(result);
			}

			// Delay between batches
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		return { success: true, inserted: counter, results };
	} catch (error) {
		console.error("❌ Error in batch insertion:", error);
		return { success: false, error };
	}
}

/**
 * Reads icon data from a JSON file and inserts it into the database
 * @param {string} filePath - Path to the JSON file containing icon data
 * @param {number} batchSize - Number of icons to insert in each batch
 * @param {number} delayMs - Delay between batches in milliseconds
 * @returns {Promise<Object>} - Result of the operation
 */
async function insertIconsFromFile(filePath, batchSize = 250, delayMs = 250) {
	try {
		console.log("📂 Reading icon file...");
		const data = await fs.readFile(filePath, "utf8");
		const icons = JSON.parse(data);
		console.log(`📊 Found ${icons.length} icons to process`);

		return await batchInsertIcons(icons, batchSize, delayMs);
	} catch (error) {
		console.error("❌ Error reading or processing the file:", error);
		return { success: false, error };
	}
}

// Example usage
if (require.main === module) {
	console.log("🔄 Starting icon insertion process...");
	console.log("🔑 Verifying environment variables...");

	// Verify required environment variables
	const requiredEnvVars = [
		"POSTGRES_URL",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_DATABASE",
	];

	const missingVars = requiredEnvVars.filter(
		(varName) => !process.env[varName]
	);

	if (missingVars.length > 0) {
		console.error(
			"❌ The following environment variables are missing:",
			missingVars.join(", ")
		);
		process.exit(1);
	}

	insertIconsFromFile(DATASET_PATH, BATCH_SIZE, DELAY_MS)
		.then((result) => {
			if (result.success) {
				console.log(`✅ Successfully inserted ${result.inserted} icons`);
			} else {
				console.error("❌ Error inserting icons");
			}
		})
		.catch((error) => {
			console.error("❌ Unexpected error:", error);
		})
		.finally(() => {
			console.log("👋 Process finished");
		});
}

// Export functions for use in other modules
module.exports = {
	insertIcon,
	batchInsertIcons,
	insertIconsFromFile,
};
