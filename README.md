# kiro-chats-sync

Sync Kiro IDE chat sessions to your project directory with symlinks.

## Why?

By default, Kiro IDE stores session history in `~/.kiro/sessions/`. This tool helps you:

- 📁 Keep session history **inside your project** for better organization
- 🔗 Use **symlinks** so Kiro still works normally
- 💾 Include sessions in your project backups
- 📝 Share development conversations with your team via Git
- 🚀 Sessions follow your project when you move or copy it

## How It Works

### Simple Structure

```
~/.kiro/sessions/abc123/ → /project/.kiro-sessions/  (symlink)

/project/
  .kiro-sessions/          ← All sessions here
    sess_001/
    sess_002/
    sess_003/
```

**Key insight**: The tool creates a **flat structure** - sessions are stored directly in `.kiro-sessions/`, not in a subdirectory. This makes the tool work seamlessly across different scenarios.

### Why This Works

Kiro calculates workspace ID from your project path:
```
workspace_id = SHA256(lowercase_path).slice(0, 16)
```

**Different paths = different workspace IDs**, but all point to the same `.kiro-sessions/`:

```
Developer A (Windows):  D:\projects\myapp     → workspace ID: abc123
Developer B (Mac):      /Users/bob/myapp      → workspace ID: xyz789
Developer C (Linux):    /home/carol/myapp     → workspace ID: def456

All link to the same directory:
  ~/.kiro/sessions/abc123/ → /project/.kiro-sessions/
  ~/.kiro/sessions/xyz789/ → /project/.kiro-sessions/
  ~/.kiro/sessions/def456/ → /project/.kiro-sessions/
```

This means:
- ✅ **Perfect for Git collaboration** - everyone sees all sessions
- ✅ **Project moves work** - sessions stay with your project
- ✅ **Copy/clone friendly** - just run the tool and you're set

## Installation

```bash
npm install -g kiro-chats-sync
```

Or use directly with `npx`:

```bash
npx kiro-chats-sync
```

## Usage

### Basic Sync

Navigate to your project and run:

```bash
cd /path/to/your/project
kiro-chats-sync
```

The tool automatically detects your situation and does the right thing:
- **First time**: Moves global sessions to project
- **Git clone**: Creates symlink for existing `.kiro-sessions/`
- **Both exist**: Merges global and local sessions intelligently

**🔒 First Run Security Prompt:**

On first run, you'll be asked how to handle sensitive data in sessions:

```
⚠️  Security Notice: Session Privacy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your chat sessions may contain sensitive information:
  • API keys and tokens
  • Absolute file paths
  • Personal information

Choose how to handle .kiro-sessions/:

  1. [Recommended] Exclude from Git (add to .gitignore)
     → Keeps sessions completely private

  2. Commit with auto-sanitization (setup Git filter)
     → Removes sensitive data before each commit

  3. Skip (I'll decide later)

Your choice [1/2/3] (default: 1): 
```

Just press **Enter** to accept the recommended option (add to .gitignore).

### Options

```bash
kiro-chats-sync [options]

Options:
  -d, --dry-run           Preview changes without executing
  -v, --verbose           Show detailed output
  -f, --fix               Fix symlinks after moving project to new location
  --sanitize              Sanitize sessions (remove sensitive data)
  --check                 Check for sensitive data without modifying
  --setup-git-filter      Setup Git filter for auto-sanitization
  --update-git-filter     Update Git filter to latest version
  --status                Show Git filter status
  --gitignore             Add .kiro-sessions/ to .gitignore
  --silent                Suppress output (for use in filters)
  -h, --help              Display help
  -V, --version           Display version
```

### Examples

```bash
# Preview what will happen
kiro-chats-sync --dry-run

# Run the sync
kiro-chats-sync

# See detailed logs
kiro-chats-sync --verbose

# Fix after moving project
kiro-chats-sync --fix

# Security commands
kiro-chats-sync --check               # Check for sensitive data
kiro-chats-sync --sanitize            # Remove sensitive data
kiro-chats-sync --setup-git-filter    # Setup Git filter
kiro-chats-sync --update-git-filter   # Update to latest filter
kiro-chats-sync --status              # Check filter status
kiro-chats-sync --gitignore           # Add to .gitignore
```

