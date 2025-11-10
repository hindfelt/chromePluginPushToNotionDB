# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Manifest V3 extension that saves web pages to Notion databases with AI-generated summaries, tags, and metadata. The extension uses Google's Gemini API to analyze page content and the Notion API to create database entries.

## Architecture

### Core Components

**background.js** (Service Worker)
- Message handler for two main operations: `getSummary` and `saveToNotion`
- `getSummary()`: Calls Gemini API (gemini-2.5-flash model) to generate structured JSON with summary, whyItMatters, and tags
- `saveToNotion()`: Creates Notion page with properties matching the required schema
- `parseGeminiJson()`: Extracts JSON from Gemini response (handles markdown code blocks)
- `computeISOWeek()`: Calculates ISO week number for the Week field

**popup.js** (Extension UI)
- Manages database selection dropdown and push workflow
- Injects `getPageContent()` function into active tab to extract `document.body.innerText`
- Coordinates message passing: tab content → getSummary → saveToNotion
- Includes XSS protection via `escapeHtml()` for database names
- Blocks scripting on protected pages (chrome://, chrome-extension://, perplexity.ai)

**options.js** (Settings Page)
- Manages multiple database configurations (id, name, notionKey, databaseId)
- Google API key is shared across all databases
- `migrateOldSettings()`: Converts legacy single-database format to multi-database array
- Event delegation for edit/delete buttons to avoid CSP issues

### Data Flow

1. User clicks extension icon → popup.html loads
2. Popup loads databases from chrome.storage.sync
3. User selects database and clicks "Push to Notion"
4. Content script extracts page text via chrome.scripting.executeScript
5. Background worker gets AI summary from Gemini API
6. Background worker saves to Notion with database-specific API key
7. Success notification displayed

### Storage Schema

```javascript
chrome.storage.sync = {
  googleApiKey: string,
  databases: [
    {
      id: string,           // Generated via Date.now().toString(36) + Math.random()
      name: string,         // User-friendly name
      notionKey: string,    // Notion integration token
      databaseId: string    // Notion database ID (32 chars, no dashes)
    }
  ]
}
```

## Notion Database Requirements

The target Notion database must have these exact property names and types:

| Property Name  | Type          | Purpose                          |
| -------------- | ------------- | -------------------------------- |
| What           | Title         | Page URL                         |
| URL            | URL           | Page URL                         |
| Summary        | Rich Text     | AI-generated 2-sentence summary  |
| Why it matters | Rich Text     | AI-generated relevance statement |
| Tags           | Multi-select  | 2-4 AI-generated topic slugs     |
| Status         | Select        | Set to "Not Read"                |
| Date           | Date          | ISO date of save                 |
| Week           | Select        | ISO week number                  |

## Development Commands

### Testing the Extension

1. Load unpacked extension:
   ```
   chrome://extensions → Enable Developer Mode → Load unpacked → Select this directory
   ```

2. Reload extension after changes:
   ```
   chrome://extensions → Click reload icon on the extension card
   ```

3. Debug:
   - Background service worker: chrome://extensions → "service worker" link
   - Popup: Right-click extension icon → Inspect popup
   - Options page: Right-click on options page → Inspect

### No Build Process

This extension uses vanilla JavaScript with no build step. All changes to JS/HTML/CSS are reflected immediately after reloading the extension.

## API Configuration

### Gemini API
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- Model: `gemini-2.5-flash` (do not change without testing - model name matters)
- Prompt structure: Must request JSON output with exact keys: `summary`, `whyItMatters`, `tags`

### Notion API
- Version: `2022-06-28` (header required)
- Endpoint: `https://api.notion.com/v1/pages`
- Auth: Bearer token in Authorization header

## Common Issues

**CSP (Content Security Policy) Violations**
- Cannot use inline event handlers (onclick, etc.)
- Use event delegation for dynamically created buttons
- Example: options.js:79-91 handles edit/delete buttons via event delegation

**Page Scripting Restrictions**
- Cannot inject into chrome://, chrome-extension://, or certain sites like perplexity.ai
- Check for `chrome.runtime.lastError` after `chrome.scripting.executeScript`
- Display user-friendly error messages for blocked pages

**Gemini Response Parsing**
- Gemini may wrap JSON in markdown code blocks (```json ... ```)
- `parseGeminiJson()` strips code blocks and extracts JSON object
- Validate all expected fields exist after parsing

**Multi-Database Support**
- Each database has its own Notion API key and database ID
- Google AI API key is shared across all databases
- Migration logic in options.js:202-225 handles legacy single-database format

## Permissions

- `activeTab`: Access current tab content
- `storage`: Save settings to chrome.storage.sync
- `scripting`: Inject content extraction function
- `notifications`: Show save success notifications
- Host permissions for api.notion.com and generativelanguage.googleapis.com

## Extension Distribution

- Homepage URL points to GitHub Pages privacy policy
- Icon sizes: 16px, 48px, 128px (in images/ directory)
- Manifest version 3 required for Chrome Web Store
