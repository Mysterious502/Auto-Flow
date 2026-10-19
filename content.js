// ============ CONTENT SCRIPT ============
// This runs inside the AI web pages

// Prevent multiple injections
if (window._autoFlowLoaded) {
  console.log('[Auto Flow] Content script already loaded');
} else {
  window._autoFlowLoaded = true;
  
  console.log('[Auto Flow] Content script loaded on:', window.location.href);
  
  // Listen for execute prompt messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executePrompt') {
      console.log('[Auto Flow] Executing prompt:', message.prompt.substring(0, 50) + '...');
      
      executePrompt(message.prompt, message.platform)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[Auto Flow] Execution error:', error);
          sendResponse({ success: false, error: error.message });
        });
      
      return true; // Keep message channel open for async response
    }
  });
}

// ============ MAIN EXECUTE FUNCTION ============
async function executePrompt(prompt, platform) {
  const url = window.location.href;
  
  // Detect platform from URL if not provided
  if (!platform) {
    if (url.includes('claude.ai')) platform = 'claude';
    else if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) platform = 'chatgpt';
    else if (url.includes('gemini.google.com')) platform = 'gemini';
    else platform = 'other';
  }
  
  console.log(`[Auto Flow] Platform detected: ${platform}`);
  
  switch (platform) {
    case 'claude':
      return await executeOnClaude(prompt);
    case 'chatgpt':
      return await executeOnChatGPT(prompt);
    case 'gemini':
      return await executeOnGemini(prompt);
    default:
      return await executeGeneric(prompt);
  }
}

// ============ CLAUDE AI ============
async function executeOnClaude(prompt) {
  console.log('[Auto Flow] Executing on Claude...');
  
  // Find the input area - Claude uses contenteditable div
  const selectors = [
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]',
    'fieldset .ProseMirror',
    '[data-placeholder]',
    '.composer-input',
  ];
  
  let inputEl = null;
  for (const selector of selectors) {
    inputEl = document.querySelector(selector);
    if (inputEl) break;
  }
  
  if (!inputEl) {
    throw new Error('Claude input field not found');
  }
  
  // Focus and set text
  inputEl.focus();
  await delay(300);
  
  // Clear existing content
  inputEl.innerHTML = '';
  await delay(100);
  
  // Type the prompt using different methods
  // Method 1: Set innerHTML with paragraph
  inputEl.innerHTML = `<p>${escapeHtml(prompt)}</p>`;
  
  // Dispatch input event to trigger React state update
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  
  await delay(500);
  
  // If innerHTML method didn't work, try execCommand
  if (!inputEl.textContent || inputEl.textContent.trim() === '') {
    inputEl.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, prompt);
    await delay(500);
  }
  
  // If still empty, try clipboard method
  if (!inputEl.textContent || inputEl.textContent.trim() === '') {
    await pasteText(inputEl, prompt);
    await delay(500);
  }
  
  // Find and click send button
  await delay(500);
  const sendButton = findSendButton();
  
  if (sendButton) {
    sendButton.click();
    console.log('[Auto Flow] Send button clicked on Claude');
  } else {
    // Try pressing Enter
    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
    console.log('[Auto Flow] Enter key dispatched on Claude');
  }
  
  return true;
}

// ============ CHATGPT ============
async function executeOnChatGPT(prompt) {
  console.log('[Auto Flow] Executing on ChatGPT...');
  
  // Find the input area
  const selectors = [
    '#prompt-textarea',
    'textarea[data-id="root"]',
    'div[contenteditable="true"]#prompt-textarea',
    'div[id="prompt-textarea"]',
    'textarea',
    'div[contenteditable="true"]',
  ];
  
  let inputEl = null;
  for (const selector of selectors) {
    inputEl = document.querySelector(selector);
    if (inputEl) break;
  }
  
  if (!inputEl) {
    throw new Error('ChatGPT input field not found');
  }
  
  inputEl.focus();
  await delay(300);
  
  const tagName = inputEl.tagName.toLowerCase();
  
  if (tagName === 'textarea') {
    // Set value for textarea
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(inputEl, prompt);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // ContentEditable div (newer ChatGPT)
    inputEl.innerHTML = '';
    await delay(100);
    
    // Try multiple methods
    inputEl.innerHTML = `<p>${escapeHtml(prompt)}</p>`;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    
    await delay(300);
    
    if (!inputEl.textContent.trim()) {
      inputEl.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
    }
    
    if (!inputEl.textContent.trim()) {
      await pasteText(inputEl, prompt);
    }
  }
  
  await delay(500);
  
  // Find send button
  const sendButton = findSendButton();
  
  if (sendButton) {
    sendButton.click();
    console.log('[Auto Flow] Send button clicked on ChatGPT');
  } else {
    // Press Enter (Ctrl+Enter for some versions)
    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
  }
  
  return true;
}

