# GitHub Workflow

## Branch Usage
- `main`: The primary, stable source of truth.
- `feature/*`: Working branches for developing distinct components (e.g., `feature/eduvision-platform-foundation`). 

## Safe Commits
1. Use descriptive commit messages.
2. Only stage files relevant to the specific change. Do not run `git commit -am "update"` blindly.
3. Review `git status` before committing.

## Secret Handling and `.gitignore`
- `.env` and `.env.*` files MUST NOT be committed.
- `.env.example` should be maintained with safe placeholder values to document required configurations.
- Media artifacts (e.g., generated videos in `story_engine/output/`), logs (e.g., `logs/*.log`), and large ML dependencies must remain ignored.
- The global `.gitignore` specifically isolates virtual environments (`.venv`), Node modules (`node_modules`), and generated `.mp4` files.

## Recovery from a Bad Commit
If a commit was made in error:
- **Soft Reset**: `git reset --soft HEAD~1` (Undoes the commit but keeps your file changes intact so you can re-stage).
- **Avoid Force-Pushing**: Avoid rewriting history using `git push -f`, especially if others are developing on the same branch.

## Creating Pull Requests
When a feature is complete, verify all tests pass (`npm test`) locally, ensure no credentials are part of the diff (`git diff --check`), and open a Pull Request against `main`.
