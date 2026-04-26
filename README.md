# IDE

A high-performance web-based IDE designed to render and browse public repository code directly in your browser.

![Screenshot](public/screenshot.png)

## Features

- **Monaco Editor**: Industry-standard code editing experience.
- **Syntax Highlighting**: Beautiful code rendering powered by [Shiki](https://shiki.style/).
- **Flexible Layout**: Multi-tab interface and resizable panels powered by [Dockview](https://dockview.dev/).
- **File Exploration**: Browse repository structures with familiar Material Icon Theme.
- **Public Repo Rendering**: Instantly load and view any public repository.
- **Modern Stack**: Built with React 19, Vite, Tailwind CSS 4, and Jotai.

## Origin

This project is a fork of [1qh/idecn](https://github.com/1qh/idecn).

## Getting Started

### Prerequisites

You need [Bun](https://bun.sh/) installed on your machine.

### Installation

```bash
bun install
```

### Development

Run the development server:

```bash
bun run dev
```

### Building for Production

```bash
bun run build
```

The production-ready assets will be in the `dist` directory.

## Deployment

### Docker

You can run the IDE using Docker:

```bash
docker build -t ide .
docker run -p 3000:3000 ide
```

## Technologies

- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4
- **Editor**: Monaco Editor
- **State Management**: Jotai
- **Icons**: Lucide React & Material Icon Theme
