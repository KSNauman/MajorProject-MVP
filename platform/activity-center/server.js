const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

// Static serving for activity assets
app.use(express.static(path.join(__dirname, 'public')));

// Serve pre-cached character animation GIFs directly from characters directory
const CHARACTERS_DIR = path.resolve(__dirname, '../../characters');
if (fs.existsSync(CHARACTERS_DIR)) {
    app.use('/characters', express.static(CHARACTERS_DIR));
}

// Activity Metadata Registry
const ACTIVITIES = [
    {
        id: 'story-studio',
        name: "Story Studio: Rahim's Family",
        category: 'Creative Arts & Animation',
        icon: '📖',
        color: '#ec4899',
        description: 'Bring drawings of Rahim and family to life in an animated video story!',
        path: 'http://localhost:3001/'
    },
    {
        id: 'color-filling',
        name: 'Humanoid Color & Animate Studio',
        category: 'Creative Arts & Animation',
        icon: '🎨',
        color: '#d946ef',
        description: 'Color your humanoid drawing, select an animation motion loop, and bring it to life!',
        path: '/activities/color-filling.html'
    },
    {
        id: 'color-matcher',
        name: 'Humanoid Color Matcher',
        category: 'Colors & Physics',
        icon: '🧒',
        color: '#e11d48',
        description: 'Hold humanoid shapes to wiggle and place in matching color pedestals for winning jumps!',
        path: '/activities/color-matcher.html'
    },
    {
        id: 'shape-spotter',
        name: 'Humanoid Spotter Detective',
        category: 'Vision & Reasoning',
        icon: '🔍',
        color: '#f59e0b',
        description: 'Spot target humanoid friends in the scattered group. Wrong picks animate sadly, correct picks jump joyfully!',
        path: '/activities/shape-spotter.html'
    },
    {
        id: 'objects-counting',
        name: 'Humanoid Count & Play',
        category: 'Math & Handwriting',
        icon: '🎈',
        color: '#6366f1',
        description: 'Count scattered humanoid drawings using ML handwriting or keypad to make all characters dance!',
        path: '/activities/objects-counting.html'
    },
    {
        id: 'puzzle-builder',
        name: 'Humanoid Jigsaw Puzzle',
        category: 'Spatial Reasoning',
        icon: '🧩',
        color: '#7c3aed',
        description: 'Snap humanoid puzzle pieces together to watch the character animate right inside the frame!',
        path: '/activities/puzzle-builder.html'
    },
    {
        id: 'number-sequencing',
        name: 'Humanoid Train Builder',
        category: 'Math & Numbers',
        icon: '🚂',
        color: '#0891b2',
        description: 'Build ascending number tracks led by Conductor Rahim waving from the locomotive!',
        path: '/activities/number-sequencing.html'
    }
];

app.get('/api/activities', (req, res) => {
    res.json(ACTIVITIES);
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'eduvision-activity-center', count: ACTIVITIES.length });
});

// Single Activity Direct Redirect
app.get('/activity/:id', (req, res) => {
    const act = ACTIVITIES.find(a => a.id === req.params.id);
    if (!act) return res.redirect('/index.html');
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    if (act.path.startsWith('http://') || act.path.startsWith('https://')) { return res.redirect(`${act.path}${query}`); }
    res.redirect(`${act.path}${query}`);
});

