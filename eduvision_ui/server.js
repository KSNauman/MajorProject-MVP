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

const PYTHON_BIN = '/home/champion/anaconda3/envs/animated_drawings/bin/python';
const TORCHSERVE_BIN = '/home/champion/anaconda3/envs/animated_drawings/bin/torchserve';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
            cwd: TORCHSERVE_DIR
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
app.post('/api/story/generate', upload.any(), (req, res) => {
    console.log("Generating story...");
    // For MVP phase, just invoke park_story.py
    // In a real implementation, we would parse req.files to override defaults.
    const storyScriptDir = path.resolve(__dirname, '../story_engine');
    const pyProcess = spawn(PYTHON_BIN, ['run_all.py'], {
        cwd: storyScriptDir
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
        res.json({ message: "Success", url: "/api/files?path=" + encodeURIComponent(path.join(storyScriptDir, 'output', 'park_story_final.mp4')) });
    });
});

// Fixer: Upload image and run keypoint estimation
app.post('/api/fixer/upload', upload.single('character'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const imgPath = req.file.path;
    const outDir = path.join(__dirname, 'uploads', 'char_out_' + Date.now());

    console.log(`Running keypoint extraction on ${imgPath}...`);
    
    const pyProcess = spawn(PYTHON_BIN, ['examples/image_to_annotations.py', imgPath, outDir], {
        cwd: REPO_ROOT
    });

    let output = '';
    pyProcess.stdout.on('data', data => output += data.toString());
    pyProcess.stderr.on('data', data => output += data.toString());

    pyProcess.on('close', code => {
        console.log(`[FIXER EXTRACT] Python script finished with exit code ${code}`);
        if (code !== 0) {
            console.error(`[FIXER EXTRACT ERROR OUTPUT]\n${output}\n-------------------------`);
            return res.status(500).json({ error: "Failed to extract keypoints. Ensure TorchServe is fully started." });
        }
        
        // Convert char_cfg.yaml to annotation.json for the frontend
        try {
            const yamlContent = fs.readFileSync(path.join(outDir, 'char_cfg.yaml'), 'utf8');
            const data = yaml.load(yamlContent);
            fs.writeFileSync(path.join(outDir, 'annotation.json'), JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("YAML Parse Error:", e);
        }
        
        // Output is successful, return the annotation paths
        res.json({
            message: "Success",
            outDir: outDir,
            annotationUrl: `/api/files?path=${encodeURIComponent(path.join(outDir, 'annotation.json'))}`,
            maskUrl: `/api/files?path=${encodeURIComponent(path.join(outDir, 'mask.png'))}`,
            textureUrl: `/api/files?path=${encodeURIComponent(path.join(outDir, 'texture.png'))}`
        });
    });
});

// Fixer: Save corrected JSON
app.post('/api/fixer/save', (req, res) => {
    const { outDir, annotationData } = req.body;
    if (!outDir || !annotationData) return res.status(400).json({ error: "Missing data" });

    const annPath = path.join(outDir, 'annotation.json');
    const yamlPath = path.join(outDir, 'char_cfg.yaml');
    
    fs.writeFileSync(annPath, JSON.stringify(annotationData, null, 4));
    fs.writeFileSync(yamlPath, yaml.dump(annotationData));
    
    res.json({ message: "Annotation saved successfully" });
});

// Engine: List available BVH motions
app.get('/api/engine/motions', (req, res) => {
    const motionDir = path.join(EXAMPLES_DIR, 'config', 'motion');
    if (!fs.existsSync(motionDir)) return res.json({ motions: [] });

    const motions = fs.readdirSync(motionDir)
        .filter(f => f.endsWith('.yaml'))
        .map(f => f.replace('.yaml', ''));
    
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
    
    // Dynamically determine retarget config by inspecting the BVH path inside the motion YAML
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
        cwd: REPO_ROOT
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
            const gifUrl = `/api/files?path=${encodeURIComponent(gifOut)}`;
            res.write(`data: {"done": true, "url": "${gifUrl}"}\n\n`);
            res.end();
        }
    });
});

// Utility to serve files outside public dir safely
app.get('/api/files', (req, res) => {
    const filePath = req.query.path;
    if (!filePath || !filePath.startsWith(path.join(__dirname, 'uploads'))) {
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
    startTorchServe();
});