## Common Scenarios

### Scenario 1: First Time Setup

```bash
cd /my/project
kiro-chats-sync
```

**What happens:**
- Moves `~/.kiro/sessions/<workspace-id>/` to `.kiro-sessions/`
- Creates symlink: `~/.kiro/sessions/<workspace-id>/ → .kiro-sessions/`
- Kiro continues working normally

### Scenario 2: Git Clone (Project Has Sessions)

```bash
git clone repo project
cd project
kiro-chats-sync
```

**What happens:**
- Detects existing `.kiro-sessions/` from Git
- Calculates your local workspace ID
- Creates symlink: `~/.kiro/sessions/<your-id>/ → .kiro-sessions/`
- You can now see all sessions from other developers!

### Scenario 3: Both Local and Global Sessions

```bash
# You cloned a project (has .kiro-sessions/)
# But you also used Kiro locally before syncing

kiro-chats-sync
```

**What happens:**
- Detects sessions in both locations
- Automatically merges them into `.kiro-sessions/`
- Preserves all history
- Handles name conflicts gracefully

### Scenario 4: Moving Your Project

```bash
# Move project to new location
mv /old/path/project /new/path/project

# Fix the sync
cd /new/path/project
kiro-chats-sync --fix
```

**What `--fix` does:**
1. Finds old symlinks pointing to `.kiro-sessions/`
2. Removes them
3. Calculates new workspace ID for new path
4. Merges any existing global sessions
5. Creates new symlink for new location

**Result**: All your session history is preserved! ✅

## Security & Privacy: Protecting Sensitive Data

Chat sessions often contain sensitive information that shouldn't be committed to Git. `kiro-chats-sync` provides multiple strategies to protect your data.

### 🔒 Security Strategies

#### Strategy 1: Keep Sessions Private (Recommended for Personal Projects)

**Best for:** Personal projects, proprietary code, sessions with API keys

```bash
# Automatically prompted on first run, or run manually:
kiro-chats-sync --gitignore
```

This adds `.kiro-sessions/` to your `.gitignore`, keeping all sessions completely private.

**Pros:**
- ✅ Complete privacy - nothing is committed
- ✅ No risk of leaking sensitive data
- ✅ Simple and safe

**Cons:**
- ❌ Team members don't see your development discussions
- ❌ Sessions not backed up in Git

#### Strategy 2: Share Sessions with Auto-Sanitization (Recommended for Teams)

**Best for:** Team projects, sharing development context, documentation

```bash
# Automatically prompted on first run, or run manually:
kiro-chats-sync --setup-git-filter
```

This sets up a **Git filter** that automatically removes sensitive data before each commit.

**How it works:**

1. You run `git add .kiro-sessions/`
2. You run `git commit`
3. Git filter automatically sanitizes files during commit
4. Only sanitized version is committed to Git
5. **Your local files remain unchanged** - only the committed version is sanitized

**Pros:**
- ✅ Team collaboration - everyone sees sanitized sessions
- ✅ Sessions become project documentation
- ✅ Automatic - you don't have to remember
- ✅ Local files unchanged - Kiro works normally
- ✅ Transparent - no manual intervention needed

**Cons:**
- ⚠️ Must review sanitization rules for your specific needs
- ⚠️ Some context may be lost (replaced with placeholders)

### 🛡️ What Gets Sanitized

The sanitizer detects and removes:

