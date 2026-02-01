const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const getYtDlpPath = () => {
    // 1. Check Windows
    if (process.platform === 'win32') {
        const winPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
        if (fs.existsSync(winPath)) return winPath;
    }

    // 2. Try to resolve via package path
    try {
        const pkgPath = require.resolve('youtube-dl-exec/package.json');
        const pkgDir = path.dirname(pkgPath);
        const binPath = path.join(pkgDir, 'bin', 'yt-dlp');
        if (fs.existsSync(binPath)) return binPath;
    } catch (e) { }

    // 3. Fallback to manual paths (Vercel/Linux)
    const possiblePaths = [
        path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp'),
        path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp'),
        '/var/task/node_modules/youtube-dl-exec/bin/yt-dlp',
        '/var/task/api/../node_modules/youtube-dl-exec/bin/yt-dlp'
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            try {
                fs.chmodSync(p, '755');
            } catch (e) { }
            return p;
        }
    }

    return 'yt-dlp';
};

const ytDlpPath = getYtDlpPath();
console.log('[INFO] Using yt-dlp path:', ytDlpPath);

const getInfo = (url) => {
    return new Promise((resolve, reject) => {
        const args = [
            url,
            '--dump-single-json',
            '--no-check-certificates',
            '--no-warnings',
            '--prefer-free-formats',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/'
        ];
        const ytProcess = spawn(ytDlpPath, args);
        let stdout = '';
        let stderr = '';

        ytProcess.stdout.on('data', (data) => stdout += data.toString());
        ytProcess.stderr.on('data', (data) => stderr += data.toString());

        ytProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new Error('Failed to parse yt-dlp output'));
                }
            } else {
                const errorMsg = `yt-dlp failed with code ${code}: ${stderr}`;
                console.error('[INFO]', errorMsg);
                reject(new Error(errorMsg));
            }
        });

        ytProcess.on('error', (err) => reject(err));
    });
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'No URL provided' });

    try {
        const output = await getInfo(videoUrl);
        res.status(200).json({
            title: output.title,
            thumbnail: output.thumbnail,
            author: output.uploader,
            lengthSeconds: output.duration
        });
    } catch (err) {
        console.error('[INFO] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch video info: ' + err.message });
    }
};
