# 🎵 Premium YouTube to MP3 Converter

A sleek, high-performance, and fully independent YouTube to MP3 converter built with Node.js, Express, and Vercel.

## 🚀 Features
- **High Quality**: Converts to 128kbps MP3.
- **Fast & Reliable**: Uses efficient piping to minimize latency and memory usage.
- **Vercel Ready**: Optimized for serverless deployment.
- **Modern UI**: Clean, responsive design with preview functionality.
- **Zero Dependencies (External)**: Runs fully natively without requiring external background services.

## 🛠️ Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **Core Logic**: `ffmpeg`, `yt-dlp` (via `youtube-dl-exec`)
- **Deployment**: Vercel

## 💻 Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/youtube-to-mp3-converter.git
   cd youtube-to-mp3-converter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```
   The app will be available at `http://localhost:3000`.

## 🚢 Deployment (Vercel)
This project is pre-configured for Vercel. Simply connect your GitHub repository to Vercel and it will handle the rest.

> [!NOTE]
> Vercel Hobby tier has a 10s-25s execution limit. Very long videos might timeout during conversion.

## 📄 License
This project is licensed under the ISC License.
