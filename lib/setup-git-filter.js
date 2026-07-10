import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Check if Git filter is already configured
 * @param {string} cwd - Current working directory
 * @returns {Promise<boolean>} True if filter is configured
 */
export async function checkGitFilterConfigured(cwd = process.cwd()) {
  const gitDir = path.join(cwd, '.git');
  
  if (!await fs.pathExists(gitDir)) {
    return false;
  }
  
  try {
    const config = execSync('git config --local --get filter.kiro-sessions.clean', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    return config.includes('clean-sessions');
  } catch (error) {
    return false;
  }
}

/**
 * Setup Git filter for automatic sanitization
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function setupGitFilter(cwd = process.cwd()) {
  const gitDir = path.join(cwd, '.git');
  const gitFiltersDir = path.join(cwd, '.gitfilters');
  
  // Check if .git directory exists
  if (!await fs.pathExists(gitDir)) {
    console.log(chalk.yellow('⚠️  Not a Git repository. Initialize Git first:'));
    console.log(chalk.gray('   git init'));
    return;
  }
  
  // Ensure .gitfilters directory exists
  await fs.ensureDir(gitFiltersDir);
  
  // Copy filter scripts to project
  const cleanScriptPath = path.join(gitFiltersDir, 'clean-sessions.cjs');
  const smudgeScriptPath = path.join(gitFiltersDir, 'smudge-sessions.cjs');
  
  // Get the script templates from this package
  const packageDir = path.resolve(__dirname, '..');
  const templateDir = path.join(packageDir, '.gitfilters');
  
  let scriptsCreated = false;
  
  // Always check and copy if missing
  if (!await fs.pathExists(cleanScriptPath)) {
    const cleanTemplate = path.join(templateDir, 'clean-sessions.cjs');
    if (await fs.pathExists(cleanTemplate)) {
      await fs.copy(cleanTemplate, cleanScriptPath);
      console.log(chalk.gray('  Created .gitfilters/clean-sessions.cjs'));
      scriptsCreated = true;
    } else {
      console.error(chalk.red('❌ Clean filter template not found:'), cleanTemplate);
      throw new Error('Clean filter template not found');
    }
  }
  
  if (!await fs.pathExists(smudgeScriptPath)) {
    const smudgeTemplate = path.join(templateDir, 'smudge-sessions.cjs');
    if (await fs.pathExists(smudgeTemplate)) {
      await fs.copy(smudgeTemplate, smudgeScriptPath);
      console.log(chalk.gray('  Created .gitfilters/smudge-sessions.cjs'));
      scriptsCreated = true;
    } else {
      console.error(chalk.red('❌ Smudge filter template not found:'), smudgeTemplate);
      throw new Error('Smudge filter template not found');
    }
  }
  
  if (!scriptsCreated && await checkGitFilterConfigured(cwd)) {
    console.log(chalk.blue('ℹ️  Git filter already configured'));
    return;
  }
  
  // Configure Git filter
  try {
    execSync('git config --local filter.kiro-sessions.clean "node .gitfilters/clean-sessions.cjs"', { cwd });
    execSync('git config --local filter.kiro-sessions.smudge "node .gitfilters/smudge-sessions.cjs"', { cwd });
    execSync('git config --local filter.kiro-sessions.required true', { cwd });
    
    console.log(chalk.green('✓ Git filter configured successfully'));
    console.log(chalk.gray('  Filter: kiro-sessions'));
    console.log(chalk.gray('  Clean: node .gitfilters/clean-sessions.cjs'));
    console.log(chalk.gray('  Smudge: node .gitfilters/smudge-sessions.cjs'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to configure Git filter:'), error.message);
    throw error;
  }
}

/**
 * Remove Git filter configuration
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function removeGitFilter(cwd = process.cwd()) {
  const gitDir = path.join(cwd, '.git');
  
  if (!await fs.pathExists(gitDir)) {
    console.log(chalk.yellow('⚠️  Not a Git repository'));
    return;
  }
  
  if (!await checkGitFilterConfigured(cwd)) {
    console.log(chalk.yellow('⚠️  Git filter not configured'));
    return;
  }
  
  try {
    execSync('git config --local --unset filter.kiro-sessions.clean', { cwd });
    execSync('git config --local --unset filter.kiro-sessions.smudge', { cwd });
    execSync('git config --local --unset filter.kiro-sessions.required', { cwd });
    
    console.log(chalk.green('✓ Git filter removed'));
  } catch (error) {
    // Ignore errors if keys don't exist
    console.log(chalk.green('✓ Git filter removed'));
  }
}

/**
 * Update Git filter to latest version (for existing projects)
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function updateGitFilter(cwd = process.cwd()) {
  console.log(chalk.blue('🔄 Updating Git filter configuration...'));
  
  // Remove old configuration
  await removeGitFilter(cwd);
  
  // Setup new configuration
  await setupGitFilter(cwd);
  
  console.log(chalk.green('✓ Git filter updated to latest version'));
}

/**
 * Show Git filter status
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function showGitFilterStatus(cwd = process.cwd()) {
  const gitDir = path.join(cwd, '.git');
  
  if (!await fs.pathExists(gitDir)) {
    console.log(chalk.yellow('⚠️  Not a Git repository'));
    return;
  }
  
  const isConfigured = await checkGitFilterConfigured(cwd);
  
  if (isConfigured) {
    console.log(chalk.green('✓ Git filter is configured'));
    
    try {
      const clean = execSync('git config --local --get filter.kiro-sessions.clean', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      
      const smudge = execSync('git config --local --get filter.kiro-sessions.smudge', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      
      console.log(chalk.gray('  Clean:  ' + clean));
      console.log(chalk.gray('  Smudge: ' + smudge));
    } catch (error) {
      // Ignore
    }
  } else {
    console.log(chalk.yellow('⚠️  Git filter not configured'));
    console.log(chalk.gray('  Run: kiro-chats-sync --setup-git-filter'));
  }
}
