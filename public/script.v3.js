console.log('YouTube to MP3 v1.0.6 Loaded');
const convertBtn = document.getElementById('convertBtn');
const urlInput = document.getElementById('urlInput');
const statusMessage = document.getElementById('statusMessage');
const videoPreview = document.getElementById('videoPreview');
const thumbImg = document.getElementById('thumbImg');
const videoTitle = document.getElementById('videoTitle');
const videoAuthor = document.getElementById('videoAuthor');
const downloadSection = document.getElementById('downloadSection');

let debounceTimer;

urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    showStatus('', '');
    videoPreview.classList.add('hidden');
    downloadSection.classList.add('hidden');

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

        showStatus('Connecting to audio server...', 'info');

        const response = await fetch(`/api/convert?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Server busy, please try again in a moment');
        }

        showStatus('Found audio! Initializing download...', 'success');

        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            // Update status with progress if possible
            if (receivedLength > 0) {
                showStatus(`Downloading: ${(receivedLength / 1024 / 1024).toFixed(1)} MB received...`, 'info');
            }
        }

        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;

        // Get filename from header or fallback
        const contentDisp = response.headers.get('Content-Disposition');
        let filename = 'audio.mp3';
        if (contentDisp && contentDisp.includes('filename=')) {
            filename = contentDisp.split('filename=')[1].replace(/["]/g, '');
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
        }, 100);

        showStatus('Download Complete!', 'success');

    } catch (err) {
        console.error('Operation failed:', err);
        let message = err.message;
        try {
            const parsed = JSON.parse(err.message);
            if (parsed.error) message = parsed.error;
        } catch (e) {
            // Not JSON or doesn't have .error, use err.message as is
        }
        showStatus('Error: ' + message, 'error');
    } finally {
        setLoading(false);
    }
});

// Fallback UI helper removed as logic moved to backend 302 redirect

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
