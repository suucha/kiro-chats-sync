import chalk from 'chalk';
import readline from 'readline';
import { addToGitignore, checkGitignoreEntry, addGitattributesEntry } from './gitignore.js';
import { setupGitFilter, checkGitFilterConfigured } from './setup-git-filter.js';

/**
 * Prompt user for input with default value
 * @param {string} question - Question to ask
 * @param {string} defaultValue - Default value if user presses enter
 * @returns {Promise<string>} User's answer
 */
function promptUser(question, defaultValue = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Show security notice and prompt user for choice
 * @param {string} cwd - Current working directory
 * @returns {Promise<void>}
 */
export async function promptSecurityChoice(cwd = process.cwd()) {
  // Check if already configured
  const hasGitignore = await checkGitignoreEntry(cwd);
  const hasFilter = await checkGitFilterConfigured(cwd);
  
  // If either is configured, skip prompt
  if (hasGitignore || hasFilter) {
    return;
  }
  
  // Display security notice
  console.log(chalk.yellow('\n⚠️  Security Notice: Session Privacy'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log('Your chat sessions may contain sensitive information:');
  console.log(chalk.gray('  • API keys and tokens'));
  console.log(chalk.gray('  • Absolute file paths'));
  console.log(chalk.gray('  • Personal information'));
  console.log('');
  console.log('Choose how to handle ' + chalk.cyan('.kiro-sessions/') + ':');
  console.log('');
  console.log(chalk.green('  1. [Recommended] Exclude from Git') + ' (add to .gitignore)');
  console.log(chalk.gray('     → Keeps sessions completely private'));
  console.log('');
  console.log(chalk.blue('  2. Commit with auto-sanitization') + ' (setup Git filter)');
  console.log(chalk.gray('     → Removes sensitive data before each commit'));
  console.log('');
  console.log(chalk.gray('  3. Skip') + ' (I\'ll decide later)');
  console.log('');
  
  // Prompt for choice (default to 1)
  const choice = await promptUser(
    chalk.bold('Your choice [1/2/3] (default: 1): '),
    '1'
  );
  
  console.log(''); // Empty line for spacing
  
  switch (choice) {
    case '1':
      await addToGitignore(cwd);
      console.log(chalk.green('✓ Added .kiro-sessions/ to .gitignore'));
      console.log(chalk.gray('  Sessions will stay private on your machine.'));
      break;
      
    case '2':
      await setupGitFilter(cwd);
      await addGitattributesEntry(cwd);
      console.log(chalk.green('✓ Configured Git filter for auto-sanitization'));
      console.log(chalk.gray('  Sessions will be cleaned before each commit.'));
      console.log('');
      console.log(chalk.gray('  Test it: ' + chalk.cyan('git add .kiro-sessions/ && git commit -m "test"')));
      break;
      
    case '3':
      console.log(chalk.yellow('⚠️  Remember to secure your sessions before committing!'));
      console.log(chalk.gray('  Run later: ' + chalk.cyan('kiro-chats-sync --setup-git-filter')));
      console.log(chalk.gray('         or: ' + chalk.cyan('kiro-chats-sync --gitignore')));
      break;
      
    default:
      console.log(chalk.yellow('⚠️  Invalid choice. Skipping for now.'));
      console.log(chalk.gray('  Run later: ' + chalk.cyan('kiro-chats-sync --setup-git-filter')));
      console.log(chalk.gray('         or: ' + chalk.cyan('kiro-chats-sync --gitignore')));
      break;
  }
}

/**
 * Show a simplified security reminder (for non-interactive scenarios)
 * @param {string} cwd - Current working directory
 */
export async function showSecurityReminder(cwd = process.cwd()) {
  const hasGitignore = await checkGitignoreEntry(cwd);
  const hasFilter = await checkGitFilterConfigured(cwd);
  
  if (hasGitignore || hasFilter) {
    return; // Already configured
  }
  
  console.log('');
  console.log(chalk.yellow('💡 Tip: Secure your sessions before committing to Git'));
  console.log(chalk.gray('   Run: ' + chalk.cyan('kiro-chats-sync --gitignore') + ' or ' + chalk.cyan('kiro-chats-sync --setup-git-filter')));
}
