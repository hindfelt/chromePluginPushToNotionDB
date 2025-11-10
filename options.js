// DOM Elements
const googleApiKeyInput = document.getElementById('google-api-key');
const saveGoogleKeyButton = document.getElementById('save-google-key');
const googleKeyStatus = document.getElementById('google-key-status');

const databasesList = document.getElementById('databases-list');
const databaseNameInput = document.getElementById('database-name');
const notionKeyInput = document.getElementById('notion-key');
const databaseIdInput = document.getElementById('database-id');
const saveDatabaseButton = document.getElementById('save-database');
const cancelEditButton = document.getElementById('cancel-edit');
const databaseStatus = document.getElementById('database-status');
const formTitle = document.getElementById('form-title');
const editDatabaseIdInput = document.getElementById('edit-database-id');

// Migrate old settings and load on page load
migrateOldSettings().then(() => loadSettings());

// Save Google API Key
saveGoogleKeyButton.addEventListener('click', () => {
  const googleApiKey = googleApiKeyInput.value.trim();

  if (!googleApiKey) {
    showStatus(googleKeyStatus, 'Please enter a Google AI API key', 'error');
    return;
  }

  chrome.storage.sync.set({ googleApiKey }, () => {
    showStatus(googleKeyStatus, 'API key saved successfully!', 'success');
  });
});

// Save or Update Database
saveDatabaseButton.addEventListener('click', () => {
  const name = databaseNameInput.value.trim();
  const notionKey = notionKeyInput.value.trim();
  const databaseId = databaseIdInput.value.trim();
  const editId = editDatabaseIdInput.value;

  if (!name || !notionKey || !databaseId) {
    showStatus(databaseStatus, 'Please fill in all fields', 'error');
    return;
  }

  chrome.storage.sync.get(['databases'], (result) => {
    let databases = result.databases || [];

    if (editId) {
      // Update existing database
      const index = databases.findIndex(db => db.id === editId);
      if (index !== -1) {
        databases[index] = { id: editId, name, notionKey, databaseId };
      }
    } else {
      // Add new database
      const newDatabase = {
        id: generateId(),
        name,
        notionKey,
        databaseId
      };
      databases.push(newDatabase);
    }

    chrome.storage.sync.set({ databases }, () => {
      showStatus(databaseStatus, editId ? 'Database updated!' : 'Database added!', 'success');
      clearForm();
      loadDatabases();
    });
  });
});

// Cancel Edit
cancelEditButton.addEventListener('click', () => {
  clearForm();
});

// Load all settings
function loadSettings() {
  chrome.storage.sync.get(['googleApiKey', 'databases'], (result) => {
    if (result.googleApiKey) {
      googleApiKeyInput.value = result.googleApiKey;
    }
    loadDatabases();
  });
}

// Load and display databases
function loadDatabases() {
  chrome.storage.sync.get(['databases'], (result) => {
    const databases = result.databases || [];

    if (databases.length === 0) {
      databasesList.innerHTML = '<p class="no-databases">No databases configured. Add one below.</p>';
      return;
    }

    databasesList.innerHTML = databases.map(db => `
      <div class="database-item" data-id="${db.id}">
        <div class="database-info">
          <div class="database-name">${escapeHtml(db.name)}</div>
          <div class="database-id">ID: ${escapeHtml(db.databaseId)}</div>
        </div>
        <div class="database-actions">
          <button class="edit-button" onclick="editDatabase('${db.id}')">Edit</button>
          <button class="delete-button" onclick="deleteDatabase('${db.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  });
}

// Edit database
window.editDatabase = function(id) {
  chrome.storage.sync.get(['databases'], (result) => {
    const databases = result.databases || [];
    const database = databases.find(db => db.id === id);

    if (database) {
      databaseNameInput.value = database.name;
      notionKeyInput.value = database.notionKey;
      databaseIdInput.value = database.databaseId;
      editDatabaseIdInput.value = database.id;

      formTitle.textContent = 'Edit Database';
      saveDatabaseButton.textContent = 'Update Database';
      cancelEditButton.style.display = 'block';

      // Scroll to form
      document.querySelector('.database-form').scrollIntoView({ behavior: 'smooth' });
    }
  });
};

// Delete database
window.deleteDatabase = function(id) {
  if (!confirm('Are you sure you want to delete this database?')) {
    return;
  }

  chrome.storage.sync.get(['databases'], (result) => {
    let databases = result.databases || [];
    databases = databases.filter(db => db.id !== id);

    chrome.storage.sync.set({ databases }, () => {
      loadDatabases();
      showStatus(databaseStatus, 'Database deleted!', 'success');
    });
  });
};

// Clear form
function clearForm() {
  databaseNameInput.value = '';
  notionKeyInput.value = '';
  databaseIdInput.value = '';
  editDatabaseIdInput.value = '';

  formTitle.textContent = 'Add New Database';
  saveDatabaseButton.textContent = 'Save Database';
  cancelEditButton.style.display = 'none';
  databaseStatus.textContent = '';
}

// Show status message
function showStatus(element, message, type) {
  element.textContent = message;
  element.style.color = type === 'error' ? '#dc3545' : '#28a745';

  setTimeout(() => {
    element.textContent = '';
  }, 3000);
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Migrate old settings format to new format
async function migrateOldSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['notionKey', 'databaseId', 'databases'], (result) => {
      // Check if old format exists and new format doesn't
      if (result.notionKey && result.databaseId && (!result.databases || result.databases.length === 0)) {
        const migratedDatabase = {
          id: generateId(),
          name: 'Default Database',
          notionKey: result.notionKey,
          databaseId: result.databaseId
        };

        chrome.storage.sync.set({ databases: [migratedDatabase] }, () => {
          console.log('Migrated old settings to new format');
          // Don't remove old keys in case user downgrades
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}
