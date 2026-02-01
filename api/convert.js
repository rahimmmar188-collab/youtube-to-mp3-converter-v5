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
    'https://inv.tux.pizza'
];

const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
    'https://cobalt.api.unblocker.it',
    'https://cobalt.moe',
    'https://api.cobalt.red',
    'https://cobalt.shitty.tube',
    'https://cobalt-api.m-m-s.icu'
];

async function getStreamInfoFromInvidious(videoId) {
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const data = await res.json();
                const aud = data.adaptiveFormats?.find(f => f.type.includes('audio/webm') || f.type.includes('audio/mp4'));
                if (aud && aud.url) return { url: aud.url, title: data.title };
            }
        } catch (e) { }
    }
    return null;
}

async function getStreamFromCobalt(videoUrl) {
    for (const instance of COBALT_INSTANCES) {
        try {
            const res = await fetch(instance, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: videoUrl, aFormat: 'mp3', isAudioOnly: true, audioBitrate: '128' }),
                signal: AbortSignal.timeout(8000)
            });
            if (res.ok) {
                const data = await res.json();
                if (data.url) return data.url;
                if (data.status === 'redirect' && data.url) return data.url;
            }
        } catch (e) { }
    }
    return null;
}

async function tryProxySources(videoId) {
    const fallbacks = [
        `https://api.v-mate.top/@download/128-mp3/${videoId}`,
        `https://api.download.yt/@download/128-mp3/${videoId}`,
        `https://mp3.yt-download.org/@download/128-mp3/${videoId}`,
        `https://api.vevioz.com/@download/128-mp3/${videoId}`
    ];
    for (const url of fallbacks) {
        try {
            console.log(`[PROXY] Attempting: ${url}`);
            const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (response.ok && response.body && response.headers.get('content-type')?.includes('audio')) {
                return response.body;
            }
        } catch (e) { }
    }
    return null;
}

module.exports = async (req, res) => {
    const { PassThrough } = require('stream');
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'No URL provided' });

    let videoId;
    try { videoId = ytdl.getVideoID(videoUrl); } catch (e) { return res.status(400).json({ error: 'Invalid YouTube URL' }); }

    let streamSource = null;
    let title = 'audio';

    // 1. Primary: ytdl-core (Immediate attempt)
    try {
        const info = await ytdl.getInfo(videoUrl);
        title = info.videoDetails.title.replace(/[^\w\s-]/gi, '') || 'audio';
        streamSource = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });
    } catch (err) { console.warn('[LAYER 1] Failed'); }

    // 2. Secondary: Cobalt (Resilient, often bypasses IP bans)
    if (!streamSource) {
        try {
            const url = await getStreamFromCobalt(videoUrl);
            if (url) streamSource = url;
        } catch (e) { console.warn('[LAYER 2] Failed'); }
    }

    // 3. Tertiary: Invidious
    if (!streamSource) {
        try {
            const data = await getStreamInfoFromInvidious(videoId);
            if (data) {
                title = data.title.replace(/[^\w\s-]/gi, '') || title;
                streamSource = data.url;
            }
        } catch (e) { console.warn('[LAYER 3] Failed'); }
    }

    // Stream handler for ffmpeg-based conversion
    const handleStream = async (src) => {
        return new Promise((resolve) => {
            const ff = ffmpeg(src).audioBitrate(128).format('mp3')
                .on('error', () => resolve(false));

            const pt = new PassThrough();
            ff.pipe(pt);

            pt.once('data', (chunk) => {
                if (!res.headersSent) {
                    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
                    res.setHeader('Content-Type', 'audio/mpeg');
                    res.write(chunk);
                    pt.pipe(res);
                }
                resolve(true);
            });
            setTimeout(() => resolve(false), 15000); // Timeout for stream start
        });
    };

    if (streamSource) {
        const success = await handleStream(streamSource);
        if (success) return;
    }

    // 4. Quaternary: Ultimate Proxy Layer
    const proxyBody = await tryProxySources(videoId);
    if (proxyBody && !res.headersSent) {
        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        const reader = proxyBody.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        return res.end();
    }

    if (!res.headersSent) res.status(500).json({ error: 'Conversion busy. Please try another video or try again in 30 seconds.' });
};
