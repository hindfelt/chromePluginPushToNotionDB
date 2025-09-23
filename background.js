chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSummary') {
    getSummary(request.content)
      .then(summaryData => sendResponse(summaryData))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Indicates that the response is sent asynchronously
  } else if (request.type === 'saveToNotion') {
    saveToNotion(request.data)
      .then(() => {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon48.svg',
          title: 'Push to Notion',
          message: 'Page saved to Notion successfully!'
        });
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

function computeISOWeek(date) {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((tempDate - yearStart) / 86400000 + 1) / 7);
}

async function getSummary(content) {
  const { googleApiKey } = await chrome.storage.sync.get('googleApiKey');
  if (!googleApiKey) {
    throw new Error('Google AI API key not set. Please set it in the extension options.');
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${googleApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Provide an output strictly in JSON with keys summary, whyItMatters, tags.\n` + 
              `- summary: two sentences summarising the article.\n` + 
              `- whyItMatters: one sentence explaining the relevance to a curious professional.\n` + 
              `- tags: array of 2-4 concise topic slugs (lowercase, hyphenated).\n` + 
              `Article Content: ${content}`
        }]
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Google AI API Error:', JSON.stringify(errorData, null, 2));
    let errorMessage = 'Unknown error';
    if (errorData && errorData.error && errorData.error.message) {
      errorMessage = errorData.error.message;
    }
    throw new Error(`Failed to get summary from Google AI: ${errorMessage}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate) {
    throw new Error('Gemini returned an empty response.');
  }

  let parsed;
  try {
    parsed = parseGeminiJson(candidate);
  } catch (error) {
    throw new Error(`Gemini response was not valid JSON: ${error.message}`);
  }

  const summary = parsed.summary?.trim() || '';
  const whyItMatters = parsed.whyItMatters?.trim() || '';
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter(tag => typeof tag === 'string' && tag.trim() !== '').map(tag => tag.trim())
    : [];

  return { summary, whyItMatters, tags };
}

async function saveToNotion(data) {
  console.log('Saving to Notion with data:', data);
  const { notionKey, databaseId } = await chrome.storage.sync.get(['notionKey', 'databaseId']);
  if (!notionKey || !databaseId) {
    throw new Error('Notion API key or Database ID not set. Please set them in the extension options.');
  }

  const { url, summary, whyItMatters, tags } = data;
  const today = new Date();
  const week = computeISOWeek(today);

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          'What': { title: [{ text: { content: url } }] },
          'URL': { url: url },
          'Summary': { rich_text: [{ text: { content: summary } }] },
          'Why it matters': { rich_text: [{ text: { content: whyItMatters } }] },
          'Tags': { multi_select: tags.map(tag => ({ name: tag })) },
          'Status': { select: { name: 'Not Read' } },
          'Date': { date: { start: today.toISOString().split('T')[0] } },
          'Week': { select: { name: String(week) } }
        }
      })
    });

    console.log('Notion API response:', response);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Notion API Error:', JSON.stringify(errorData, null, 2));
      throw new Error(`Failed to save to Notion: ${errorData.message}`);
    }
  } catch (error) {
    console.error('Error in saveToNotion:', error);
    throw error;
  }
}

function parseGeminiJson(candidate) {
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new Error('No response text to parse.');
  }

  const stripped = candidate
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Missing JSON object in response.');
  }

  const jsonSlice = stripped.slice(start, end + 1);
  return JSON.parse(jsonSlice);
}