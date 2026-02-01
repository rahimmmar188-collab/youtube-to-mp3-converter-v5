const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'No URL provided' });

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

        res.status(200).json({
            title: details.title,
            thumbnail: details.thumbnails[details.thumbnails.length - 1].url,
            author: details.author.name,
            lengthSeconds: details.lengthSeconds,
            version: '1.0.2' // To verify deployment
        });
    } catch (err) {
        console.error('[INFO] Error:', err.message);
        res.status(500).json({ error: 'Extraction Error: ' + err.message });
    }
};
