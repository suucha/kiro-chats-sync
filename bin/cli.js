#!/usr/bin/env node

import { program } from 'commander';
import { migrate } from '../lib/migrator.js';
import { sanitize, checkSensitiveData } from '../lib/sanitizer.js';
import { setupGitFilter, updateGitFilter, showGitFilterStatus } from '../lib/setup-git-filter.js';
import { addToGitignore, addGitattributesEntry } from '../lib/gitignore.js';
import { promptSecurityChoice } from '../lib/security-prompt.js';
import chalk from 'chalk';

program
  .name('kiro-chats-sync')
  .description('Sync Kiro IDE chat sessions to your project directory')
  .version('0.1.0')
  .option('-d, --dry-run', 'Preview changes without executing')
  .option('-v, --verbose', 'Show detailed output')
  .option('-f, --fix', 'Fix symlinks after moving project to a new location')
  .option('--sanitize', 'Sanitize sessions (remove sensitive data)')
  .option('--check', 'Check for sensitive data without modifying')
  .option('--setup-git-filter', 'Setup Git filter for auto-sanitization')
  .option('--update-git-filter', 'Update Git filter to latest version')
  .option('--status', 'Show Git filter status')
  .option('--gitignore', 'Add .kiro-sessions/ to .gitignore')
  .option('--silent', 'Suppress output (for use in filters)')
  .action(async (options) => {
    try {
      const cwd = process.cwd();
      
      // Handle Git filter commands (these exit early)
      if (options.setupGitFilter) {
        if (!options.silent) {
          console.log(chalk.blue('🔧 Setting up Git filter...\n'));
        }
        await setupGitFilter(cwd);
        await addGitattributesEntry(cwd);
        return;
      }
      
      if (options.updateGitFilter) {
        await updateGitFilter(cwd);
        return;
      }
      
      if (options.status) {
        await showGitFilterStatus(cwd);
        return;
      }
      
      if (options.gitignore) {
        if (!options.silent) {
          console.log(chalk.blue('📝 Adding to .gitignore...\n'));
        }
        await addToGitignore(cwd);
        return;
      }
      
      if (options.sanitize || options.check) {
        await sanitize({
          cwd,
          dryRun: options.check,
          verbose: options.verbose,
          silent: options.silent,
        });
        return;
      }
      
      // Normal sync operation
      if (!options.silent) {
        console.log(chalk.blue('🔍 Kiro Chat Sync Tool\n'));
      }
      
      await migrate({
        dryRun: options.dryRun,
        verbose: options.verbose,
        fixMode: options.fix,
        cwd,
      });
      
      if (!options.silent) {
        console.log(chalk.green('\n✅ Sync completed successfully!'));
        
        // Show security prompt on first run (only for normal sync, not dry-run)
        if (!options.dryRun) {
          await promptSecurityChoice(cwd);
        }
      }
    } catch (error) {
      if (!options.silent) {
        console.error(chalk.red('\n❌ Error:'), error.message);
        if (options.verbose) {
          console.error(error.stack);
        }
      }
      process.exit(1);
    }
  });

program.parse();
