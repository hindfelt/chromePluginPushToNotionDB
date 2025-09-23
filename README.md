# Chrome Plugin: Push to Notion

Initial commit to establish the main branch.

This Chrome extension allows you to quickly save any web page to a Notion database with an AI-generated summary, tags, and other relevant information.

## Features

*   **One-click saving:** Save any web page to Notion with a single click.
*   **AI-powered summaries:** Automatically generates a summary and a "why it matters" section for each page.
*   **AI-powered tags:** Automatically generates relevant tags for each page.
*   **Customizable:** Configure the extension with your own Notion database and API keys.

## Installation

1.  Clone this repository or download the source code as a ZIP file.
2.  Open Chrome and go to `chrome://extensions`.
3.  Enable "Developer mode" in the top right corner.
4.  Click on "Load unpacked".
5.  Select the `chromePluginPishToNotion` directory.

## Configuration

1.  After loading the extension, go to the extension's details and click on "Extension options".
2.  Enter the following information:
    *   **Notion API Key:** Your Notion integration token.
    *   **Notion Database ID:** The ID of the Notion database where you want to save the pages.
    *   **Google AI API Key:** Your API key for the Google AI (Gemini) API.
3.  Click "Save".

## Notion Database Schema

Your Notion database must have the following properties with the exact names and types:

| Property Name  | Type          |
| -------------- | ------------- |
| What           | `Title`       |
| URL            | `URL`         |
| Summary        | `Rich Text`   |
| Why it matters | `Rich Text`   |
| Tags           | `Multi-select`|
| Status         | `Select`      |
| Date           | `Date`        |
| Week           | `Select`      |
