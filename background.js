// ============ AUTO FLOW - BACKGROUND SERVICE WORKER ============
// This runs even when popup is closed!

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'createAlarm':
      createTaskAlarm(message.task);
      sendResponse({ success: true });
      break;
      
    case 'removeAlarm':
      removeTaskAlarm(message.taskId);
      sendResponse({ success: true });
      break;
      
    case 'clearAllAlarms':
      clearAllTaskAlarms();
      sendResponse({ success: true });
      break;
  }
  return true;
});

// Create alarm for a task
function createTaskAlarm(task) {
  const delayInMinutes = Math.max((task.scheduledTime - Date.now()) / 60000, 0.1);
  
  chrome.alarms.create(`task_${task.id}`, {
    delayInMinutes: delayInMinutes
  });
  
  console.log(`[Auto Flow] Alarm created for task ${task.id}, fires in ${delayInMinutes.toFixed(1)} minutes`);
}

// Remove alarm for a task
function removeTaskAlarm(taskId) {
  chrome.alarms.clear(`task_${taskId}`);
  console.log(`[Auto Flow] Alarm removed for task ${taskId}`);
}

// Clear all alarms
async function clearAllTaskAlarms() {
  const alarms = await chrome.alarms.getAll();
  alarms.forEach(alarm => {
    if (alarm.name.startsWith('task_')) {
      chrome.alarms.clear(alarm.name);
    }
  });
  console.log('[Auto Flow] All alarms cleared');
}

// ============ ALARM HANDLER ============
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('task_')) return;
  
  const taskId = alarm.name.replace('task_', '');
  console.log(`[Auto Flow] Alarm fired for task ${taskId}`);
  
  // Get task from storage
  const result = await chrome.storage.local.get('scheduledTasks');
  const tasks = result.scheduledTasks || [];
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) {
    console.log(`[Auto Flow] Task ${taskId} not found`);
    return;
  }
  
  const task = tasks[taskIndex];
  
  if (task.status !== 'pending') {
    console.log(`[Auto Flow] Task ${taskId} is not pending (${task.status})`);
    return;
  }
  
  // Update status to executing
  tasks[taskIndex].status = 'executing';
  await chrome.storage.local.set({ scheduledTasks: tasks });
  
  // Notify popup if open
  broadcastMessage({ action: 'taskUpdated', taskId: taskId, status: 'executing' });
  
  // Execute the task
  try {
    await executeTask(task);
    
    // Update status to completed
    tasks[taskIndex].status = 'completed';
    await chrome.storage.local.set({ scheduledTasks: tasks });
    broadcastMessage({ action: 'taskUpdated', taskId: taskId, status: 'completed' });
    
    console.log(`[Auto Flow] Task ${taskId} completed successfully`);
  } catch (error) {
    console.error(`[Auto Flow] Task ${taskId} failed:`, error);
    
    // Update status to failed
    tasks[taskIndex].status = 'failed';
    tasks[taskIndex].error = error.message;
    await chrome.storage.local.set({ scheduledTasks: tasks });
    broadcastMessage({ action: 'taskUpdated', taskId: taskId, status: 'failed' });
  }
});

// ============ TASK EXECUTION ============
async function executeTask(task) {
  // First, try to focus the tab
  try {
    await chrome.tabs.update(task.tabId, { active: true });
    // Small delay to let tab become active
    await delay(1000);
  } catch (error) {
    // Tab might have been closed, try to find it by URL
    console.log('[Auto Flow] Original tab not found, searching by URL...');
    const tabs = await chrome.tabs.query({ url: task.url + '*' });
    
    if (tabs.length > 0) {
      task.tabId = tabs[0].id;
      await chrome.tabs.update(task.tabId, { active: true });
      await delay(1000);
    } else {
      // Open new tab with the URL
      const newTab = await chrome.tabs.create({ url: task.url });
      task.tabId = newTab.id;
      await delay(5000); // Wait for page to load
    }
  }
  
  // Inject content script and execute prompt
  try {
    await chrome.scripting.executeScript({
      target: { tabId: task.tabId },
      files: ['content.js']
    });
  } catch (e) {
    // Content script might already be injected
    console.log('[Auto Flow] Content script may already be loaded');
  }
  
  await delay(500);
  
  // Send prompt to content script
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(task.tabId, {
      action: 'executePrompt',
      prompt: task.prompt,
      platform: task.platform
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

// ============ UTILITIES ============
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function broadcastMessage(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup might not be open, ignore error
  });
}

// ============ STARTUP ============
// Re-register alarms on extension startup (in case browser was restarted)
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Auto Flow] Extension started, checking pending tasks...');
  await restoreAlarms();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Auto Flow] Extension installed/updated');
  await restoreAlarms();
});

async function restoreAlarms() {
  const result = await chrome.storage.local.get('scheduledTasks');
  const tasks = result.scheduledTasks || [];
  
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  
  for (const task of pendingTasks) {
    if (task.scheduledTime > Date.now()) {
      createTaskAlarm(task);
    } else {
      // Task time has passed, execute immediately
      const delayMs = 1000;
      setTimeout(() => {
        chrome.alarms.create(`task_${task.id}`, { delayInMinutes: 0.1 });
      }, delayMs);
    }
  }
  
  console.log(`[Auto Flow] Restored ${pendingTasks.length} pending alarms`);
}