| Sensitive Data | Example | Replaced With |
|----------------|---------|---------------|
| **API Keys** | `sk-abc123...` | `[REDACTED_API_KEY]` |
| **Tokens** | `ghp_abc123...` | `[REDACTED_API_KEY]` |
| **Passwords** | `password=secret123` | `password=[REDACTED_PASSWORD]` |
| **JWT Tokens** | `eyJhbGc...` | `[REDACTED_JWT_TOKEN]` |
| **Private Keys** | `-----BEGIN PRIVATE KEY-----` | `[REDACTED_PRIVATE_KEY]` |
| **Emails** | `john@example.com` | `[REDACTED_EMAIL]` |
| **IP Addresses** | `192.168.1.1` | `[REDACTED_IP]` |
| **Connection Strings** | `mongodb://user:pass@...` | `[REDACTED_CONNECTION_STRING]` |
| **Windows User Path** | `C:\Users\john\` | `~\` |
| **Unix User Path** | `/home/john/` | `~/` |
| **Project Path** | `D:\Projects\myapp\` | `<PROJECT_ROOT>\` |
| **Other Absolute Paths** | `/var/data/...` | `[REDACTED_PATH]` |

### 📋 Manual Sanitization

If you need to manually sanitize sessions (one-time cleanup):

```bash
# Check what would be sanitized (dry run)
kiro-chats-sync --check

# Sanitize all sessions
kiro-chats-sync --sanitize

# Sanitize with detailed output
kiro-chats-sync --sanitize --verbose
```

### 🔍 Checking for Sensitive Data

Before committing, you can check if sessions contain sensitive data:

```bash
kiro-chats-sync --check --verbose
```

Output example:
```
🔒 Checking sessions...

  ⚠️  sess_abc123/messages.jsonl: 5 line(s) with sensitive data
  ⚠️  sess_xyz789/messages.jsonl: 2 line(s) with sensitive data

Files checked: 6
⚠️  2 file(s) contain sensitive data (7 line(s))
Run without --check to sanitize
```

### ⚙️ How Git Filter Works

When you install the filter with `--setup-git-filter`:

1. Creates `.gitfilters/` directory with clean and smudge scripts
2. Configures Git filter in `.git/config`:
   ```
   [filter "kiro-sessions"]
     clean = node .gitfilters/clean-sessions.js
     smudge = node .gitfilters/smudge-sessions.js
   ```
3. Adds filter rules to `.gitattributes`:
   ```
   .kiro-sessions/**/*.json filter=kiro-sessions
   .kiro-sessions/**/*.jsonl filter=kiro-sessions
   ```
4. When you commit, Git automatically runs the clean filter
5. **Local files are never modified** - only committed files are sanitized

**Update filter to latest version:**
```bash
kiro-chats-sync --update-git-filter
```

**Check filter status:**
```bash
kiro-chats-sync --status
```

### 🚫 Strategy 3: No Protection (Not Recommended)

If you choose to skip security setup, you can always configure it later:

```bash
# Add to .gitignore
kiro-chats-sync --gitignore

# Or setup Git filter
kiro-chats-sync --setup-git-filter
```

**⚠️ Warning:** Without protection, sensitive data may be committed to your Git repository. Once committed, data is in Git history even if you delete it later.

### 💡 Best Practices

**For Individual Developers:**
```bash
# Option 1: Keep private (simplest)
kiro-chats-sync --gitignore

# Option 2: Sanitize and commit (for backup)
kiro-chats-sync --setup-sanitize
```

**For Teams:**
```bash
# Share sanitized sessions as documentation
kiro-chats-sync --setup-git-filter

# After first setup, normal workflow:
git add .kiro-sessions/
git commit -m "Add development session"
# → Git filter automatically sanitizes during commit
```

**After Cloning a Project:**
```bash
git clone project
cd project
kiro-chats-sync  # Syncs sessions + prompts for security choice
```

### 🔧 Advanced: Customizing Sanitization

If you need custom sanitization rules, you can modify the Git filter scripts:

1. Edit `.gitfilters/clean-sessions.js`
2. Add your own patterns to the `patterns` object
3. Commit will use your custom rules

Example custom pattern:
```javascript
// Add to .gitfilters/clean-sessions.js
patterns.custom = [
  /my-custom-secret-[a-zA-Z0-9]+/g,
];
```

The filter scripts are part of your repository, so custom rules are shared with your team.

## Git Workflow

### Include Sessions in Git (Team Collaboration)

**⚠️ Important:** First set up Git filter to protect sensitive data (see [Security & Privacy](#security--privacy-protecting-sensitive-data))

```bash
# Setup Git filter (first time only)
kiro-chats-sync --setup-git-filter

