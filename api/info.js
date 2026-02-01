const ytdl = require('@distube/ytdl-core');

const INVIDIOUS_INSTANCES = [
    'https://invidious.flokinet.to',
    'https://inv.riverside.rocks',
    'https://yewtu.be',
    'https://invidious.snopyta.org',
    'https://invidious.kavin.rocks',
    'https://inv.nadeko.net',
    'https://invidious.sethforprivacy.com'
];

async function getInfoFromInvidious(videoId) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            console.log(`[INFO] Trying Invidious instance: ${instance}`);
            const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
                headers: { 'User-Agent': userAgent },
                signal: AbortSignal.timeout(6000)
            });
            if (res.ok) {
                const data = await res.json();
                return {
                    title: data.title,
                    thumbnail: data.videoThumbnails.find(t => t.quality === 'maxresdefault' || t.quality === 'high')?.url || data.videoThumbnails[0].url,
                    author: data.author,
                    lengthSeconds: data.lengthSeconds,
                    from: 'invidious'
                };
            }
        } catch (e) {
            console.warn(`[INFO] Failed fetch from ${instance}:`, e.message);
        }
    }
    throw new Error('All Invidious instances failed');
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'No URL provided' });

    try {
        // Try ytdl-core first
        try {
            const info = await ytdl.getInfo(videoUrl, {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.5',
                    }
                }
            });
            const details = info.videoDetails;
            return res.status(200).json({
                title: details.title,
                thumbnail: details.thumbnails[details.thumbnails.length - 1].url,
                author: details.author.name,
                lengthSeconds: details.lengthSeconds,
                from: 'ytdl'
            });
        } catch (ytdlErr) {
            console.warn('[INFO] ytdl-core failed, trying Invidious fallback...', ytdlErr.message);
            const videoId = ytdl.getVideoID(videoUrl);
            const info = await getInfoFromInvidious(videoId);
            return res.status(200).json(info);
        }
    } catch (err) {
        console.error('[INFO] Error:', err.message);
        res.status(500).json({ error: 'Extraction Error: ' + err.message });
    }
};
