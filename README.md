# Dataset Generator for Icon Libraries

A Node.js application that uses Google's Generative AI to automatically generate comprehensive metadata for SVG icons. This tool processes SVG icons and creates a rich dataset with descriptions, tags, categories, and vector embeddings that can be used for semantic search.

[Build Your Own AI-Powered Icon Search Engine](https://medium.com/p/a3400015324b/edit)

## Features

- **Automatic Metadata Generation**: Uses Google's Gemini AI to analyze icons and generate descriptive metadata
- **Vector Embeddings**: Creates embeddings for each icon to enable semantic search functionality
- **PNG Conversion**: Automatically converts SVG icons to PNG format for preview purposes
- **Flexible Library Structure**: Organize icons into different libraries with a configurable structure

## Prerequisites

- Node.js (v18 or higher recommended)
- A Google AI API key for using Gemini models
- SVG icons that you want to process

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/gustavoespindola/iconia-dataset-generator.git
   cd dataset-generator
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   pnpm install
   ```

3. Create a `.env` file based on the example:

   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and add your Google API key and specify your icon library name:
   ```
   GOOGLE_API_KEY="your-google-api-key-here"
   ICON_LIBRARY="your-icon-library-name"
   ```

## Usage

1. Place your SVG icons in the `icons/your-icon-library-name/` directory
2. Run the script:
   ```bash
   node index.js
   ```

The script will:

1. Process all SVG files in the specified directory
2. Generate PNG versions for each SVG file
3. Use AI to create metadata including names, common alternative names, descriptions, tags, and categories
4. Generate vector embeddings for semantic search
5. Save all metadata to a `dataset.json` file in the icons directory

## Output Structure

For each icon processed, the following files will be created or updated:

- `icons/your-library/icon-name.svg` - Original SVG file
- `icons/your-library/icon-name.png` - Generated PNG version
- `icons/your-library/icon-name.json` - Individual JSON metadata file (optional)
- `icons/dataset.json` - Complete dataset containing metadata for all icons

Each icon entry in the dataset contains:

- `name`: Primary name of the icon
- `commonnames`: Alternative/common names for the icon
- `description`: Detailed description of what the icon represents
- `tags`: Relevant tags for searching
- `categories`: Category classifications
- `library`: The library this icon belongs to
- `embedding`: Vector embedding for semantic search

## Google AI Models Used

- **Generative Model**: `gemini-1.5-flash` - Used for analyzing icons and generating metadata
- **Embedding Model**: `text-embedding-004` - Used for creating vector embeddings

## Example

Input: An SVG icon of a user profile
Output:

```json
{
  "name": "account",
  "commonnames": ["user", "profile", "person"],
  "description": "Represents a user account or profile.",
  "tags": ["user", "profile", "account"],
  "categories": ["people", "interface"],
  "library": "your-library",
  "embedding": [0.012, -0.019, ...]
}

```
