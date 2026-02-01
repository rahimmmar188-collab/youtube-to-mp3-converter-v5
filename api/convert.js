const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ytdl = require('@distube/ytdl-core');

ffmpeg.setFfmpegPath(ffmpegPath);

const INVIDIOUS_INSTANCES = [
    'https://yewtu.be',
    'https://yt.artemislena.eu',
    'https://invidious.flokinet.to',
    'https://invidious.privacydev.net',
    'https://iv.melmac.space',
    'https://inv.nadeko.net',
    'https://inv.tux.pizza',
    'https://invidious.protokolla.fi',
    'https://invidious.private.coffee',
    'https://yt.drgnz.club',
    'https://iv.datura.network',
    'https://invidious.fdn.fr',
    'https://invidious.drgns.space',
    'https://inv.us.projectsegfau.lt',
    'https://invidious.jing.rocks',
    'https://invidious.privacyredirect.com',
    'https://invidious.reallyaweso.me',
    'https://invidious.materialio.us'
];

async function getStreamInfoFromInvidious(videoId) {
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const data = await res.json();
                const format = data.adaptiveFormats.find(f => f.type.includes('audio/webm') || f.type.includes('audio/mp4')) || data.formatStreams[0];
                return { url: format.url, title: data.title };
            }
        } catch (e) { }
    }
    throw new Error('All fallbacks failed');
}

module.exports = async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'No URL provided' });

    let stream;
    let title = 'audio';

    try {
        console.log('[CONVERT] Trying ytdl-core:', videoUrl);
        const info = await ytdl.getInfo(videoUrl, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
                }
            }
        });
        title = info.videoDetails.title.replace(/[^\w\s-]/gi, '') || 'audio';
        stream = ytdl(videoUrl, {
            quality: 'highestaudio',
            filter: 'audioonly',
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
                }
            }
        });
    } catch (err) {
        console.warn('[CONVERT] ytdl-core failed, trying Invidious fallback...', err.message);
        try {
            const videoId = ytdl.getVideoID(videoUrl);
            const invidiousData = await getStreamInfoFromInvidious(videoId);
            title = invidiousData.title.replace(/[^\w\s-]/gi, '') || 'audio';
            stream = invidiousData.url;
        } catch (fallbackErr) {
            console.error('[CONVERT] All extraction methods failed');
            return res.status(500).json({ error: 'Server Error: ' + fallbackErr.message });
        }
    }

    const { PassThrough } = require('stream');

    try {
        const ffStream = ffmpeg(stream)
            .audioBitrate(128)
            .format('mp3')
            .on('error', (err) => {
                console.error('[FFMPEG] Error:', err.message);
                if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
            });

        const pt = new PassThrough();
        ffStream.pipe(pt);

        pt.once('data', (chunk) => {
            if (!res.headersSent) {
                res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
                res.setHeader('Content-Type', 'audio/mpeg');
                res.write(chunk);
                pt.pipe(res);
            }
        });

    } catch (err) {
        console.error('[CONVERT] Stream error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
    }
};
