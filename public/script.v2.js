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

        if (!response.ok) {
            console.warn('Info fetch failed:', data.error);
            return;
        }

        // Update Preview
        thumbImg.src = data.thumbnail;
        videoTitle.textContent = data.title;
        videoAuthor.textContent = data.author;
        videoPreview.classList.remove('hidden');

    } catch (err) {
        // Ignore errors during typing
        if (window.location.protocol === 'file:') {
            console.error('ERROR: You are opening index.html as a file. Please visit http://localhost:3000 instead.');
        } else {
            console.warn('Network error fetching info:', err);
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
    showStatus('Starting conversion...', 'info');

    try {
        // Try fetch info if not already visible
        if (videoPreview.classList.contains('hidden')) {
            await fetchVideoInfo(url);
        }

        const response = await fetch(`/api/convert?url=${encodeURIComponent(url)}`);

        const contentType = response.headers.get('content-type');

        if (!response.ok || (contentType && contentType.includes('application/json'))) {
            const errorBody = await response.text();
            let errorMessage = 'Conversion failed';
            try {
                const errorData = JSON.parse(errorBody);
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = errorBody || errorMessage;
            }
            throw new Error(errorMessage);
        }

        // Download logic
        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'audio.mp3';

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch.length === 2)
                filename = filenameMatch[1];
        }

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        showStatus('Download started!', 'success');
        urlInput.value = '';
        videoPreview.classList.add('hidden');

    } catch (err) {
        console.error(err);
        let msg = err.message;
        if (window.location.protocol === 'file:') {
            msg = 'Error: You must visit http://localhost:3000 (not open file directly)';
        } else if (msg === 'Failed to fetch') {
            msg = 'Failed to connect to server. Is it running?';
        }
        showStatus(msg, 'error');
    } finally {
        setLoading(false);
    }
});

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
