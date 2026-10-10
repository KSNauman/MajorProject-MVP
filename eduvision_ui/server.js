const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 3000;

const REPO_ROOT = path.resolve(__dirname, '../Actual repo (EDUVISION)/AnimatedDrawings');
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples');
const TORCHSERVE_DIR = path.join(REPO_ROOT, 'torchserve');

const PYTHON_BIN = 'python';

// Utility to dynamically toggle GPU visibility for Python processes based on UI request
function getSpawnEnv(req) {
    const env = Object.assign({}, process.env);
    if (req && req.body && (req.body.useGpu === false || req.body.useGpu === 'false' || req.body.useGpu === undefined)) {
        // We assume CPU fallback if not explicitly true
        // But let's check if the client sent 'useGpu' at all. If it sent 'true', enable GPU.
        if (req.body.useGpu === true || req.body.useGpu === 'true') {
            // Keep GPU
        } else {
            env['USE_GPU'] = 'false';
            env['CUDA_VISIBLE_DEVICES'] = ''; // Ensure it isn't set to -1
        }
    }
    return env;
}

const TORCHSERVE_BIN = '/home/champion/anaconda3/envs/animated_drawings/bin/torchserve';

// Middleware
app.use(cors());
app.use(express.json());

const jobs = {};

const SLOT_MOTIONS = {
    rahim: "idel,wave,jump",
    sister: "sleep",
    mother: "opening",
    grandma: "walk_in_circle",
    father: "opening",
    grandpa: "walk_in_circle"
};


function parseLogs(jobId, data) {
    const lines = data.toString().split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        if (line.trim().startsWith('{')) {
            try {
                const evt = JSON.parse(line);
                if (evt.progress_event) {
                    jobs[jobId].stage = evt.stage;
                    jobs[jobId].message = evt.message;
                    jobs[jobId].logs.push(evt);
                } else if (evt.charDir) {
                    jobs[jobId].charDir = evt.charDir;
                } else if (evt.finalVideoUrl) {
                    jobs[jobId].finalVideoUrl = evt.finalVideoUrl;
                }
            } catch (e) {
                console.log(line);
            }
        } else {
            console.log(line);
        }
    }
}

