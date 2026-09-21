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
app.post('/api/story/generate', (req, res) => {
    console.log("Generating story...");
    const storyScriptDir = path.resolve(__dirname, '../story_engine');
    const pyProcess = spawn(PYTHON_BIN, ['run_all.py'], {
        cwd: storyScriptDir,
          env: getSpawnEnv(req)
      });

    let output = '';
    pyProcess.stdout.on('data', data => output += data.toString());
    pyProcess.stderr.on('data', data => output += data.toString());

    pyProcess.on('close', code => {
        console.log(`[STORY ENGINE] Python script finished with exit code ${code}`);
        if (code !== 0) {
            console.error(`[STORY ENGINE ERROR OUTPUT]\n${output}\n-------------------------`);
            return res.status(500).json({ error: "Story generation failed." });
        }
                // Find latest mp4 in output dir
        const outputDir = path.join(storyScriptDir, 'output');
        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp4'));
        files.sort((a, b) => fs.statSync(path.join(outputDir, b)).mtime.getTime() - fs.statSync(path.join(outputDir, a)).mtime.getTime());
        const latestFile = files.length > 0 ? files[0] : 'rahims_story_final.mp4';
        res.json({ message: "Success", url: "/api/files?path=" + encodeURIComponent(path.join(outputDir, latestFile)) });
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
    
    // Check if custom keypoints were provided
    let kpsArg = "none";
    if (req.body.keypoints) {
        // We write them to a temp file because passing JSON strings via command line can break in Windows
        const tempKpsFile = path.resolve(__dirname, 'uploads', `kps_${Date.now()}.json`);
        fs.writeFileSync(tempKpsFile, req.body.keypoints);
        // Wait, fs is required at top! Let's just use fs.
        kpsArg = tempKpsFile;
    }
    
    console.log("Spawning prepare_character_api.py without shell...");
    const pyProcess = spawn(PYTHON_BIN, ['prepare_character_api.py', imgPath, 'dummy', kpsArg], {
        cwd: storyScriptDir,
          env: getSpawnEnv(req)
      });
    
    let output = '';
    pyProcess.stdout.on('data', data => output += data.toString());
    pyProcess.stderr.on('data', data => console.error("PY STDERR:", data.toString()));
    pyProcess.on('close', code => {
        console.log("Python exit code:", code, "Output:", output);
        try {
            const jsonStr = output.substring(output.indexOf('{'), output.lastIndexOf('}') + 1);
            const result = JSON.parse(jsonStr);
            if (code !== 0) return res.status(500).json(result);
            res.json(result);
        } catch(e) {
            console.error("Parse error:", e);
            res.status(500).json({ error: "Failed to generate animation.", output });
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

    const motions = fs.readdirSync(motionDir)
        .filter(f => f.endsWith('.yaml'))
        .map(f => {
            const id = f.replace('.yaml', '');
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
    const filePath = req.query.path;
    if (!filePath || (!filePath.startsWith(path.join(__dirname, 'uploads')) && !filePath.startsWith(path.resolve(__dirname, '../story_engine')) && !filePath.startsWith(path.resolve(__dirname, '../characters')))) {
        return res.status(403).json({ error: "Forbidden" });
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