// ============ GEMINI ============
async function executeOnGemini(prompt) {
  console.log('[Auto Flow] Executing on Gemini...');
  
  const selectors = [
    '.ql-editor',
    'div[contenteditable="true"]',
    '.text-input-field textarea',
    'textarea',
    'rich-textarea .ql-editor',
  ];
  
  let inputEl = null;
  for (const selector of selectors) {
    inputEl = document.querySelector(selector);
    if (inputEl) break;
  }
  
  if (!inputEl) {
    throw new Error('Gemini input field not found');
  }
  
  inputEl.focus();
  await delay(300);
  
  const tagName = inputEl.tagName.toLowerCase();
  
  if (tagName === 'textarea') {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(inputEl, prompt);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    inputEl.innerHTML = `<p>${escapeHtml(prompt)}</p>`;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    
    await delay(300);
    
    if (!inputEl.textContent.trim()) {
      inputEl.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
    }
  }
  
  await delay(500);
  
  const sendButton = findSendButton();
  if (sendButton) {
    sendButton.click();
    console.log('[Auto Flow] Send button clicked on Gemini');
  } else {
    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
  }
  
  return true;
}

// ============ GENERIC (for any other site) ============
async function executeGeneric(prompt) {
  console.log('[Auto Flow] Executing generic method...');
  
  // Try to find any text input
  const selectors = [
    'textarea',
    'div[contenteditable="true"]',
    'input[type="text"]',
    '[role="textbox"]',
  ];
  
  let inputEl = null;
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    // Get the last one (usually the input area in chat interfaces)
    if (elements.length > 0) {
      inputEl = elements[elements.length - 1];
      break;
    }
  }
  
  if (!inputEl) {
    throw new Error('No input field found on this page');
  }
  
  inputEl.focus();
  await delay(300);
  
  const tagName = inputEl.tagName.toLowerCase();
  
  if (tagName === 'textarea' || tagName === 'input') {
    const proto = tagName === 'textarea' 
      ? window.HTMLTextAreaElement.prototype 
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    nativeSetter.call(inputEl, prompt);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    inputEl.textContent = prompt;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    
    if (!inputEl.textContent.trim()) {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
    }
  }
  
  await delay(500);
  
  const sendButton = findSendButton();
  if (sendButton) {
    sendButton.click();
  } else {
    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
  }
  
  return true;
}

// ============ HELPER: Find Send Button ============
function findSendButton() {
  // Common send button selectors across AI platforms
  const buttonSelectors = [
    // Claude
    'button[aria-label="Send Message"]',
    'button[aria-label="Send message"]',
    'button[data-testid="send-button"]',
    
    // ChatGPT
    'button[data-testid="send-button"]',
    'button[data-testid="fruitjuice-send-button"]',
    
    // Gemini
    'button[aria-label="Send message"]',
    'button.send-button',
    
    // Generic patterns
    'button[type="submit"]',
  ];
  
  for (const selector of buttonSelectors) {
    const btn = document.querySelector(selector);
    if (btn && !btn.disabled) return btn;
  }
  
  // Try finding by SVG arrow icon (common in chat UIs)
  const allButtons = document.querySelectorAll('button');
  for (const btn of allButtons) {
    // Check if button contains send-like SVG (arrow up icon)
    const svg = btn.querySelector('svg');
    if (svg && !btn.disabled) {
      const path = svg.querySelector('path');
      if (path) {
        const d = path.getAttribute('d');
        // Arrow-up patterns commonly used in send buttons
        if (d && (d.includes('M7 11L12 6') || d.includes('m1 1') || d.includes('arrow'))) {
          return btn;
        }
      }
    }
    
    // Check aria-label patterns
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes('send') && !btn.disabled) {
      return btn;
    }
  }
  
  // Last resort: find buttons near the input area
  const inputArea = document.querySelector('div[contenteditable="true"], textarea');
  if (inputArea) {
    const parent = inputArea.closest('form') || inputArea.parentElement?.parentElement;
    if (parent) {
      const nearbyBtn = parent.querySelector('button:not([disabled])');
      if (nearbyBtn) return nearbyBtn;
    }
  }
  
  return null;
}

// ============ HELPER: Paste Text ============
async function pasteText(element, text) {
  element.focus();
  
  try {
    // Create a paste event with the text
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboardData
    });
    
    element.dispatchEvent(pasteEvent);
  } catch (e) {
    // Fallback: use execCommand
    document.execCommand('insertText', false, text);
  }
}

// ============ UTILITIES ============
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}