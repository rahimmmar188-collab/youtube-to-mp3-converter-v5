const ytdl = require('@distube/ytdl-core');

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
            try {
                const info = await getInfoFromInvidious(videoId);
                return res.status(200).json(info);
            } catch (invErr) {
                console.warn('[INFO] All extraction methods failed, returning fallback ID');
                return res.status(200).json({
                    title: 'YouTube Video',
                    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    author: 'Unknown Creator',
                    lengthSeconds: 0,
                    videoId: videoId,
                    isFallback: true
                });
            }
        }
    } catch (err) {
        console.error('[INFO] Critical Error:', err.message);
        const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1] || '';
        res.status(200).json({
            title: 'Video',
            videoId: videoId,
            isFallback: true
        });
    }
};
