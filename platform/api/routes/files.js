const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');

// Helper to authenticate user from header or query param
function authenticateRequest(req) {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return { error: 'Unauthorized: Authentication token is required', status: 401 };
    }

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET || 'eduvision-secret-dev-key');
        return { user };
    } catch (err) {
        return { error: 'Unauthorized: Invalid or expired token', status: 401 };
    }
}

// Helper to verify authorization to access a student's story
async function authorizeStoryAccess(user, story) {
    if (user.role === 'ADMIN' || user.role === 'TEACHER') {
        return true;
    }

    if (user.role === 'STUDENT') {
        return (user.id === story.userId || user.userId === story.userId);
    }

    if (user.role === 'PARENT') {
        const link = await prisma.parentChild.findUnique({
            where: {
                parentId_childId: {
                    parentId: user.id || user.userId,
                    childId: story.userId
                }
            }
        });
        return !!link;
    }

    return false;
}

// GET /api/files?storyId=... OR /api/files?path=...
// Serves generated video and asset files safely with range requests and relational authorization
router.get('/', async (req, res) => {
    const { storyId, path: rawPath } = req.query;

    if (!storyId && !rawPath) {
        return res.status(400).json({ error: 'Either storyId or path parameter is required' });
    }

    // Allowed base directories: story_engine, characters, uploads
    const baseDir = path.resolve(__dirname, '../../..');
    const engineDirLower = path.resolve(baseDir, 'story_engine').toLowerCase();
    const charsDirLower = path.resolve(baseDir, 'characters').toLowerCase();
    const uploadsDirLower = path.resolve(baseDir, 'eduvision_ui/uploads').toLowerCase();
    const rootUploadsLower = path.resolve(baseDir, 'uploads').toLowerCase();

    // 1. If path is provided, validate directory traversal and whitelist first
    if (rawPath) {
        const resolvedPath = path.resolve(rawPath);
        const resolvedLower = resolvedPath.toLowerCase();
        const isAllowed = 
            resolvedLower.startsWith(engineDirLower) || 
            resolvedLower.startsWith(charsDirLower) || 
            resolvedLower.startsWith(uploadsDirLower) ||
            resolvedLower.startsWith(rootUploadsLower);

        if (!isAllowed) {
            logger.warn(`Forbidden file access attempt: ${resolvedPath}`);
            return res.status(403).json({ error: 'Forbidden: Access outside allowed directories is denied' });
        }
    }

    // 2. Authenticate the requester
    const authResult = authenticateRequest(req);
    if (authResult.error) {
        return res.status(authResult.status).json({ error: authResult.error });
    }
    const user = authResult.user;

    try {
        let filePath;

        // 3. Resolve story and check authorization
        if (storyId) {
            const story = await prisma.studentStory.findUnique({
                where: { id: storyId }
            });

            if (!story) {
                return res.status(404).json({ error: 'Story Not Found' });
            }

            const isAuthorized = await authorizeStoryAccess(user, story);
            if (!isAuthorized) {
                logger.warn(`Forbidden: User ${user.id} (${user.role}) denied access to story ${storyId} of student ${story.userId}`);
                return res.status(403).json({ error: 'Forbidden: You are not authorized to view this story' });
            }

            // Extract physical file path from story.videoUrl
            let extractedPath;
            try {
                const parsed = new URL(story.videoUrl, 'http://localhost');
                extractedPath = parsed.searchParams.get('path') || story.videoUrl;
            } catch (e) {
                extractedPath = story.videoUrl;
            }
            filePath = path.resolve(extractedPath);

            // Verify resolved file path is within allowed directories
            const filePathLower = filePath.toLowerCase();
            const isAllowed = 
                filePathLower.startsWith(engineDirLower) || 
                filePathLower.startsWith(charsDirLower) || 
                filePathLower.startsWith(uploadsDirLower) ||
                filePathLower.startsWith(rootUploadsLower);

            if (!isAllowed) {
                logger.warn(`Forbidden file access attempt: ${filePath}`);
                return res.status(403).json({ error: 'Forbidden: Access outside allowed directories is denied' });
            }

            // Check if file exists on disk
            if (!fs.existsSync(filePath)) {
                logger.info(`Requested file not found on disk: ${filePath}`);
                return res.status(404).json({ error: 'File Not Found' });
            }
        } else {
            filePath = path.resolve(rawPath);

            // Verify resolved file path is within allowed directories
            const filePathLower = filePath.toLowerCase();
            const isAllowed = 
                filePathLower.startsWith(engineDirLower) || 
                filePathLower.startsWith(charsDirLower) || 
                filePathLower.startsWith(uploadsDirLower) ||
                filePathLower.startsWith(rootUploadsLower);

            if (!isAllowed) {
                logger.warn(`Forbidden file access attempt: ${filePath}`);
                return res.status(403).json({ error: 'Forbidden: Access outside allowed directories is denied' });
            }

            // Check if file exists on disk
            if (!fs.existsSync(filePath)) {
                logger.info(`Requested file not found on disk: ${filePath}`);
                return res.status(404).json({ error: 'File Not Found' });
            }

            // If file is in story_engine/output, check if it belongs to a story
            const filename = path.basename(filePath);
            const story = await prisma.studentStory.findFirst({
                where: { videoUrl: { contains: filename } }
            });

            if (story) {
                const isAuthorized = await authorizeStoryAccess(user, story);
                if (!isAuthorized) {
                    logger.warn(`Forbidden: User ${user.id} (${user.role}) denied access to story file ${filename} of student ${story.userId}`);
                    return res.status(403).json({ error: 'Forbidden: You are not authorized to view this story' });
                }
            } else if (filePath.toLowerCase().startsWith(engineDirLower)) {
                // If it's a video file in story_engine but not matching any registered story, only ADMIN or TEACHER can access
                if (user.role !== 'ADMIN' && user.role !== 'TEACHER') {
                    return res.status(403).json({ error: 'Forbidden: Access to this engine asset is denied' });
                }
            }
        }

        // 6. res.sendFile handles Content-Type, Accept-Ranges: bytes, and HTTP 206 partial content
        res.sendFile(filePath);
    } catch (err) {
        logger.error(`Error serving file: ${err.message}`, { error: err });
        res.status(500).json({ error: 'Failed to serve file' });
    }
});

module.exports = router;
