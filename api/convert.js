const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ytdl = require('@distube/ytdl-core');

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'No URL provided' });

    try {
        console.log('[CONVERT] Fetching info for:', videoUrl);
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title.replace(/[^\w\s-]/gi, '') || 'audio';

        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        const stream = ytdl(videoUrl, {
            quality: 'highestaudio',
            filter: 'audioonly',
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.youtube.com/'
                }
            }
        });

        const command = ffmpeg(stream)
            .audioBitrate(128)
            .format('mp3')
            .on('error', (err) => {
                console.error('[FFMPEG] Error:', err.message);
                if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
            });

        command.pipe(res, { end: true });

    } catch (err) {
        console.error('[CONVERT] Error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server Error: ' + err.message });
    }
};