// Legacy redirect for fruits-matching
app.get('/activities/fruits-matching.html', (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/activities/color-matcher.html${query}`);
});

let digitsDataset = null;
try {
    const knnPath = path.join(__dirname, 'public/js/digits_knn.json');
    if (fs.existsSync(knnPath)) {
        digitsDataset = JSON.parse(fs.readFileSync(knnPath, 'utf8'));
        console.log(`[ActivityCenter] Loaded ${digitsDataset.y.length} ML digit training vectors.`);
    }
} catch(e) {
    console.error('Failed to pre-load digits_knn.json:', e);
}

app.post('/api/recognize-digit', (req, res) => {
    const { features } = req.body;
    if (!features || !Array.isArray(features) || features.length !== 64 || !digitsDataset) {
        return res.status(400).json({ error: 'Invalid features array (requires 64 normalized values)' });
    }
    
    // Exact k-NN matching scikit-learn KNeighborsClassifier(n_neighbors=3, weights='distance')
    const distances = digitsDataset.X.map((sample, idx) => {
        let sumSq = 0;
        for (let j = 0; j < 64; j++) {
            const d = features[j] - sample[j];
            sumSq += d * d;
        }
        return { dist: Math.sqrt(sumSq), label: digitsDataset.y[idx] };
    });
    distances.sort((a, b) => a.dist - b.dist);
    const votes = {};
    for (let i = 0; i < 3; i++) {
        const neighbor = distances[i];
        const weight = 1.0 / (neighbor.dist + 1e-5);
        votes[neighbor.label] = (votes[neighbor.label] || 0) + weight;
    }
    let bestDigit = 0, maxW = -1;
    for (const [digit, weight] of Object.entries(votes)) {
        if (weight > maxW) { maxW = weight; bestDigit = parseInt(digit); }
    }
    res.json({ digit: bestDigit, nearestDist: distances[0].dist });
});

// Core Animation Engine API: Animate Any Drawing, Colored Sketch, or Photo
app.post('/api/animate-drawing', (req, res) => {
    try {
        const { image, motion = 'jump', charName = 'custom' } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'Missing image data' });
        }

        const charId = 'anim_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const charDir = path.join(__dirname, 'public/uploads/custom_characters', charId);
        fs.mkdirSync(charDir, { recursive: true });

        // Decode base64 image
        let imageBuffer;
        const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            imageBuffer = Buffer.from(matches[2], 'base64');
        } else {
            imageBuffer = Buffer.from(image, 'base64');
        }

        const inputImgPath = path.join(charDir, 'input.png');
        fs.writeFileSync(inputImgPath, imageBuffer);

        const storyEngineScript = path.resolve(__dirname, '../../story_engine/animate_drawing_service.py');
        console.log(`[AnimationEngine] Rendering ${motion} animation for drawing ${charId}...`);

        const { spawn } = require('child_process');
        const py = spawn('python', [storyEngineScript, inputImgPath, charDir, motion], {
            cwd: path.resolve(__dirname, '../../story_engine')
        });

        let stdoutData = '';
        let stderrData = '';
        py.stdout.on('data', (d) => { stdoutData += d.toString(); });
        py.stderr.on('data', (d) => { stderrData += d.toString(); });

        py.on('close', (code) => {
            console.log(`[AnimationEngine] Process completed with code ${code}`);
            const gifRelativeUrl = `/uploads/custom_characters/${charId}/animations/${motion}.gif`;
            const gifDiskPath = path.join(charDir, 'animations', `${motion}.gif`);

            if (fs.existsSync(gifDiskPath) && fs.statSync(gifDiskPath).size > 0) {
                console.log(`[AnimationEngine] Generated animation GIF: ${gifRelativeUrl}`);
                return res.json({
                    success: true,
                    gifUrl: gifRelativeUrl,
                    charId,
                    motion,
                    message: 'Drawing animated successfully by Core Animation Engine!'
                });
            } else {
                console.error('[AnimationEngine] Rendering error output:', stderrData || stdoutData);
                return res.status(500).json({
                    error: 'Failed to generate animation GIF',
                    details: stderrData || stdoutData
                });
            }
        });
    } catch (err) {
        console.error('[AnimationEngine] Server exception:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Backward-compatible alias
app.post('/api/animate-colored-humanoid', (req, res, next) => {
    if (req.body.image) {
        return app._router.handle({ ...req, url: '/api/animate-drawing' }, res, next);
    }
    res.json({ success: true, message: 'Received' });
});

app.listen(PORT, () => {
    console.log(`EduVision Activity Center listening on port ${PORT}`);
});