# Then commit normally
git add .kiro-sessions/
git commit -m "Add development session history"
git push
```

**Benefits:**
- ✅ Team members see all development discussions
- ✅ New developers understand design decisions  
- ✅ Sessions become project documentation
- ✅ Sensitive data is automatically removed during commit

### Exclude Sessions from Git (Personal Privacy)

```bash
# Add to .gitignore (first time only)
kiro-chats-sync --gitignore

# Sessions will be ignored by Git
git status  # .kiro-sessions/ won't appear
```

**Benefits:**
- ✅ Complete privacy
- ✅ No risk of leaking sensitive information
- ✅ Smaller repository size

## Platform Support

| Platform | Symlink Type | Requirements |
|----------|--------------|--------------|
| **Windows** | Junction | Admin rights OR Developer Mode enabled |
| **macOS** | Directory symlink | No special requirements |
| **Linux** | Directory symlink | No special requirements |

### Windows Setup

If you get a permission error:

1. **Run as Administrator** - Right-click PowerShell/Terminal → "Run as Administrator"
2. **Enable Developer Mode** - Settings → Update & Security → For Developers → Developer Mode

## Troubleshooting

### "Permission denied" on Windows

**Solution**: 
- Run as Administrator, OR
- Enable Developer Mode in Windows Settings

### After Moving Project, Kiro Creates New Sessions Instead of Using Old Ones

**Solution**:
```bash
cd /new/project/path
kiro-chats-sync --fix
```

This recalculates the workspace ID and reconnects your sessions.

### Sessions Not Showing Up in Kiro

**Check:**
1. Is symlink created correctly?
   ```bash
   # Windows
   dir %USERPROFILE%\.kiro\sessions
   
   # Mac/Linux
   ls -la ~/.kiro/sessions/
   ```

2. Does `.kiro-sessions/` contain session directories?
   ```bash
   ls .kiro-sessions/
   # Should show sess_xxxx/ directories
   ```

3. Run with `--verbose` to see what the tool detected:
   ```bash
   kiro-chats-sync --verbose --dry-run
   ```

### Merge Conflicts

If two sessions have the same ID (extremely rare), the tool automatically renames the conflicting one with a timestamp:
```
sess_abc123/
sess_abc123_merged_1234567890/
```

### Undo Migration

To completely revert:

```bash
# 1. Remove symlink
rm ~/.kiro/sessions/<workspace-id>