app.get('/api/jobs/:id', (req, res) => {
    const job = jobs[req.params.id];
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Set up Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'input_' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// TorchServe Manager
// ==========================================
let torchserveProcess = null;

function startTorchServe() {
    console.log("Ensuring TorchServe is cleanly started...");
    
    // First, stop any zombie processes or clear stale lockfiles
    const stopProcess = spawn(TORCHSERVE_BIN, ['--stop'], { cwd: TORCHSERVE_DIR });
    
    stopProcess.on('close', () => {
        torchserveProcess = spawn(TORCHSERVE_BIN, ['--start', '--ts-config', 'config.local.properties', '--foreground'], {
            cwd: TORCHSERVE_DIR,
          env: getSpawnEnv(req)
      });

    let tsOutput = "";

    torchserveProcess.stdout.on('data', (data) => {
        const text = data.toString();
        tsOutput += text;
        if(text.includes('Model server started')) {
            console.log("✅ TorchServe is online and ready.");
        }
    });

    torchserveProcess.stderr.on('data', (data) => {
        tsOutput += data.toString();
    });

    torchserveProcess.on('close', (code) => {
        if (code === 1 && tsOutput.includes("TorchServe is already running")) {
            console.log("✅ TorchServe is already running in the background.");
        } else if (code !== 0) {
            console.log(`⚠️ TorchServe process exited with code ${code}. If pose estimation fails, try restarting it manually.`);
        }
    });
    });
}

// ==========================================
// API Endpoints
// ==========================================

// Story: Generate final video

// Batch preparation
app.post('/api/story/prepare', upload.any(), (req, res) => {
    const files = req.files || [];
    const body = req.body || {};
    const jobId = 'job_batch_' + Date.now();
    
    // Determine all slots (files + existing)
    const slots = {};
    for (const file of files) {
        slots[file.fieldname] = { type: 'new', file: file };
    }
    for (const key of Object.keys(body)) {
        if (key.startsWith('existing_')) {
            const slotName = key.replace('existing_', '');
            if (!slots[slotName]) {
                slots[slotName] = { type: 'existing', charDir: body[key] };
            }
        }
    }
    
    jobs[jobId] = { 
        id: jobId, 
        status: 'RUNNING', 
        stage: 'QUEUED', 
        message: 'Starting batch preparation...', 
        characters: {},
        logs: [] 
    };
    
    for (const slot of Object.keys(slots)) {
        jobs[jobId].characters[slot] = {
            status: 'QUEUED',
            stage: 'QUEUED',
            message: 'Queued'
        };
    }
    
    res.json({ success: true, jobId: jobId });
    
    // Background async processing
    (async () => {
        const storyScriptDir = path.resolve(__dirname, '../story_engine');
        let failed = false;
        
        const CONCURRENCY = 2;
        
        async function processSlot(slot, data) {
            jobs[jobId].characters[slot].status = 'RUNNING';
            
            try {
                let charDir = null;
                
                if (data.type === 'new') {
                    jobs[jobId].characters[slot].stage = 'PREPROCESSING';
                    jobs[jobId].characters[slot].message = 'Preparing character...';
                    
                    const imgPath = path.resolve(__dirname, data.file.path);
                    charDir = await new Promise((resolve, reject) => {
                        let outCharDir = null;
                        const py = spawn(PYTHON_BIN, ['prepare_character_api.py', imgPath, 'dummy', 'none', jobId], { cwd: storyScriptDir });
                        
                        py.stdout.on('data', d => {
                            const lines = d.toString().split('\n');
                            for (const line of lines) {
                                if (line.trim().startsWith('{')) {
                                    try {
                                        const evt = JSON.parse(line.trim());
                                        if (evt.charDir) outCharDir = evt.charDir;
                                        if (evt.progress_event) {
                                            jobs[jobId].characters[slot].stage = evt.stage;
                                            jobs[jobId].characters[slot].message = evt.message;
                                        }
                                    } catch(e){}
                                }
                            }
                        });
                        
                        py.on('close', code => {
                            if (code === 0 && outCharDir) resolve(outCharDir);
                            else reject('Extraction failed');
                        });
                    });
                } else {
                    charDir = data.charDir;
                    jobs[jobId].characters[slot].stage = 'PREPROCESSING_COMPLETED';
                    jobs[jobId].characters[slot].message = '✓ Using existing character';
                }
                
                jobs[jobId].characters[slot].stage = 'GENERATING_ANIMATION';
                jobs[jobId].characters[slot].message = 'Checking cache and generating animations...';
                
                await new Promise((resolve, reject) => {
                    // Pass slot-specific motions to batch_animate
                    const batchArgs = ['batch_animate.py', charDir, jobId];
                    if (SLOT_MOTIONS[slot]) {
                        batchArgs.push('--motions', SLOT_MOTIONS[slot], '--slot', slot);
                    }
                    const batch = spawn(PYTHON_BIN, batchArgs, { cwd: storyScriptDir });
                    batch.stdout.on('data', d => {
                        const lines = d.toString().split('\n');
                        for (const line of lines) {
                            if (line.trim().startsWith('{')) {
                                try {
                                    const evt = JSON.parse(line.trim());
                                    if (evt.progress_event) {
                                        jobs[jobId].characters[slot].stage = evt.stage;
                                        // Highlight cache hits
                                        if (evt.message && evt.message.includes("Cache hit")) {
                                            jobs[jobId].characters[slot].message = "✓ Animation cache hit (" + evt.message.split('for ')[1] + ")";
                                        } else {
                                            jobs[jobId].characters[slot].message = evt.message;
                                        }
                                    }
                                } catch(e){}
                            }
                        }
                    });
                    batch.on('close', code => {
                        if (code === 0) resolve();
                        else reject('Batch animation failed');
                    });
                });
                
                jobs[jobId].characters[slot].status = 'READY';
                jobs[jobId].characters[slot].stage = 'COMPLETED';
                jobs[jobId].characters[slot].message = 'Ready';
                jobs[jobId].characters[slot].charDir = charDir;
                
            } catch (err) {
                console.error("Slot failed:", slot, err);
                jobs[jobId].characters[slot].status = 'FAILED';
                jobs[jobId].characters[slot].message = err.toString();
                failed = true;
            }
        }
        
        // Bounded-concurrent execution
        const queue = Object.entries(slots);
        const active = new Set();
        
        while (queue.length > 0 || active.size > 0) {
            while (queue.length > 0 && active.size < CONCURRENCY) {
                const [s, d] = queue.shift();
                const p = processSlot(s, d).finally(() => active.delete(p));
                active.add(p);
            }
            if (active.size > 0) {
                await Promise.race(active);
            }
        }
        
        jobs[jobId].status = failed ? 'FAILED' : 'COMPLETED';
        jobs[jobId].stage = 'COMPLETED';
        jobs[jobId].message = failed ? 'Some characters failed' : 'All characters ready';
    })();
});

app.post('/api/story/generate', (req, res) => {
    console.log("Generating story...");
    const storyScriptDir = path.resolve(__dirname, '../story_engine');
    const pyProcess = spawn(PYTHON_BIN, ['run_all.py'], {
        cwd: storyScriptDir,
          env: getSpawnEnv(req)
      });

    pyProcess.stdout.on('data', data => parseLogs(jobId, data));
    pyProcess.stderr.on('data', data => console.error("STORY ERR:", data.toString()));

    pyProcess.on('close', code => {
        if (code === 0) {
            jobs[jobId].status = 'COMPLETED';
            jobs[jobId].stage = 'COMPLETED';
        } else {
            jobs[jobId].status = 'FAILED';
            jobs[jobId].error = 'Story generation failed';
        }
    });
});

// Fixer: Upload image and run keypoint estimation
// Get recent stories
app.get('/api/story/recent', (req, res) => {
    const outputDir = path.resolve(__dirname, '../story_engine/output');
    if (!fs.existsSync(outputDir)) return res.json({ stories: [] });
    
    const files = fs.readdirSync(outputDir)
        .filter(f => f.endsWith('.mp4'))
        .map(f => {
            const filePath = path.join(outputDir, f);
            const stat = fs.statSync(filePath);
            return {
                name: f,
                url: "/api/files?path=" + encodeURIComponent(filePath),
                date: stat.mtime
            };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());
        
    res.json({ stories: files });
});

app.post('/api/fixer/extract', upload.single('image'), (req, res) => {
    console.log("Running Robust Engine Extraction...");
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    
    const imgPath = path.resolve(__dirname, req.file.path);
    const storyScriptDir = path.resolve(__dirname, '../story_engine');
    
    // We will use a quick python helper to run the engine, copy the texture, and return JSON.
    const pyProcess = spawn(PYTHON_BIN, ['robust_extract_api.py', imgPath], {
        cwd: storyScriptDir,
          env: getSpawnEnv(req)
      });
    
    let output = '';
    pyProcess.stdout.on('data', data => output += data.toString());
    pyProcess.on('close', code => {
        try {
            const jsonStr = output.substring(output.indexOf('{'), output.lastIndexOf('}') + 1);
            const result = JSON.parse(jsonStr);
            if (code !== 0) return res.status(500).json(result);
            res.json(result);
        } catch(e) {
            console.error(e);
            res.status(500).json({ error: "Failed to parse Python output.", output });
        }
    });
});

// Fixer: Save corrected JSON
app.post('/api/fixer/save', upload.single('image'), (req, res) => {
    console.log("Saving and Animating final fixed character image...");
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    
    const imgPath = path.resolve(__dirname, req.file.path);
    const storyScriptDir = path.resolve(__dirname, '../story_engine');
    
    const jobId = 'job_save_' + Date.now();
    let kpsArg = "none";
    if (req.body.keypoints) {
        const tempKpsFile = path.resolve(__dirname, 'uploads', 'kps_' + jobId + '.json');
        fs.writeFileSync(tempKpsFile, req.body.keypoints);
        kpsArg = tempKpsFile;
    }
    jobs[jobId] = { id: jobId, status: 'RUNNING', stage: 'QUEUED', message: 'Starting character extraction...', logs: [] };
    res.json({ success: true, jobId: jobId });
    
    console.log("Spawning prepare_character_api.py without shell...");
    const pyProcess = spawn(PYTHON_BIN, ['prepare_character_api.py', imgPath, 'dummy', kpsArg], {
        cwd: storyScriptDir,
          env: getSpawnEnv(req)
      });
    
    pyProcess.stdout.on('data', data => parseLogs(jobId, data));
    pyProcess.stderr.on('data', data => console.error("PY STDERR:", data.toString()));
    
    pyProcess.on('close', code => {
        if (code !== 0) {
            jobs[jobId].status = 'FAILED';
            jobs[jobId].error = 'Extraction failed';
            return;
        }
        
        // Spawn batch_animate
        if (!jobs[jobId].charDir) {
            jobs[jobId].status = 'FAILED';
            jobs[jobId].error = 'Missing character directory from python';
            return;
        }
        
        // If a slot was provided (from Story-launched Fixer), only generate required motions
        const slot = req.body.slot;
        if (slot && SLOT_MOTIONS[slot]) {
            jobs[jobId].stage = 'GENERATING_ANIMATION';
            jobs[jobId].message = 'Spawning animation cache generation...';
            
            const batchArgs = ['batch_animate.py', jobs[jobId].charDir, jobId];
            batchArgs.push('--motions', SLOT_MOTIONS[slot], '--slot', slot);
            console.log('Fixer save: slot=' + slot + ', motions=' + SLOT_MOTIONS[slot]);
            
            const batchProcess = spawn(PYTHON_BIN, batchArgs, {
                cwd: storyScriptDir
            });
            batchProcess.stdout.on('data', data => parseLogs(jobId, data));
            batchProcess.on('close', bcode => {
                if (bcode === 0) {
                    jobs[jobId].status = 'COMPLETED';
                    jobs[jobId].stage = 'COMPLETED';
                    jobs[jobId].message = 'Character fully prepared and animated';
                } else {
                    jobs[jobId].status = 'FAILED';
                    jobs[jobId].error = 'Batch animation failed';
                }
            });
        } else {
            console.log('Fixer save: no story slot, standalone mode. Skipping animation generation.');
            jobs[jobId].status = 'COMPLETED';
            jobs[jobId].stage = 'COMPLETED';
            jobs[jobId].message = 'Character prepared successfully';
        }
    });
});

// Engine: Get recent animations
app.get('/api/engine/recent', (req, res) => {
    const uploadDir = path.join(__dirname, 'uploads');
    const recent = [];
    if (fs.existsSync(uploadDir)) {
        const dirs = fs.readdirSync(uploadDir);
        for (const dir of dirs) {
            if (dir.startsWith('char_data_')) {
                const charPath = path.join(uploadDir, dir);
                if (fs.existsSync(charPath)) {
                    const files = fs.readdirSync(charPath);
                    for (const file of files) {
                        if (file.startsWith('video') && file.endsWith('.gif')) {
                            const gifPath = path.join(charPath, file);
                            recent.push({
                                id: dir,
                                url: `/uploads/${dir}/${file}`,
                                time: fs.statSync(gifPath).mtimeMs
                            });
                        }
                    }
                }
            }
        }
    }
    // Sort newest first
    recent.sort((a, b) => b.time - a.time);
    res.json({ recent });
});

// Engine: List available BVH motions
app.get('/api/engine/motions', (req, res) => {
    const motionDir = path.join(EXAMPLES_DIR, 'config', 'motion');
    if (!fs.existsSync(motionDir)) return res.json({ motions: [] });

    const unsupported = ['angry'];
    const motions = fs.readdirSync(motionDir)
        .filter(f => f.endsWith('.yaml'))
        .map(f => {
            const id = f.replace('.yaml', '');
            return id;
        })
        .filter(id => !unsupported.includes(id))
        .map(id => {
            const name = id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            return { id, name };
        });
    
    res.json({ motions });
});

// Engine: Preview animation
app.post('/api/engine/preview', (req, res) => {
    const { outDir, motion } = req.body;
    if (!outDir || !motion) return res.status(400).json({ error: "Missing data" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const gifOut = path.join(outDir, 'video.gif');
    console.log(`Rendering animation ${motion} for ${outDir}...`);

    const motionYaml = `examples/config/motion/${motion}.yaml`;
    const motionYamlPath = path.join(REPO_ROOT, motionYaml);
    
    let retargetYaml = `examples/config/retarget/fair1_ppf.yaml`; 
    try {
        const motionConfig = yaml.load(fs.readFileSync(motionYamlPath, 'utf8'));
        const bvhPath = (motionConfig.filepath || "").toLowerCase();
        if (bvhPath.includes('mixamo') || bvhPath.includes('rokoko')) {
            retargetYaml = `examples/config/retarget/mixamo_fff.yaml`;
        } else if (bvhPath.includes('cmu')) {
            retargetYaml = `examples/config/retarget/cmu1_pfp.yaml`;
        }
    } catch (e) {
        console.error(`Failed to parse ${motionYaml} for dynamic retargeting. Defaulting to FAIR.`, e);
    }

    const pyProcess = spawn(PYTHON_BIN, ['examples/annotations_to_animation.py', outDir, motionYaml, retargetYaml], {
        cwd: REPO_ROOT,
          env: getSpawnEnv(req)
      });

    let output = '';
    pyProcess.stderr.on('data', data => {
        const text = data.toString();
        output += text;
        const matches = text.match(/(\d+)%/g);
        if (matches && matches.length > 0) {
            const num = matches[matches.length - 1].replace('%', '');
            res.write(`data: {"progress": ${num}}\n\n`);
        }
    });

    pyProcess.on('close', code => {
        console.log(`[ENGINE PREVIEW] Python script finished with exit code ${code}`);
        if (code !== 0) {
            console.error(`[ENGINE PREVIEW ERROR OUTPUT]\n${output}\n-------------------------`);
            res.write(`data: {"error": "Rendering failed"}\n\n`);
            res.end();
        } else {
            const charId = path.basename(outDir);
            const newGifName = `video_${motion}_${Date.now()}.gif`;
            const newGifPath = path.join(outDir, newGifName);
            if (fs.existsSync(gifOut)) {
                fs.renameSync(gifOut, newGifPath);
            }
            const gifUrl = `/uploads/${charId}/${newGifName}`;
            res.write(`data: {"status": "done", "gifUrl": "${gifUrl}"}\n\n`);
            res.end();
        }
    });
});


// Engine: Delete recent animation
app.delete('/api/engine/recent/:id', (req, res) => {
    const charId = req.params.id;
    if (!charId || !charId.startsWith('char_data_')) return res.status(400).json({error: "Invalid ID"});
    
    const charPath = path.join(__dirname, 'uploads', charId);
    if (fs.existsSync(charPath)) {
        try {
            fs.rmSync(charPath, { recursive: true, force: true });
            res.json({ success: true });
        } catch(e) {
            console.error(e);
            res.status(500).json({ error: "Failed to delete" });
        }
    } else {
        res.json({ success: true }); // Already gone
    }
});

// Utility to serve files outside public dir safely
app.get('/api/files', (req, res) => {
    if (!req.query.path) return res.status(403).json({ error: "Forbidden" });
    const filePath = path.resolve(req.query.path);
    
    const filePathLower = filePath.toLowerCase();
    const uploadsDirLower = path.join(__dirname, 'uploads').toLowerCase();
    const engineDirLower = path.resolve(__dirname, '../story_engine').toLowerCase();
    const charsDirLower = path.resolve(__dirname, '../characters').toLowerCase();

    if (!filePathLower.startsWith(uploadsDirLower) && 
        !filePathLower.startsWith(engineDirLower) && 
        !filePathLower.startsWith(charsDirLower)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Not Found" });
    }
    
    res.sendFile(filePath);
});

// Fallback to index.html for SPA-like navigation
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        next();
    }
});

// Start Server and TorchServe
app.listen(PORT, () => {
    console.log(`EduVision Minimal UI running on http://localhost:${PORT}`);
    // startTorchServe();
});


