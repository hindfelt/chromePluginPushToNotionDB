const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');

// Get current tab URL and content, then save to Notion
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const url = tab.url;

  if (url.includes('perplexity.ai')) {
    showError('Perplexity pages cannot be scripted.');
    return;
  }

  if (url.startsWith('chrome://')) {
    showError('Cannot script Chrome pages.');
    return;
  }

  try {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        function: getPageContent,
      },
      (injectionResults) => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message.includes('This page cannot be scripted')) {
            showError('This page is protected and cannot be scripted.');
          } else {
            showError(`Error getting page content: ${chrome.runtime.lastError.message}`);
          }
          return;
        }
        if (!injectionResults || injectionResults.length === 0) {
          showError('Error getting page content: No results from script execution.');
          return;
        }
        const pageContent = injectionResults[0].result;

        // Get summary and then save to Notion
        chrome.runtime.sendMessage({ type: 'getSummary', content: pageContent }, (response) => {
          if (response.error) {
            showError(response.error);
          } else {
            const { summary, whyItMatters, tags } = response;
            chrome.runtime.sendMessage({ type: 'saveToNotion', data: { url, summary, whyItMatters, tags } }, (saveResponse) => {
              if (saveResponse.success) {
                statusDiv.innerHTML = '<p>Saved to Notion successfully!</p>';
                setTimeout(() => window.close(), 2000);
              } else {
                showError(saveResponse.error);
              }
            });
          }
        });
      }
    );
  } catch (error) {
    showError(`Error getting page content: ${error.message}`);
  }
});

function getPageContent() {
  return document.body.innerText;
}

function showError(message) {
  statusDiv.style.display = 'none';
  errorDiv.textContent = message;
}