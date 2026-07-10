import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import chalk from 'chalk';

/**
 * Calculate workspace ID from path using Kiro's algorithm
 * Workspace ID = SHA256(lowercase path with forward slashes).slice(0, 16)
 */
function calculateWorkspaceId(projectPath) {
  const normalized = path.normalize(projectPath)
    .toLowerCase()
    .replace(/\\/g, '/');
  
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return hash.slice(0, 16);
}

/**
 * Get Kiro user data directory based on platform
 */
function getKiroDir() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.kiro');
}

/**
 * Check if path exists
 */
async function exists(checkPath) {
  try {
    await fs.access(checkPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a symlink and return its target
 */
async function getSymlinkTarget(linkPath) {
  try {
    const stats = await fs.lstat(linkPath);
    if (stats.isSymbolicLink()) {
      return await fs.readlink(linkPath);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Recursively copy directory (for cross-device moves)
 */
async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  
  const entries = await fs.readdir(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

/**
 * Move directory with cross-device support
 */
async function moveDirectory(source, destination) {
  try {
    // Try rename first (fast, same device)
    await fs.rename(source, destination);
  } catch (err) {
    if (err.code === 'EXDEV') {
      // Cross-device, use copy + delete
      await copyDirectory(source, destination);
      await fs.rm(source, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

/**
 * Create symlink with cross-platform compatibility
 */
async function createSymlink(target, linkPath) {
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  
  try {
    await fs.symlink(target, linkPath, type);
  } catch (err) {
    if (err.code === 'EPERM' && process.platform === 'win32') {
      throw new Error(
        'Permission denied. On Windows, you need either:\n' +
        '  1. Run as Administrator, OR\n' +
        '  2. Enable Developer Mode in Windows Settings'
      );
    }
    throw err;
  }
}

/**
 * Check the status of global sessions directory
 * Returns: 'not-exists' | 'directory' | 'symlink-correct' | 'symlink-wrong' | 'symlink-broken'
 */
async function checkGlobalStatus(globalPath, expectedTarget) {
  try {
    const stats = await fs.lstat(globalPath);
    
    if (stats.isSymbolicLink()) {
      const target = await fs.readlink(globalPath);
      const resolved = path.resolve(path.dirname(globalPath), target);
      
      const normalizedResolved = path.normalize(resolved).toLowerCase();
      const normalizedExpected = path.normalize(expectedTarget).toLowerCase();
      
      if (normalizedResolved === normalizedExpected) {
        // Check if target really exists
        try {
          await fs.access(resolved);
          return 'symlink-correct';
        } catch {
          return 'symlink-broken';
        }
      } else {
        return 'symlink-wrong';
      }
    } else if (stats.isDirectory()) {
      return 'directory';
    } else {
      return 'unknown';
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return 'not-exists';
    }
    throw err;
  }
}

/**
 * Count session directories in a path
 */
async function countSessions(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory() && e.name.startsWith('sess_')).length;
  } catch {
    return 0;
  }
}

/**
 * Merge sessions from source to target directory
 * Returns array of conflicts (renamed sessions)
 */
async function mergeSessions(sourceDir, targetDir, verbose) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const conflicts = [];
  let movedCount = 0;
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    
    // Check if target already exists
    const targetExists = await exists(targetPath);
    
    if (targetExists) {
      // Conflict: rename with timestamp
      const timestamp = Date.now();
      const newName = `${entry.name}_merged_${timestamp}`;
      const newTargetPath = path.join(targetDir, newName);
      
      await moveDirectory(sourcePath, newTargetPath);
      conflicts.push({ original: entry.name, renamed: newName });
      
      if (verbose) {
        console.log(chalk.yellow(`    ⚠️  Conflict: ${entry.name} → ${newName}`));
      }
    } else {
      // No conflict, move directly
      await moveDirectory(sourcePath, targetPath);
      movedCount++;
    }
  }
  
  return { movedCount, conflicts };
}

/**
 * Fix mode: Repair symlinks after project moved
 */
async function fixSymlinks(options) {
  const { dryRun, verbose, cwd } = options;
  const kiroDir = getKiroDir();
  
  console.log(chalk.cyan('🔧 Fix mode: Repairing after project relocation\n'));
  
  // Check if .kiro-sessions exists in current project
  const localSessionsDir = path.join(cwd, '.kiro-sessions');
  const localExists = await exists(localSessionsDir);
  
  if (!localExists) {
    throw new Error(
      'No .kiro-sessions/ found in current project.\n\n' +
      'This command is for fixing symlinks after moving a project.\n' +
      'If this is a new migration, remove the --fix flag.'
    );
  }
  
  const sessionCount = await countSessions(localSessionsDir);
  console.log(chalk.green(`✓ Found .kiro-sessions/ with ${sessionCount} session(s)\n`));
  
  // Calculate current workspace ID
  const workspaceId = calculateWorkspaceId(cwd);
  console.log(chalk.cyan(`Calculated workspace ID: ${workspaceId}`));
  console.log(chalk.gray(`  Based on path: ${cwd}\n`));
  
  // Find and remove old symlinks pointing to current .kiro-sessions
  console.log(chalk.cyan('🔍 Looking for old symlinks...'));
  const sessionsDir = path.join(kiroDir, 'sessions');
  const allWorkspaces = await fs.readdir(sessionsDir).catch(() => []);
  const brokenLinks = [];
  
  for (const wsId of allWorkspaces) {
    const linkPath = path.join(sessionsDir, wsId);
    try {
      const target = await fs.readlink(linkPath);
      const resolved = path.resolve(path.dirname(linkPath), target);
      
      // Check if points to current .kiro-sessions
      if (path.normalize(resolved).toLowerCase() === 
          path.normalize(localSessionsDir).toLowerCase()) {
        brokenLinks.push({ id: wsId, path: linkPath });
      }
    } catch {
      // Not a symlink or read failed, skip
    }
  }
  
  if (brokenLinks.length > 0) {
    console.log(chalk.yellow(`  Found ${brokenLinks.length} old symlink(s):`));
    brokenLinks.forEach(link => {
      console.log(chalk.gray(`    - ${link.id}`));
    });
    
    if (!dryRun) {
      for (const link of brokenLinks) {
        await fs.unlink(link.path);
      }
      console.log(chalk.green('  ✓ Removed old symlinks\n'));
    }
  } else {
    console.log(chalk.green('  ✓ No old symlinks found\n'));
  }
  
  // Check new workspace ID status
  const globalSessionDir = path.join(sessionsDir, workspaceId);
  const globalStatus = await checkGlobalStatus(globalSessionDir, localSessionsDir);
  
  console.log(chalk.cyan('📂 Checking new workspace ID status...'));
  
  if (globalStatus === 'symlink-correct') {
    console.log(chalk.green('  ✓ Symlink already correct, nothing to do\n'));
    return;
  }
  
  if (globalStatus === 'directory') {
    // Need to merge
    const globalCount = await countSessions(globalSessionDir);
    console.log(chalk.yellow(`  ⚠️  Found ${globalCount} session(s) in global location`));
    console.log(chalk.cyan('  Merging with local sessions...\n'));
    
    if (!dryRun) {
      const { movedCount, conflicts } = await mergeSessions(
        globalSessionDir,
        localSessionsDir,
        verbose
      );
      
      console.log(chalk.green(`  ✓ Merged ${movedCount} session(s)`));
      
      if (conflicts.length > 0) {
        console.log(chalk.yellow(`  ⚠️  Resolved ${conflicts.length} conflict(s) by renaming`));
      }
      
      // Remove empty global directory
      try {
        await fs.rmdir(globalSessionDir);
      } catch {
        // May not be empty, that's okay
      }
    }
  }
  
  // Create new symlink
  if (!dryRun) {
    if (globalStatus === 'symlink-wrong' || globalStatus === 'symlink-broken') {
      await fs.unlink(globalSessionDir);
    }
    
    console.log(chalk.cyan('🔗 Creating new symlink...'));
    await createSymlink(localSessionsDir, globalSessionDir);
    console.log(chalk.green(`  ✓ ~/.kiro/sessions/${workspaceId}/ → .kiro-sessions/\n`));
  } else {
    console.log(chalk.yellow('\n🔍 DRY RUN - Would create symlink:'));
    console.log(chalk.gray(`  ~/.kiro/sessions/${workspaceId}/ → .kiro-sessions/\n`));
  }
  
  const finalCount = await countSessions(localSessionsDir);
  console.log(chalk.green(`✅ Total sessions in project: ${finalCount}`));
}

/**
 * Main migration logic
 */
export async function migrate(options) {
  const { fixMode, dryRun, verbose, cwd } = options;
  
  // Handle fix mode
  if (fixMode) {
    return await fixSymlinks(options);
  }
  
  // Standard migration
  const kiroDir = getKiroDir();
  
  if (verbose) {
    console.log(chalk.gray(`Working directory: ${cwd}`));
    console.log(chalk.gray(`Kiro directory: ${kiroDir}\n`));
  }
  
  // Calculate workspace ID
  const workspaceId = calculateWorkspaceId(cwd);
  console.log(chalk.cyan(`Workspace ID: ${workspaceId}`));
  console.log(chalk.gray(`  Calculated from: ${cwd}\n`));
  
  // Define paths
  const globalSessionDir = path.join(kiroDir, 'sessions', workspaceId);
  const localSessionsDir = path.join(cwd, '.kiro-sessions');
  
  // Check status
  console.log(chalk.cyan('📂 Checking status...'));
  
  const localExists = await exists(localSessionsDir);
  const globalStatus = await checkGlobalStatus(globalSessionDir, localSessionsDir);
  
  const localCount = localExists ? await countSessions(localSessionsDir) : 0;
  const globalCount = globalStatus === 'directory' ? await countSessions(globalSessionDir) : 0;
  
  if (verbose) {
    console.log(chalk.gray(`  Local (.kiro-sessions/): ${localExists ? `✓ (${localCount} sessions)` : '✗'}`));
    console.log(chalk.gray(`  Global (~/sessions/${workspaceId}/): ${globalStatus} ${globalCount > 0 ? `(${globalCount} sessions)` : ''}`));
    console.log();
  }
  
  // Decision logic
  if (globalStatus === 'symlink-correct' && localExists) {
    console.log(chalk.green('✓ Already migrated, nothing to do'));
    return;
  }
  
  if (!localExists && globalStatus === 'not-exists') {
    // New project, never opened in Kiro
    console.log(chalk.cyan('Creating empty .kiro-sessions/\n'));
    
    if (!dryRun) {
      await fs.mkdir(localSessionsDir, { recursive: true });
      await createSymlink(localSessionsDir, globalSessionDir);
      console.log(chalk.green('✓ Created .kiro-sessions/ and symlink'));
    } else {
      console.log(chalk.yellow('🔍 DRY RUN - Would create:'));
      console.log(chalk.gray(`  1. Directory: ${localSessionsDir}`));
      console.log(chalk.gray(`  2. Symlink: ${globalSessionDir} → .kiro-sessions/`));
    }
    return;
  }
  
  if (!localExists && globalStatus === 'directory') {
    // First migration: move global to local
    console.log(chalk.cyan(`Moving ${globalCount} session(s) from global to project...\n`));
    
    if (!dryRun) {
      await moveDirectory(globalSessionDir, localSessionsDir);
      await createSymlink(localSessionsDir, globalSessionDir);
      console.log(chalk.green('✓ Moved sessions to .kiro-sessions/'));
      console.log(chalk.green(`✓ Created symlink: ~/.kiro/sessions/${workspaceId}/ → .kiro-sessions/`));
    } else {
      console.log(chalk.yellow('🔍 DRY RUN - Would:'));
      console.log(chalk.gray(`  1. Move: ${globalSessionDir} → .kiro-sessions/`));
      console.log(chalk.gray(`  2. Create symlink`));
    }
    return;
  }
  
  if (localExists && globalStatus === 'not-exists') {
    // Git clone scenario: local exists but global doesn't
    console.log(chalk.cyan(`Found existing .kiro-sessions/ with ${localCount} session(s)`));
    console.log(chalk.cyan('Creating symlink for existing sessions...\n'));
    
    if (!dryRun) {
      await createSymlink(localSessionsDir, globalSessionDir);
      console.log(chalk.green(`✓ Created symlink: ~/.kiro/sessions/${workspaceId}/ → .kiro-sessions/`));
    } else {
      console.log(chalk.yellow('🔍 DRY RUN - Would create symlink'));
    }
    return;
  }
  
  if (localExists && globalStatus === 'directory') {
    // Both exist: need to merge
    console.log(chalk.yellow('⚠️  Sessions found in both locations'));
    console.log(chalk.cyan(`  Local: ${localCount} session(s)`));
    console.log(chalk.cyan(`  Global: ${globalCount} session(s)`));
    console.log(chalk.cyan('Merging...\n'));
    
    if (!dryRun) {
      const { movedCount, conflicts } = await mergeSessions(
        globalSessionDir,
        localSessionsDir,
        verbose
      );
      
      console.log(chalk.green(`✓ Merged ${movedCount} session(s) from global to local`));
      
      if (conflicts.length > 0) {
        console.log(chalk.yellow(`⚠️  Resolved ${conflicts.length} conflict(s):`));
        conflicts.forEach(c => {
          console.log(chalk.gray(`    ${c.original} → ${c.renamed}`));
        });
      }
      
      // Remove empty global directory
      try {
        await fs.rmdir(globalSessionDir);
      } catch {
        // May not be empty if merge failed partially
      }
      
      await createSymlink(localSessionsDir, globalSessionDir);
      
      const finalCount = await countSessions(localSessionsDir);
      console.log(chalk.green(`✓ Total sessions in project: ${finalCount}`));
      console.log(chalk.green(`✓ Created symlink: ~/.kiro/sessions/${workspaceId}/ → .kiro-sessions/`));
    } else {
      console.log(chalk.yellow('🔍 DRY RUN - Would:'));
      console.log(chalk.gray(`  1. Merge ${globalCount} session(s) from global to local`));
      console.log(chalk.gray(`  2. Create symlink`));
    }
    return;
  }
  
  if (globalStatus === 'symlink-wrong' || globalStatus === 'symlink-broken') {
    // Symlink exists but wrong
    console.log(chalk.yellow('⚠️  Symlink exists but points to wrong location'));
    console.log(chalk.cyan('Fixing symlink...\n'));
    
    if (!dryRun) {
      await fs.unlink(globalSessionDir);
      
      if (!localExists) {
        await fs.mkdir(localSessionsDir, { recursive: true });
      }
      
      await createSymlink(localSessionsDir, globalSessionDir);
      console.log(chalk.green('✓ Fixed symlink'));
    } else {
      console.log(chalk.yellow('🔍 DRY RUN - Would fix symlink'));
    }
    return;
  }
}
