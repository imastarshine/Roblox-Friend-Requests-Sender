# Roblox Friend Requests Sender

A Chrome extension that helps you send friend requests on Roblox automatically with customizable delay between requests.

## Installation

1. Download the extension files to your computer
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension icon should now appear in your Chrome toolbar

## How to Use

1. Click on the extension icon in Chrome
2. Prepare your JSON data in the following format:

```json
{
  "123456789": {
    "displayName": "ExampleUser",
    "username": "exampleuser123"
  },
  "987654321": {
    "displayName": "AnotherUser",
    "username": "anotheruser456"
  }
}
```

3. Paste your JSON into the text area
4. Set your desired delay between requests (in milliseconds). Minimum is 2000ms (2 seconds)
5. Click "Start" to begin sending friend requests
6. You can stop the process at any time by clicking "Stop"

## Notes

- You need to be logged into your Roblox account in Chrome
- The extension respects Roblox's rate limits and includes automatic retry logic
- Use this tool responsibly and respect Roblox's terms of service
- The delay between requests helps avoid triggering anti-spam measures

## Features

- Progress tracking with visual progress bar
- Real-time status updates
- Customizable delay between requests
- JSON validation with visual feedback
- Automatic CSRF token handling
- Rate limit detection and handling

The extension will automatically handle authentication and send friend requests to all users in your JSON list with the specified delay between each request.
