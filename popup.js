// ============ GLOBAL STATE ============
let selectedMinutes = 0;
let tasks = [];
let countdownInterval = null;

// ============ DOM ELEMENTS ============
const tabSelect = document.getElementById('tabSelect');
const refreshTabsBtn = document.getElementById('refreshTabs');
const promptInput = document.getElementById('promptInput');
const customHours = document.getElementById('customHours');
const customMinutes = document.getElementById('customMinutes');
const exactTime = document.getElementById('exactTime');
const selectedTimeDisplay = document.getElementById('selectedTime');
const addTaskBtn = document.getElementById('addTask');
const taskList = document.getElementById('taskList');
const clearAllBtn = document.getElementById('clearAll');
const statusBar = document.getElementById('statusBar');
const taskCount = document.getElementById('taskCount');
const detectedAI = document.getElementById('detectedAI');

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  loadTabs();
  loadTasks();
  startCountdownUpdater();
  setMinDateTime();
});

// Set minimum datetime to now
function setMinDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  exactTime.min = now.toISOString().slice(0, 16);
}

// ============ TAB MANAGEMENT ============
async function loadTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    tabSelect.innerHTML = '<option value="">-- Select a Tab --</option>';
    
    tabs.forEach(tab => {
      const option = document.createElement('option');
      option.value = tab.id;
      
      // Truncate title
      const title = tab.title.length > 50 
        ? tab.title.substring(0, 50) + '...' 
        : tab.title;
      
      // Add AI indicator
      let aiIcon = '';
      if (tab.url.includes('claude.ai')) aiIcon = '🟠 ';
      else if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) aiIcon = '🟢 ';
      else if (tab.url.includes('gemini.google.com')) aiIcon = '🔵 ';
      
      option.textContent = `${aiIcon}${title}`;
      option.dataset.url = tab.url;
      tabSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading tabs:', error);
  }
}

refreshTabsBtn.addEventListener('click', () => {
  loadTabs();
  showToast('Tabs refreshed!', 'info');
});

// Detect AI platform when tab selected
tabSelect.addEventListener('change', () => {
  const selectedOption = tabSelect.options[tabSelect.selectedIndex];
  if (!selectedOption || !selectedOption.dataset.url) {
    detectedAI.className = 'detected-ai';
    return;
  }
  
  const url = selectedOption.dataset.url;
  let platform = detectPlatform(url);
  
  if (platform) {
    detectedAI.textContent = `✅ Detected: ${platform.name}`;
    detectedAI.className = `detected-ai show ${platform.class}`;
  } else {
    detectedAI.textContent = '⚠️ Not a recognized AI platform (may still work)';
    detectedAI.className = 'detected-ai show other';
  }
});

function detectPlatform(url) {
  if (url.includes('claude.ai')) return { name: 'Claude AI', class: 'claude' };
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) return { name: 'ChatGPT', class: 'chatgpt' };
  if (url.includes('gemini.google.com')) return { name: 'Google Gemini', class: 'gemini' };
  return null;
}

// ============ TIME SELECTION ============

// Preset buttons
document.querySelectorAll('.time-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active from all
    document.querySelectorAll('.time-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    selectedMinutes = parseInt(btn.dataset.minutes);
    
    // Clear custom inputs
    customHours.value = 0;
    customMinutes.value = 0;
    exactTime.value = '';
    
    updateTimeDisplay();
  });
});

// Custom time inputs
customHours.addEventListener('input', handleCustomTime);
customMinutes.addEventListener('input', handleCustomTime);

function handleCustomTime() {
  const hrs = parseInt(customHours.value) || 0;
  const mins = parseInt(customMinutes.value) || 0;
  selectedMinutes = (hrs * 60) + mins;
  
  // Clear presets and exact time
  document.querySelectorAll('.time-preset').forEach(b => b.classList.remove('active'));
  exactTime.value = '';
  
  updateTimeDisplay();
}

// Exact time input
exactTime.addEventListener('input', () => {
  if (exactTime.value) {
    const targetDate = new Date(exactTime.value);
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      showToast('Please select a future time!', 'error');
      exactTime.value = '';
      return;
    }
    
    selectedMinutes = Math.ceil(diffMs / 60000);
    
    // Clear presets and custom
    document.querySelectorAll('.time-preset').forEach(b => b.classList.remove('active'));
    customHours.value = 0;
    customMinutes.value = 0;
    
    updateTimeDisplay();
  }
});

function updateTimeDisplay() {
  if (selectedMinutes <= 0) {
    selectedTimeDisplay.textContent = 'No time selected';
    return;
  }
  
  const hrs = Math.floor(selectedMinutes / 60);
  const mins = selectedMinutes % 60;
  
  const targetTime = new Date(Date.now() + selectedMinutes * 60000);
  const timeStr = targetTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  let durationStr = '';
  if (hrs > 0) durationStr += `${hrs}h `;
  if (mins > 0) durationStr += `${mins}m`;
  
  selectedTimeDisplay.textContent = `⏰ Will send in ${durationStr.trim()} (at ${timeStr})`;
}

// ============ TASK MANAGEMENT ============

addTaskBtn.addEventListener('click', addTask);

