const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const getYtDlpPath = () => {
    if (process.platform === 'win32') {
        const winPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
        if (fs.existsSync(winPath)) return winPath;
    }

    try {
        const pkgPath = require.resolve('youtube-dl-exec/package.json');
        const pkgDir = path.dirname(pkgPath);
        const binPath = path.join(pkgDir, 'bin', 'yt-dlp');
        if (fs.existsSync(binPath)) return binPath;
    } catch (e) { }

    const possiblePaths = [
        path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp'),
        path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp'),
        '/var/task/node_modules/youtube-dl-exec/bin/yt-dlp'
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }

    return 'yt-dlp';
};

const ytDlpPath = getYtDlpPath();

const getInfo = (url) => {
    return new Promise((resolve, reject) => {
        const args = [url, '--dump-single-json', '--no-check-certificates', '--no-warnings'];
        const ytProcess = spawn(ytDlpPath, args);
        let stdout = '';
        ytProcess.stdout.on('data', (data) => stdout += data.toString());
        ytProcess.on('close', (code) => {
            if (code === 0) resolve(JSON.parse(stdout));
            else reject(new Error(`yt-dlp info failed with code ${code}`));
        });
        ytProcess.on('error', (err) => reject(err));
    });
};

module.exports = async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'No URL provided' });

    try {
        const info = await getInfo(videoUrl);
        const title = info.title.replace(/[^\w\s-]/gi, '') || 'audio';

        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        const args = [
            '-o', '-',
            '-f', 'ba[ext=m4a]/ba[ext=aac]/ba/best',
            '--no-check-certificates',
            '--no-warnings',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/',
            videoUrl
        ];

        const ytDlpProcess = spawn(ytDlpPath, args);
        const stream = ytDlpProcess.stdout;

        ytDlpProcess.stderr.on('data', (data) => {
            // Keep logs for debugging but don't overwhelm
            const log = data.toString();
            if (log.includes('download')) console.log('[YT-DLP]', log.trim());
        });

        const command = ffmpeg(stream)
            .audioBitrate(128)
            .format('mp3')
            .on('error', (err) => {
                console.error('[FFMPEG] Error:', err.message);
                if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
            })
            .on('end', () => {
                if (ytDlpProcess.pid) try { ytDlpProcess.kill(); } catch (e) { }
            });

        command.pipe(res, { end: true });

    } catch (err) {
        console.error('[CONVERT] Error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server Error: ' + err.message });
    }
};
