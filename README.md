# IDE

A web IDE designed to render and browse github repository code directly in your browser.

![Screenshot](public/screenshot.png)

## What it does not do

- Search files
- Edit files
- Save files

## GitHub Authentication

Work out of the box with public repositories.

To access private repositories, the IDE requires a GitHub Personal Access Token (PAT).

### How to provide the token

- **Automatic Prompt**: If you attempt to access a private repository without a token, the IDE will prompt you to enter one.
- **Persistence**: Once entered, the token is securely stored in your browser's `localStorage` for future sessions.
- **Manual Setting**: You can programmatically set the token by sending a `postMessage` to the IDE iframe:
  ```javascript
  window.postMessage(
    { type: "INTLAYER_SET_TOKEN", token: "your_github_token" },
    "*",
  );
  ```

The token handling logic is implemented in `src/repo-api.ts`.

## Origin

This project is a fork of [1qh/idecn](https://github.com/1qh/idecn).