# 2. Move data back (if desired)
mv .kiro-sessions/* ~/.kiro/sessions/<workspace-id>/

# 3. Remove project directory
rmdir .kiro-sessions
```

## Advanced Usage

### Checking Status Without Changes

```bash
kiro-chats-sync --dry-run --verbose
```

Shows:
- Current workspace ID
- Local sessions count
- Global sessions status
- What would be done

### Multiple Projects

The tool works independently for each project. You can migrate as many projects as you want:

```bash
cd ~/project-a
kiro-chats-sync

cd ~/project-b
kiro-chats-sync

cd ~/project-c
kiro-chats-sync
```

Each project gets its own `.kiro-sessions/` with independent session history.

## How Workspace IDs Work

Kiro IDE calculates workspace ID deterministically:

```javascript
workspaceId = SHA256(
  path.normalize(projectPath)
    .toLowerCase()
    .replace(/\\/g, '/')
).slice(0, 16)
```

**Examples:**

| Path | Workspace ID |
|------|--------------|
| `D:\Projects\myapp` | `abc123...` |
| `d:\projects\myapp` | `abc123...` (same) |
| `D:\Projects\MyApp` | `abc123...` (same, case-insensitive) |
| `D:\Projects\newapp` | `xyz789...` (different) |
| `/Users/bob/myapp` | `def456...` (different path) |

**This is why:**
- Same path always generates same ID
- Different paths generate different IDs
- The tool recalculates ID automatically

## Best Practices

### For Individual Developers

```bash
# Option 1: Keep sessions private
echo ".kiro-sessions/" >> .gitignore

# Option 2: Include sessions as documentation
git add .kiro-sessions/
```

### For Teams

```bash
# Commit sessions to share knowledge
git add .kiro-sessions/
git commit -m "Add session history with architecture decisions"

# Each developer runs after clone
git clone repo myproject
cd myproject
kiro-chats-sync
```

### When Moving Projects

Always run `--fix` after moving:

```bash
cd /new/location
kiro-chats-sync --fix
```

## FAQ

**Q: Will this break my existing Kiro workspace?**  
A: No. The tool creates symlinks so Kiro sees sessions in the expected location. Everything works normally.

**Q: Is it safe to commit sessions to Git?**  
A: Yes, if you use the sanitization feature. Run `kiro-chats-sync --setup-sanitize` to install a pre-commit hook that automatically removes sensitive data (API keys, tokens, paths, etc.) before each commit. Your local files remain unchanged.

**Q: What's the difference between --gitignore and --setup-git-filter?**  
A: 
- `--gitignore`: Completely excludes sessions from Git (private, no sharing)
- `--setup-git-filter`: Commits sanitized sessions to Git (team collaboration, sensitive data removed)

Choose based on whether you want to share sessions with your team.

**Q: Can I use this with multiple projects?**  
A: Yes! Each project has its own `.kiro-sessions/` directory and independent workspace ID.

**Q: What happens to my local files when using Git filter?**  
A: Your local files are **never modified**. The Git filter only cleans files during the commit process. This means Kiro can still read your complete session history locally.

**Q: What if two developers have sessions with the same ID?**  
A: Session IDs are UUIDs (globally unique). Conflicts are virtually impossible, but the tool handles them by renaming.

**Q: Does this work on Windows?**  
A: Yes, but you need either Administrator privileges or Developer Mode enabled for creating junctions.

**Q: Can I commit `.kiro-sessions/` without Git filter?**  
A: Not recommended. Sessions often contain API keys, file paths, and personal information. Always use `--setup-git-filter` or `--gitignore`.

**Q: How do I check if my sessions contain sensitive data?**  
A: Run `kiro-chats-sync --check --verbose` to see what would be sanitized without modifying files.

**Q: What if I accidentally committed sensitive data?**  
A: You'll need to remove it from Git history using tools like `git filter-branch` or `BFG Repo-Cleaner`. Prevention is better - always set up Git filter first!

**Q: How do I update the Git filter to the latest version?**  
A: Run `kiro-chats-sync --update-git-filter` to update both the filter configuration and scripts.

**Q: Can I delete `.kiro-sessions/` by accident?**  
A: Yes, be careful. If you delete it, Kiro will start fresh. If you have backups or Git history, you can restore it. Otherwise, you'll lose session history (but not your code).

**Q: How do I move sessions between projects?**  
A: Simply copy the `sess_xxx/` directories from one `.kiro-sessions/` to another.

## Technical Details

### Directory Structure

**Before migration:**
```
~/.kiro/
  sessions/
    abc123/           ← Your sessions
      sess_001/
      sess_002/
  workspace-roots/
    abc123/
      .trust-migration.json
```

**After migration:**
```
~/.kiro/
  sessions/
    abc123/           ← Symlink
  workspace-roots/
    abc123/           ← Unchanged
      .trust-migration.json

/project/
  .kiro-sessions/     ← Real data
    sess_001/
    sess_002/
```

### Session Directory Format

Each session directory (`sess_<uuid>/`) contains:
- `session.json` - Session metadata
- `messages/` - Conversation history
- `snapshots/` - Code snapshots at different points

## Safety

- ✅ Uses `--dry-run` to preview changes
- ✅ Validates all paths before operations
- ✅ Merges rather than overwrites when conflicts exist
- ✅ Renames conflicts with timestamps to prevent data loss
- ✅ No data is deleted, only moved or linked
- ✅ Cross-device moves are handled automatically
- ✅ Git filter removes sensitive data during commit (when enabled)
- ✅ Local files remain unchanged - filter only affects Git commits
- ✅ Filter scripts are version-controlled and shared with team

## Contributing

Issues and PRs welcome! Please test with `--dry-run` before submitting changes.

## License

MIT

## Author

Created for the Kiro IDE community.

---

**Need help?** Open an issue on GitHub or check the troubleshooting section above.
