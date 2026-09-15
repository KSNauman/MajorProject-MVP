let currentOutDir = null;
let originalAnnotation = null;
let annotationData = null;
let characterImage = new Image();

const canvas = document.getElementById('fixer-canvas');
const ctx = canvas.getContext('2d');

let draggedPoint = null;
const POINT_RADIUS = 6;

// Skeleton Definition (Based on AnimatedDrawings standard)
const SKELETON_CONNECTIONS = [
    ['root', 'hip'],
    ['hip', 'torso'],
    ['torso', 'neck'],
    ['torso', 'right_shoulder'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_hand'],
    ['torso', 'left_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_hand'],
    ['root', 'right_hip'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_foot'],
    ['root', 'left_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_foot']
];

async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('upload-status');
    statusEl.innerText = "Extracting keypoints... This may take a moment.";

    const formData = new FormData();
    formData.append('character', file);

    try {
        const response = await fetch('/api/fixer/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (response.ok) {
            currentOutDir = result.outDir;
            await loadCharacterData(result.annotationUrl, result.textureUrl);
            document.getElementById('step-upload').classList.remove('active');
            document.getElementById('step-editor').classList.add('active');
            loadMotions();
        } else {
            statusEl.innerText = "Error: " + result.error;
        }
    } catch (err) {
        statusEl.innerText = "Upload failed.";
        console.error(err);
    }
}

async function loadCharacterData(jsonUrl, imgUrl) {
    try {
        const [jsonRes, imgRes] = await Promise.all([
            fetch(jsonUrl),
            fetch(imgUrl)
        ]);

        if (!jsonRes.ok) throw new Error("Failed to fetch annotation JSON");
        if (!imgRes.ok) throw new Error("Failed to fetch texture image");

        annotationData = await jsonRes.json();
        originalAnnotation = JSON.parse(JSON.stringify(annotationData)); // Deep copy

        const imgBlob = await imgRes.blob();
        const objectURL = URL.createObjectURL(imgBlob);

        characterImage = new Image();
        characterImage.onload = () => {
            // Setup canvas size to exactly match the image
            canvas.width = characterImage.width;
            canvas.height = characterImage.height;
            drawCanvas();
            URL.revokeObjectURL(objectURL);
        };
        characterImage.onerror = () => {
            console.error("Failed to decode character texture image.");
        };
        characterImage.src = objectURL;
    } catch (error) {
        console.error("Error loading character data:", error);
        alert("Error loading character: " + error.message);
    }
}

function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(characterImage, 0, 0);

    if (!annotationData || !annotationData.skeleton) return;

    const skeleton = annotationData.skeleton;

    // Draw lines
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    SKELETON_CONNECTIONS.forEach(([a, b]) => {
        const ptA = skeleton.find(s => s.name === a);
        const ptB = skeleton.find(s => s.name === b);
        if (ptA && ptB) {
            ctx.beginPath();
            ctx.moveTo(ptA.loc[0], ptA.loc[1]);
            ctx.lineTo(ptB.loc[0], ptB.loc[1]);
            ctx.stroke();
        }
    });

    // Draw points
    skeleton.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.loc[0], pt.loc[1], POINT_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = (draggedPoint === pt) ? '#ef4444' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#1d4ed8';
        ctx.stroke();
    });
}

// --- Canvas Interaction ---

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

canvas.addEventListener('mousedown', (e) => {
    if (!annotationData) return;
    const pos = getMousePos(e);
    
    // Find clicked point
    for (const pt of annotationData.skeleton) {
        const dx = pos.x - pt.loc[0];
        const dy = pos.y - pt.loc[1];
        if (Math.sqrt(dx*dx + dy*dy) < POINT_RADIUS * 2) {
            draggedPoint = pt;
            break;
        }
    }
    drawCanvas();
});

canvas.addEventListener('mousemove', (e) => {
    if (draggedPoint) {
        const pos = getMousePos(e);
        draggedPoint.loc = [Math.round(pos.x), Math.round(pos.y)];
        drawCanvas();
    }
});

canvas.addEventListener('mouseup', () => {
    draggedPoint = null;
    drawCanvas();
});

// --- Actions ---

function resetKeypoints() {
    if (originalAnnotation) {
        annotationData = JSON.parse(JSON.stringify(originalAnnotation));
        drawCanvas();
    }
}

async function saveCharacter() {
    if (!currentOutDir || !annotationData) return;

    const res = await fetch('/api/fixer/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outDir: currentOutDir, annotationData: annotationData })
    });
    
    if (res.ok) {
        alert("Character saved successfully!");
    }
}

async function loadMotions() {
    const res = await fetch('/api/engine/motions');
    const data = await res.json();
    
    const listEl = document.getElementById('animations-list');
    listEl.innerHTML = '';
    
    data.motions.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerText = '▶ ' + m;
        btn.onclick = () => previewAnimation(m);
        listEl.appendChild(btn);
    });
}

async function previewAnimation(motion) {
    if (!currentOutDir) return;

    const container = document.getElementById('preview-container');
    const img = document.getElementById('preview-gif');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    
    container.style.display = 'block';
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressBar.innerText = '0%';
    img.style.display = 'none';
    img.src = '';
    img.alt = 'Rendering...';

    try {
        const response = await fetch('/api/engine/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outDir: currentOutDir, motion: motion })
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.progress !== undefined) {
                            progressBar.style.width = data.progress + '%';
                            progressBar.innerText = data.progress + '%';
                        } else if (data.done) {
                            progressContainer.style.display = 'none';
                            img.style.display = 'block';
                            img.src = data.url + "&t=" + new Date().getTime();
                            
                            // Add to history
                            addToHistory(motion, img.src);
                        } else if (data.error) {
                            progressContainer.style.display = 'none';
                            img.style.display = 'block';
                            img.alt = "Failed: " + data.error;
                        }
                    } catch (e) {} // skip invalid json
                }
            }
        }
    } catch (err) {
        progressContainer.style.display = 'none';
        img.style.display = 'block';
        img.alt = "Network error";
    }
}

function addToHistory(motion, url) {
    const historyList = document.getElementById('history-list');
    
    // Clear placeholder text if it's the first one
    if (historyList.querySelector('p')) {
        historyList.innerHTML = '';
    }
    
    const wrapper = document.createElement('div');
    wrapper.style.minWidth = '80px';
    wrapper.style.textAlign = 'center';
    
    const thumb = document.createElement('img');
    thumb.src = url;
    thumb.style.width = '80px';
    thumb.style.height = '80px';
    thumb.style.objectFit = 'cover';
    thumb.style.borderRadius = '8px';
    thumb.style.border = '1px solid #ddd';
    thumb.style.cursor = 'pointer';
    thumb.onclick = () => {
        document.getElementById('preview-gif').src = url;
    };
    
    const label = document.createElement('div');
    label.innerText = motion;
    label.style.fontSize = '0.7rem';
    label.style.marginTop = '4px';
    label.style.color = '#555';
    
    wrapper.appendChild(thumb);
    wrapper.appendChild(label);
    historyList.prepend(wrapper); // Add to beginning
}
