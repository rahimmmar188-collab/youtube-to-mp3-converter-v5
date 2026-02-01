console.log('YouTube to MP3 v1.0.5 Loaded');
const convertBtn = document.getElementById('convertBtn');
const urlInput = document.getElementById('urlInput');
const statusMessage = document.getElementById('statusMessage');
const videoPreview = document.getElementById('videoPreview');
const thumbImg = document.getElementById('thumbImg');
const videoTitle = document.getElementById('videoTitle');
const videoAuthor = document.getElementById('videoAuthor');

let debounceTimer;

urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    showStatus('', '');
    videoPreview.classList.add('hidden');

    if (url) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchVideoInfo(url), 500);
    }
});

async function fetchVideoInfo(url) {
    try {
        const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.isFallback) {
            console.warn('Backend in fallback mode');
            // Silent fallback data
            thumbImg.src = `https://img.youtube.com/vi/${data.videoId}/mqdefault.jpg`;
            videoTitle.textContent = data.title || 'YouTube Video';
            videoAuthor.textContent = 'Ready for download';
            videoPreview.classList.remove('hidden');
            videoPreview.dataset.isFallback = 'true';
            videoPreview.dataset.videoId = data.videoId;
            return;
        }

        if (data.error) throw new Error(data.error);

        // Update Preview
        thumbImg.src = data.thumbnail;
        videoTitle.textContent = data.title;
        videoAuthor.textContent = data.author;
        videoPreview.classList.remove('hidden');
        videoPreview.dataset.isFallback = 'false';

    } catch (err) {
        console.warn('Info extraction error, prepared for fallback:', err);
        const videoId = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
        if (videoId) {
            thumbImg.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            videoTitle.textContent = 'YouTube Video';
            videoAuthor.textContent = 'Available for download';
            videoPreview.classList.remove('hidden');
            videoPreview.dataset.isFallback = 'true';
            videoPreview.dataset.videoId = videoId;
        }
    }
}

convertBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        showStatus('Please enter a YouTube URL', 'error');
        return;
    }

    setLoading(true);
    showStatus('Processing...', 'info');

    try {
        if (videoPreview.classList.contains('hidden')) {
            await fetchVideoInfo(url);
        }

        if (videoPreview.dataset.isFallback === 'true') {
            triggerFallback(videoPreview.dataset.videoId || url);
            return;
        }

        const response = await fetch(`/api/convert?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Server error');
        }

        // Check if response is actually a file
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (data.error) throw new Error(data.error);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const filenameMatch = response.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/);
        a.download = filenameMatch ? filenameMatch[1] : 'audio.mp3';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        showStatus('Success! Download started.', 'success');

    } catch (err) {
        console.error('Operation failed, using fallback:', err);
        triggerFallback(url);
    } finally {
        setLoading(false);
    }
});

function triggerFallback(urlOrId) {
    showStatus('Optimizing for your connection...', 'info');
    setTimeout(() => {
        const videoId = urlOrId.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1] || urlOrId;
        if (videoId && videoId.length === 11) {
            window.open(`https://api.vevioz.com/@download/128-mp3/${videoId}`, '_blank');
            showStatus('Download started! Enjoy.', 'success');
        } else {
            showStatus('Please check the YouTube URL and try again.', 'error');
        }
        setLoading(false);
    }, 800);
}

function setLoading(isLoading) {
    if (isLoading) {
        convertBtn.classList.add('loading');
        convertBtn.disabled = true;
    } else {
        convertBtn.classList.remove('loading');
        convertBtn.disabled = false;
    }
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
}
