const ytdl = require('@distube/ytdl-core');

const getInfo = async (url) => {
    const info = await ytdl.getInfo(url, {
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Sec-Fetch-Mode': 'navigate',
                'Referer': 'https://www.youtube.com/',
                'Origin': 'https://www.youtube.com'
            }
        }
    });
    return info.videoDetails;
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
            thumbnail: output.thumbnails[output.thumbnails.length - 1].url,
            author: output.author.name,
            lengthSeconds: output.lengthSeconds
        });
    } catch (err) {
        console.error('[INFO] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch video info: ' + err.message });
    }
};