async function addTask() {
  // Validation
  const tabId = parseInt(tabSelect.value);
  const prompt = promptInput.value.trim();
  
  if (!tabId) {
    showToast('Please select a browser tab!', 'error');
    return;
  }
  
  if (!prompt) {
    showToast('Please write a prompt!', 'error');
    return;
  }
  
  if (selectedMinutes <= 0) {
    showToast('Please set a time!', 'error');
    return;
  }
  
  const selectedOption = tabSelect.options[tabSelect.selectedIndex];
  const url = selectedOption.dataset.url;
  const platform = detectPlatform(url);
  
  const task = {
    id: Date.now().toString(),
    tabId: tabId,
    tabTitle: selectedOption.textContent.trim(),
    url: url,
    platform: platform ? platform.class : 'other',
    platformName: platform ? platform.name : 'Other',
    prompt: prompt,
    scheduledTime: Date.now() + (selectedMinutes * 60000),
    status: 'pending', // pending, executing, completed, failed
    createdAt: Date.now()
  };
  
  // Save task
  tasks.push(task);
  await saveTasks();
  
  // Create alarm in background
  chrome.runtime.sendMessage({
    action: 'createAlarm',
    task: task
  });
  
  // Clear inputs
  promptInput.value = '';
  selectedMinutes = 0;
  document.querySelectorAll('.time-preset').forEach(b => b.classList.remove('active'));
  customHours.value = 0;
  customMinutes.value = 0;
  exactTime.value = '';
  selectedTimeDisplay.textContent = 'No time selected';
  
  // Update UI
  renderTasks();
  showToast('Task scheduled successfully! ✅', 'success');
}

// Load tasks from storage
async function loadTasks() {
  try {
    const result = await chrome.storage.local.get('scheduledTasks');
    tasks = result.scheduledTasks || [];
    renderTasks();
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

// Save tasks to storage
async function saveTasks() {
  try {
    await chrome.storage.local.set({ scheduledTasks: tasks });
    updateStatusBar();
  } catch (error) {
    console.error('Error saving tasks:', error);
  }
}

// Render tasks list
function renderTasks() {
  if (tasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-state">
        <span>📭</span>
        <p>No scheduled tasks yet</p>
      </div>
    `;
    updateStatusBar();
    return;
  }
  
  // Sort by scheduled time
  const sortedTasks = [...tasks].sort((a, b) => a.scheduledTime - b.scheduledTime);
  
  taskList.innerHTML = sortedTasks.map(task => {
    const scheduledDate = new Date(task.scheduledTime);
    const timeStr = scheduledDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    const dateStr = scheduledDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    return `
      <div class="task-card ${task.status}" data-id="${task.id}">
        <div class="task-card-header">
          <span class="task-ai-badge ${task.platform}">${task.platformName}</span>
          <span class="task-status ${task.status}">${task.status.toUpperCase()}</span>
        </div>
        <div class="task-prompt">${escapeHtml(task.prompt)}</div>
        <div class="task-footer">
          <span class="task-time">📅 ${dateStr} at ${timeStr}</span>
          <span class="task-countdown" data-target="${task.scheduledTime}">
            ${task.status === 'pending' ? getCountdown(task.scheduledTime) : ''}
          </span>
          <div class="task-actions">
            ${task.status === 'pending' ? `
              <button class="task-btn delete" onclick="deleteTask('${task.id}')" title="Delete">🗑️</button>
            ` : `
              <button class="task-btn delete" onclick="deleteTask('${task.id}')" title="Remove">✖️</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  updateStatusBar();
}

// Get countdown string
function getCountdown(targetTime) {
  const now = Date.now();
  const diff = targetTime - now;
  
  if (diff <= 0) return 'Executing...';
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// Start countdown updater
function startCountdownUpdater() {
  countdownInterval = setInterval(() => {
    document.querySelectorAll('.task-countdown[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target);
      if (target) {
        el.textContent = getCountdown(target);
      }
    });
  }, 1000);
}

// Delete task
window.deleteTask = async function(taskId) {
  tasks = tasks.filter(t => t.id !== taskId);
  await saveTasks();
  
  // Remove alarm
  chrome.runtime.sendMessage({
    action: 'removeAlarm',
    taskId: taskId
  });
  
  renderTasks();
  showToast('Task removed!', 'info');
};

// Clear all tasks
clearAllBtn.addEventListener('click', async () => {
  if (tasks.length === 0) return;
  
  // Remove all alarms
  chrome.runtime.sendMessage({ action: 'clearAllAlarms' });
  
  tasks = [];
  await saveTasks();
  renderTasks();
  showToast('All tasks cleared!', 'info');
});

// Update status bar
function updateStatusBar() {
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const totalCount = tasks.length;
  
  taskCount.textContent = `${totalCount} task${totalCount !== 1 ? 's' : ''}`;
  
  if (pendingCount > 0) {
    statusBar.className = 'status-bar has-tasks';
    statusBar.querySelector('.status-text').textContent = `${pendingCount} pending`;
  } else {
    statusBar.className = 'status-bar';
    statusBar.querySelector('.status-text').textContent = 'Ready';
  }
}

// ============ UTILITIES ============

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Listen for task updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'taskUpdated') {
    const taskIndex = tasks.findIndex(t => t.id === message.taskId);
    if (taskIndex !== -1) {
      tasks[taskIndex].status = message.status;
      renderTasks();
    }
  }
  
  if (message.action === 'tasksRefresh') {
    loadTasks();
  }
});

// Cleanup on popup close
window.addEventListener('unload', () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});