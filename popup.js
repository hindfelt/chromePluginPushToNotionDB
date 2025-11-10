const databaseSelect = document.getElementById('database-select');
const pushButton = document.getElementById('push-button');
const settingsLink = document.getElementById('settings-link');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');
const selectorView = document.getElementById('selector-view');

let currentTab = null;
let databases = [];

// Load databases on popup open
loadDatabases();

// Settings link handler
settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Push button handler
pushButton.addEventListener('click', () => {
  const selectedDatabaseId = databaseSelect.value;

  if (!selectedDatabaseId) {
    showError('Please select a database');
    return;
  }

  const selectedDatabase = databases.find(db => db.id === selectedDatabaseId);
  if (!selectedDatabase) {
    showError('Selected database not found');
    return;
  }

  pushToNotion(selectedDatabase);
});

// Load databases from storage
function loadDatabases() {
  chrome.storage.sync.get(['databases'], (result) => {
    databases = result.databases || [];

    if (databases.length === 0) {
      databaseSelect.innerHTML = '<option value="">No databases configured</option>';
      pushButton.disabled = true;
      showError('No databases configured. Please go to Settings to add a database.');
      return;
    }

    // Populate dropdown
    databaseSelect.innerHTML = databases.map(db =>
      `<option value="${db.id}">${escapeHtml(db.name)}</option>`
    ).join('');

    pushButton.disabled = false;

    // Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      currentTab = tabs[0];

      // Check if page can be scripted
      if (currentTab.url.includes('perplexity.ai')) {
        showError('Perplexity pages cannot be scripted.');
        pushButton.disabled = true;
        return;
      }

      if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
        showError('Cannot script Chrome pages.');
        pushButton.disabled = true;
        return;
      }
    });
  });
}

// Push to Notion
function pushToNotion(database) {
  // Hide selector and show status
  selectorView.style.display = 'none';
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<p>Extracting page content...</p>';
  errorDiv.textContent = '';

  try {
    chrome.scripting.executeScript(
      {
        target: { tabId: currentTab.id },
        function: getPageContent,
      },
      (injectionResults) => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message.includes('This page cannot be scripted')) {
            showError('This page is protected and cannot be scripted.');
          } else {
            showError(`Error getting page content: ${chrome.runtime.lastError.message}`);
          }
          resetView();
          return;
        }

        if (!injectionResults || injectionResults.length === 0) {
          showError('Error getting page content: No results from script execution.');
          resetView();
          return;
        }

        const pageContent = injectionResults[0].result;

        // Get AI summary
        statusDiv.innerHTML = '<p>Generating summary...</p>';
        chrome.runtime.sendMessage({ type: 'getSummary', content: pageContent }, (response) => {
          if (response.error) {
            showError(response.error);
            resetView();
          } else {
            const { summary, whyItMatters, tags } = response;

            // Save to Notion
            statusDiv.innerHTML = '<p>Saving to Notion...</p>';
            chrome.runtime.sendMessage({
              type: 'saveToNotion',
              data: {
                url: currentTab.url,
                summary,
                whyItMatters,
                tags,
                notionKey: database.notionKey,
                databaseId: database.databaseId
              }
            }, (saveResponse) => {
              if (saveResponse.success) {
                statusDiv.innerHTML = '<p>✓ Saved successfully!</p>';
                setTimeout(() => window.close(), 2000);
              } else {
                showError(saveResponse.error);
                resetView();
              }
            });
          }
        });
      }
    );
  } catch (error) {
    showError(`Error: ${error.message}`);
    resetView();
  }
}

// Get page content (injected into tab)
function getPageContent() {
  return document.body.innerText;
}

// Show error message
function showError(message) {
  errorDiv.textContent = message;
}

// Reset view to selector
function resetView() {
  selectorView.style.display = 'flex';
  statusDiv.style.display = 'none';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
