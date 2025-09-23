const notionKeyInput = document.getElementById('notion-key');
const databaseIdInput = document.getElementById('database-id');
const googleApiKeyInput = document.getElementById('google-api-key');
const saveButton = document.getElementById('save-button');
const statusDiv = document.getElementById('status');

// Load saved settings
chrome.storage.sync.get(['notionKey', 'databaseId', 'googleApiKey'], (result) => {
  if (result.notionKey) {
    notionKeyInput.value = result.notionKey;
  }
  if (result.databaseId) {
    databaseIdInput.value = result.databaseId;
  }
  if (result.googleApiKey) {
    googleApiKeyInput.value = result.googleApiKey;
  }
});

// Save settings
saveButton.addEventListener('click', () => {
  const notionKey = notionKeyInput.value;
  const databaseId = databaseIdInput.value;
  const googleApiKey = googleApiKeyInput.value;

  chrome.storage.sync.set({ notionKey, databaseId, googleApiKey }, () => {
    statusDiv.textContent = 'Settings saved!';
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 2000);
  });
});