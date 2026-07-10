import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

// Gitignore entry for Kiro sessions
const GITIGNORE_ENTRY = `
# Kiro chat sessions (contains sensitive data)
.kiro-sessions/
`;

// Pattern to detect if .kiro-sessions is already in gitignore
const ENTRY_PATTERN = /^\s*\.kiro-sessions\/?(?:\s|#|$)/m;

// .gitattributes entry for Git filter
const GITATTRIBUTES_ENTRY = `
# Kiro chat sessions - auto-sanitize with Git filter
.kiro-sessions/**/*.json filter=kiro-sessions
.kiro-sessions/**/*.jsonl filter=kiro-sessions
`;

// Pattern to detect if kiro-sessions filter is in .gitattributes
const ATTRIBUTES_PATTERN = /filter=kiro-sessions/;

/**
 * Check if .kiro-sessions is already in .gitignore
 * @param {string} cwd - Current working directory
 * @returns {Promise<boolean>} True if entry exists
 */
export async function checkGitignoreEntry(cwd = process.cwd()) {
  const gitignorePath = path.join(cwd, '.gitignore');
  
  if (!await fs.pathExists(gitignorePath)) {
    return false;
  }
  
  const content = await fs.readFile(gitignorePath, 'utf-8');
  return ENTRY_PATTERN.test(content);
}

/**
 * Add .kiro-sessions to .gitignore
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function addToGitignore(cwd = process.cwd()) {
  const gitignorePath = path.join(cwd, '.gitignore');
  
  // Check if entry already exists
  if (await checkGitignoreEntry(cwd)) {
    console.log(chalk.blue('ℹ️  .kiro-sessions already in .gitignore'));
    return;
  }
  
  // Add entry to .gitignore
  if (await fs.pathExists(gitignorePath)) {
    // Append to existing file
    const content = await fs.readFile(gitignorePath, 'utf-8');
    
    // Ensure file ends with newline before appending
    const needsNewline = content.length > 0 && !content.endsWith('\n');
    const prefix = needsNewline ? '\n' : '';
    
    await fs.appendFile(gitignorePath, prefix + GITIGNORE_ENTRY);
    console.log(chalk.green('✓ Added .kiro-sessions/ to .gitignore'));
  } else {
    // Create new .gitignore
    await fs.writeFile(gitignorePath, GITIGNORE_ENTRY.trim() + '\n', 'utf-8');
    console.log(chalk.green('✓ Created .gitignore with .kiro-sessions/ entry'));
  }
}

/**
 * Remove .kiro-sessions from .gitignore
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function removeFromGitignore(cwd = process.cwd()) {
  const gitignorePath = path.join(cwd, '.gitignore');
  
  if (!await fs.pathExists(gitignorePath)) {
    console.log(chalk.yellow('⚠️  No .gitignore file found'));
    return;
  }
  
  const content = await fs.readFile(gitignorePath, 'utf-8');
  
  if (!ENTRY_PATTERN.test(content)) {
    console.log(chalk.yellow('⚠️  .kiro-sessions not found in .gitignore'));
    return;
  }
  
  // Remove entry and associated comments
  const lines = content.split('\n');
  const filtered = [];
  let skipNext = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip comment lines about Kiro sessions
    if (line.includes('Kiro chat sessions') || line.includes('kiro-sessions')) {
      // Check if next line is the actual entry
      if (i + 1 < lines.length && ENTRY_PATTERN.test(lines[i + 1])) {
        skipNext = true;
        continue;
      }
      // This line itself is the entry
      if (ENTRY_PATTERN.test(line)) {
        continue;
      }
    }
    
    if (skipNext) {
      skipNext = false;
      continue;
    }
    
    filtered.push(line);
  }
  
  // Write back
  await fs.writeFile(gitignorePath, filtered.join('\n'), 'utf-8');
  console.log(chalk.green('✓ Removed .kiro-sessions/ from .gitignore'));
}

/**
 * Create .gitignore with commented entry (for user to uncomment)
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function addCommentedEntry(cwd = process.cwd()) {
  const gitignorePath = path.join(cwd, '.gitignore');
  
  const commentedEntry = `
# Kiro chat sessions
# Uncomment the line below to exclude sessions from Git:
# .kiro-sessions/
`;
  
  if (await fs.pathExists(gitignorePath)) {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    
    // Check if any form of entry exists
    if (content.includes('.kiro-sessions')) {
      console.log(chalk.blue('ℹ️  .kiro-sessions entry already exists in .gitignore'));
      return;
    }
    
    const needsNewline = content.length > 0 && !content.endsWith('\n');
    const prefix = needsNewline ? '\n' : '';
    
    await fs.appendFile(gitignorePath, prefix + commentedEntry);
  } else {
    await fs.writeFile(gitignorePath, commentedEntry.trim() + '\n', 'utf-8');
  }
  
  console.log(chalk.blue('ℹ️  Added commented .kiro-sessions/ entry to .gitignore'));
  console.log(chalk.gray('   Uncomment the line to exclude sessions from Git'));
}

/**
 * Check if .gitattributes has Git filter configuration
 * @param {string} cwd - Current working directory
 * @returns {Promise<boolean>} True if entry exists
 */
export async function checkGitattributesEntry(cwd = process.cwd()) {
  const gitattributesPath = path.join(cwd, '.gitattributes');
  
  if (!await fs.pathExists(gitattributesPath)) {
    return false;
  }
  
  const content = await fs.readFile(gitattributesPath, 'utf-8');
  return ATTRIBUTES_PATTERN.test(content);
}

/**
 * Add Git filter configuration to .gitattributes
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function addGitattributesEntry(cwd = process.cwd()) {
  const gitattributesPath = path.join(cwd, '.gitattributes');
  
  // Check if entry already exists
  if (await checkGitattributesEntry(cwd)) {
    console.log(chalk.blue('ℹ️  Git filter already configured in .gitattributes'));
    return;
  }
  
  // Add entry to .gitattributes
  if (await fs.pathExists(gitattributesPath)) {
    // Append to existing file
    const content = await fs.readFile(gitattributesPath, 'utf-8');
    
    // Ensure file ends with newline before appending
    const needsNewline = content.length > 0 && !content.endsWith('\n');
    const prefix = needsNewline ? '\n' : '';
    
    await fs.appendFile(gitattributesPath, prefix + GITATTRIBUTES_ENTRY);
    console.log(chalk.green('✓ Added Git filter to .gitattributes'));
  } else {
    // Create new .gitattributes
    await fs.writeFile(gitattributesPath, GITATTRIBUTES_ENTRY.trim() + '\n', 'utf-8');
    console.log(chalk.green('✓ Created .gitattributes with Git filter'));
  }
}

/**
 * Remove Git filter configuration from .gitattributes
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function removeGitattributesEntry(cwd = process.cwd()) {
  const gitattributesPath = path.join(cwd, '.gitattributes');
  
  if (!await fs.pathExists(gitattributesPath)) {
    console.log(chalk.yellow('⚠️  No .gitattributes file found'));
    return;
  }
  
  const content = await fs.readFile(gitattributesPath, 'utf-8');
  
  if (!ATTRIBUTES_PATTERN.test(content)) {
    console.log(chalk.yellow('⚠️  Git filter not found in .gitattributes'));
    return;
  }
  
  // Remove lines related to kiro-sessions filter
  const lines = content.split('\n');
  const filtered = [];
  let skipComment = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip comment lines about Kiro
    if (line.includes('Kiro chat sessions')) {
      skipComment = true;
      continue;
    }
    
    // Skip lines with kiro-sessions filter
    if (line.includes('filter=kiro-sessions')) {
      skipComment = false;
      continue;
    }
    
    // Skip empty lines after comments
    if (skipComment && line.trim() === '') {
      skipComment = false;
      continue;
    }
    
    skipComment = false;
    filtered.push(line);
  }
  
  // Write back
  await fs.writeFile(gitattributesPath, filtered.join('\n'), 'utf-8');
  console.log(chalk.green('✓ Removed Git filter from .gitattributes'));
}
