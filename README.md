# Auto Flow - AI Task Scheduler

Auto Flow is a Chrome/Chromium browser extension that schedules a prompt and sends it to an AI chat page at a time you choose. Use it to queue follow-up work for later—for example, when you expect an AI service's usage limit to reset.

> **Note:** This repository currently contains a partial version of Auto Flow. The complete, more advanced version will be uploaded later, once some issues have been resolved. Thanks for your patience.

> **Important:** Auto Flow automates the browser interface. It does not check an AI provider's usage limits or guarantee that a scheduled prompt will be accepted. The selected page must be signed in and ready to use.

## Features

- Schedule prompts for Claude, ChatGPT, and Google Gemini.
- Choose a preset delay (5 minutes, 15 minutes, 30 minutes, 1, 2, or 3 hours), enter a custom delay, or select an exact date and time.
- View scheduled tasks, their status, and a live countdown.
- Remove an individual task or clear all tasks.
- Keep scheduled tasks in extension storage, so they remain available after closing the popup.
- Restore pending alarms when the extension or browser starts.
- Try a generic input-field strategy on other HTTPS pages. This is experimental and is not guaranteed to work on every site.

## Supported AI websites

| Website | URL |
| --- | --- |
| Claude | `https://claude.ai/` |
| ChatGPT | `https://chatgpt.com/` and `https://chat.openai.com/` |
| Google Gemini | `https://gemini.google.com/` |

The extension has platform-specific input handling for the websites above. Website UI changes can break automation until the relevant selectors are updated.

## Install from source

This project does not currently include a build step or package manager configuration.

1. Download or clone this repository to your computer.
2. Open `chrome://extensions` in Chrome, or the equivalent extensions page in your Chromium-based browser.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the project folder containing `manifest.json`.
6. Pin **Auto Flow** to the browser toolbar for easy access.

To get updates, download or pull the latest project files and reload the extension from the extensions page.

## How to use

1. Open the AI website and conversation where you want the prompt sent. Sign in and make sure the page is ready.
2. Open Auto Flow from the browser toolbar.
3. Under **Select Browser Tab**, choose the tab with the AI conversation. Use the refresh button if the tab is not listed.
4. Enter the prompt you want Auto Flow to send.
5. Choose a preset, set a custom delay, or choose an exact future date and time.
6. Select **Add Scheduled Task**. The task appears in the list with its scheduled time and countdown.
7. Keep the browser open until the task runs. When it is due, Auto Flow activates the selected tab, fills the prompt, and attempts to send it.

You can remove a task from its task card, or use **Clear All** to remove every scheduled task.

## Task behavior and limitations

- **Browser availability:** Keep the browser running. If the browser is closed or suspended, a task may run late or may not run when expected. Alarm timing is managed by the browser and is not a precision guarantee.
- **Page readiness:** The AI tab must be accessible. If the original tab has been closed, Auto Flow tries to find a matching page by URL or open the saved URL in a new tab.
- **Authentication and service limits:** Auto Flow does not sign in, bypass provider restrictions, detect when a usage limit resets, or retry a prompt rejected by the provider.
- **Sending is automated:** When the task executes, the extension attempts to send the saved prompt. Review your prompt and selected conversation before scheduling it.
- **Page compatibility:** AI providers can change their interface at any time. Automation can fail if the input field or send button cannot be found.
- **Other websites:** A generic strategy is attempted for other HTTPS tabs, but this is experimental. It may choose an unsuitable field or fail to submit.
- **Permissions:** The extension declares broad HTTPS host access because it can inject its generic automation into a selected HTTPS tab. The built-in content script is configured for the supported AI websites; on other sites, code is injected only when a scheduled task targets that tab.
- **Exact timing:** The browser's alarm system may delay execution. Exact-time scheduling means “schedule for this time,” not guaranteed delivery at the exact second.

## Privacy

Scheduled task details—including the prompt, selected tab URL, and scheduled time—are saved in Chrome extension local storage on your browser. The extension's source code does not send task data to an Auto Flow server. When a scheduled task runs, the prompt is entered into the selected webpage, so that website receives it as though you had submitted it there yourself.

Use care when scheduling sensitive information, especially on shared devices or accounts.

## Responsible use and disclaimer

Auto Flow is a browser-automation tool intended for lawful, responsible use. Do not use it to break the law, harass or harm others, send spam, bypass service limits or safeguards, or violate the terms or policies of the websites you use. You are responsible for the prompts you schedule, the websites and accounts you use, and checking that your use complies with applicable laws and third-party terms.

The project is provided as-is, without guarantees that it will always work safely, securely, or as expected. The maintainers make reasonable efforts to keep the project safe, but no software can be guaranteed risk-free. To the extent permitted by applicable law, the maintainers are not responsible for misuse of the project or for consequences arising from its use. This statement does not remove any rights or responsibilities that cannot legally be excluded.

Auto Flow is not affiliated with or endorsed by Anthropic, OpenAI, Google, or the browser vendors. Follow the relevant providers' rules and use automation thoughtfully.

**Stay safe, stay healthy, and use Auto Flow responsibly.**

## Permissions explained

The extension requests these Chrome permissions:

| Permission | Purpose |
| --- | --- |
| `storage` | Save scheduled tasks locally in the browser. |
| `alarms` | Schedule background wake-ups for pending tasks. |
| `tabs` | List browser tabs and activate or locate the selected tab. |
| `activeTab` | Support access to the currently active tab when permitted by the browser. |
| `scripting` | Inject the automation script when a task is due. |
| HTTPS host access | Communicate with supported AI pages and inject the script into a selected HTTPS page when required. |

## Project structure

```text
.
├── background.js       # Alarm scheduling, task execution, and startup recovery
├── content.js          # Finds the prompt field and submits prompts on web pages
├── manifest.json       # Extension metadata, permissions, and content-script setup
├── popup.css           # Popup styling
├── popup.html          # Extension popup interface
├── popup.js            # Tab selection, scheduling controls, and task list
└── icons/              # Extension icons
```

## Troubleshooting

**The AI tab is missing from the selector**

- Select the refresh button in the popup.
- Check that the page is open in a regular browser tab.

**The task runs but the prompt is not sent**

- Confirm that the page is one of the supported websites and is fully loaded.
- Make sure you are signed in and that the conversation can accept a prompt.
- Check the extension service worker and the AI page's developer console for errors.
- The provider may have changed its page layout; the content-script selectors may need an update.

**The task does not run at the expected time**

- Keep the browser open and check that the extension is enabled.
- Browser alarms are not exact timers; execution can be delayed by browser or device activity.
- Reopen the extension popup to check whether the task is still pending or has failed.

**I want to remove stored tasks**

- Use **Clear All** in the popup to remove scheduled tasks and their alarms.
- Removing the extension also removes its extension-local data when the browser removes the extension.

## Contributing

Bug reports and pull requests are welcome. For automation bugs, include:

- The affected website and page type (do not include private conversation content).
- Browser name and version.
- What you expected to happen and what happened instead.
- Any relevant error message from the extension service worker or page console.

## License

This project is **dual-licensed** under the **GNU General Public License v3.0 (GPL-3.0) or the MIT License**. You may choose which of these two licenses applies to your use of the project:

- [GNU GPL v3.0](./LICENSE): copyleft terms apply to distributions under this license.
- [MIT License](./LICENSE-MIT): permissive terms apply to distributions under this license, including use in proprietary projects, subject to the license conditions.

Security issues should be reported privately; see [SECURITY.md](./SECURITY.md).
See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.
