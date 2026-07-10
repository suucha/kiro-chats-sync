import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { glob } from 'glob';

// Sanitization patterns
const SANITIZE_PATTERNS = {
  // API Keys & Secrets
  apiKeys: [
    /sk-[a-zA-Z0-9]{48}/g,                              // OpenAI
    /sk-proj-[a-zA-Z0-9_-]{48,}/g,                      // OpenAI Project (fixed length)
    /sk-proj-[a-zA-Z0-9_-]{20,}/g,                      // OpenAI Project (variable length)
    /AIza[0-9A-Za-z-_]{35}/g,                           // Google
    /ya29\.[0-9A-Za-z\-_]+/g,                           // Google OAuth
    /ghp_[a-zA-Z0-9]{36}/g,                             // GitHub Personal
    /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g,      // GitHub PAT
    /gho_[a-zA-Z0-9]{36}/g,                             // GitHub OAuth
    /glpat-[a-zA-Z0-9_-]{20}/g,                         // GitLab
    /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,  // Slack Bot
    /xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,  // Slack User
    /sk-ant-[a-zA-Z0-9_-]{20,}/g,                       // Anthropic
    /key-[a-zA-Z0-9]{32}/g,                             // Generic key-xxx
  ],
  
  // Passwords & Auth
  passwords: [
    /password["\s:=]+["']?[^"'\s]{8,}/gi,
    /passwd["\s:=]+["']?[^"'\s]{8,}/gi,
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    /Basic\s+[A-Za-z0-9+/]+=*/g,
  ],
  
  // Paths (Windows) - be careful to match full paths
  windowsPaths: [
    /[A-Z]:\\Users\\[^\\"\s]+/gi,                       // C:\Users\username
    /[A-Z]:\\[A-Za-z0-9_\-. \\]+(?=["'\s]|$)/g,        // Any absolute Windows path
  ],
  
  // Paths (Unix)
  unixPaths: [
    /\/home\/[^\/\s"']+/g,                              // /home/username
    /\/Users\/[^\/\s"']+/g,                             // /Users/username
    /\/root(?=\/|$)/g,                                  // /root
  ],
  
  // Personal Info
  email: [
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
  ],
  
  // IP Address
  ipAddress: [
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,    // IPv6
  ],
  
  // Environment Variables
  envVars: [
    /(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|DATABASE_URL|DB_PASSWORD|STRIPE_SECRET_KEY|STRIPE_PUBLISHABLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)[=:]\s*["']?[^"'\s\n]+/gi,
  ],
  
  // Database Connection Strings
  connectionStrings: [
    /(?:mongodb|mysql|postgresql|postgres|redis):\/\/[^\s"'\n]+/gi,
    /(?:Server|Data Source)=[^;]+;.*(?:Password|Pwd)=[^;]+/gi,
  ],
  
  // Private Keys
  privateKeys: [
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  ],
  
  // JWT Tokens
  jwt: [
    /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  ],
};

/**
 * Sanitize a single value (string, object, array, etc.)
 * @param {any} value - Value to sanitize
 * @param {string} projectRoot - Project root directory
 * @param {string} key - Current key name (for special handling)
 * @returns {any} Sanitized value
 */
function sanitizeValue(value, projectRoot, key = '') {
  // Handle null/undefined
  if (value == null) {
    return value;
  }
  
  // Special case: workspacePaths should always be empty array
  if (key === 'workspacePaths' && Array.isArray(value)) {
    return [];
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, projectRoot, `${key}[${index}]`));
  }
  
  // Handle objects
  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = sanitizeValue(v, projectRoot, k);
    }
    return result;
  }
  
  // Handle strings
  if (typeof value === 'string') {
    return sanitizeString(value, projectRoot);
  }
  
  // Other types (number, boolean, etc.) pass through
  return value;
}

/**
 * Sanitize a single string value
 * @param {string} str - String to sanitize
 * @param {string} projectRoot - Project root directory
 * @returns {string} Sanitized string
 */
function sanitizeString(str, projectRoot) {
  let result = str;
  
  // Skip if already sanitized
  if (result.includes('[REDACTED') || result.includes('<PROJECT_ROOT>') || result.includes('~')) {
    return result;
  }
  
  // 1. Sanitize API keys
  SANITIZE_PATTERNS.apiKeys.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_API_KEY]');
  });
  
  // 2. Sanitize passwords and auth tokens
  SANITIZE_PATTERNS.passwords.forEach(pattern => {
    result = result.replace(pattern, (match) => {
      const prefix = match.split(/[=:\s]/)[0];
      return `${prefix}=[REDACTED_PASSWORD]`;
    });
  });
  
  // 3. Sanitize environment variables
  SANITIZE_PATTERNS.envVars.forEach(pattern => {
    result = result.replace(pattern, (match) => {
      const prefix = match.split(/[=:]/)[0];
      return `${prefix}=[REDACTED]`;
    });
  });
  
  // 4. Sanitize connection strings
  SANITIZE_PATTERNS.connectionStrings.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_CONNECTION_STRING]');
  });
  
  // 5. Sanitize private keys
  SANITIZE_PATTERNS.privateKeys.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_PRIVATE_KEY]');
  });
  
  // 6. Sanitize JWT tokens
  SANITIZE_PATTERNS.jwt.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_JWT_TOKEN]');
  });
  
  // 7. Sanitize emails
  SANITIZE_PATTERNS.email.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_EMAIL]');
  });
  
  // 8. Sanitize IPs (but not version numbers)
  SANITIZE_PATTERNS.ipAddress.forEach(pattern => {
    result = result.replace(pattern, (match) => {
      // Skip if it looks like a version number (e.g., 1.0.0)
      if (/^\d+\.\d+\.\d+$/.test(match) && !match.match(/^(?:10|172|192)\./)) {
        return match;
      }
      return '[REDACTED_IP]';
    });
  });
  
  // 9. Sanitize paths
  result = sanitizePaths(result, projectRoot);
  
  return result;
}

/**
 * Sanitize paths in a string
 * @param {string} str - String to sanitize
 * @param {string} projectRoot - Project root directory
 * @returns {string} Sanitized string
 */
function sanitizePaths(str, projectRoot) {
  let result = str;
  
  const normalizedRoot = path.normalize(projectRoot).replace(/\\/g, '/').toLowerCase();
  const userHome = os.homedir().replace(/\\/g, '/').toLowerCase();
  
  // Windows paths (but avoid matching URLs like https://)
  // Use word boundary before drive letter to avoid matching protocol://
  result = result.replace(/(?<![:/])\b[A-Z]:[\\\/][\w\s\-._\\\/]+/gi, (match) => {
    const normalized = path.normalize(match).replace(/\\/g, '/').toLowerCase();
    
    // Project path → relative
    if (normalized.startsWith(normalizedRoot)) {
      const relative = normalized.substring(normalizedRoot.length).replace(/^\//, '');
      return relative ? `<PROJECT_ROOT>/${relative}` : '<PROJECT_ROOT>';
    }
    
    // User home → ~
    if (normalized.startsWith(userHome)) {
      const relative = normalized.substring(userHome.length).replace(/^\//, '');
      return relative ? `~/${relative}` : '~';
    }
    
    // Other paths → redact
    return '[REDACTED_PATH]';
  });
  
  // Unix paths (but avoid matching URLs)
  result = result.replace(/(?<!:\/\/|\w)\/(?:home|Users|root)\/[\w\s\-._\/]+/g, (match) => {
    const normalized = match.toLowerCase();
    
    // Project path
    if (normalized.includes(path.basename(projectRoot).toLowerCase())) {
      return `<PROJECT_ROOT>/${path.basename(match)}`;
    }
    
    // User home → ~
    if (normalized.startsWith(userHome)) {
      const relative = match.substring(userHome.length).replace(/^\//, '');
      return relative ? `~/${relative}` : '~';
    }
    
    return '[REDACTED_PATH]';
  });
  
  return result;
}

/**
 * Sanitize content by removing sensitive information
 * @param {string} content - Content to sanitize
 * @param {string} projectRoot - Project root directory
 * @returns {string} Sanitized content
 */
function sanitizeContent(content, projectRoot) {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(content);
    const sanitized = sanitizeValue(parsed, projectRoot);
    return JSON.stringify(sanitized, null, 2);
  } catch (e) {
    // If not valid JSON, fall back to string-based sanitization
    // This handles .jsonl files (one JSON per line)
    const lines = content.split('\n');
    const sanitizedLines = lines.map(line => {
      if (!line.trim()) {
        return line;
      }
      
      try {
        const parsed = JSON.parse(line);
        const sanitized = sanitizeValue(parsed, projectRoot);
        return JSON.stringify(sanitized);
      } catch (e2) {
        // Not JSON, treat as plain text
        return sanitizeString(line, projectRoot);
      }
    });
    
    return sanitizedLines.join('\n');
  }
}

/**
 * Sanitize a single session file
 * @param {string} filePath - Path to file
 * @param {string} projectRoot - Project root directory
 * @param {boolean} dryRun - If true, only check without modifying
 * @returns {Promise<{modified: boolean, changes: number}>}
 */
async function sanitizeFile(filePath, projectRoot, dryRun = false) {
  const content = await fs.readFile(filePath, 'utf-8');
  const sanitized = sanitizeContent(content, projectRoot);
  
  const modified = content !== sanitized;
  
  if (modified && !dryRun) {
    await fs.writeFile(filePath, sanitized, 'utf-8');
  }
  
  // Count changes (approximate)
  const changes = content.split('\n').filter((line, i) => {
    return sanitized.split('\n')[i] !== line;
  }).length;
  
  return { modified, changes };
}

/**
 * Sanitize all session files in .kiro-sessions directory
 * @param {object} options - Options
 * @param {string} options.cwd - Current working directory
 * @param {boolean} options.dryRun - If true, only check without modifying
 * @param {boolean} options.verbose - Show detailed output
 * @param {boolean} options.silent - Suppress all output
 * @returns {Promise<{filesChecked: number, filesModified: number, totalChanges: number}>}
 */
export async function sanitize({ cwd = process.cwd(), dryRun = false, verbose = false, silent = false } = {}) {
  const sessionsDir = path.join(cwd, '.kiro-sessions');
  
  if (!silent) {
    console.log(chalk.blue(`🔒 ${dryRun ? 'Checking' : 'Sanitizing'} sessions...`));
  }
  
  // Check if .kiro-sessions exists
  if (!await fs.pathExists(sessionsDir)) {
    if (!silent) {
      console.log(chalk.yellow('⚠️  No .kiro-sessions directory found'));
    }
    return { filesChecked: 0, filesModified: 0, totalChanges: 0 };
  }
  
  // Find all .jsonl and .json files
  const files = await glob('**/*.{json,jsonl}', {
    cwd: sessionsDir,
    absolute: true,
  });
  
  if (files.length === 0) {
    if (!silent) {
      console.log(chalk.yellow('⚠️  No session files found'));
    }
    return { filesChecked: 0, filesModified: 0, totalChanges: 0 };
  }
  
  let filesModified = 0;
  let totalChanges = 0;
  
  for (const file of files) {
    const { modified, changes } = await sanitizeFile(file, cwd, dryRun);
    
    if (modified) {
      filesModified++;
      totalChanges += changes;
      
      if (verbose && !silent) {
        const relativePath = path.relative(sessionsDir, file);
        console.log(chalk.yellow(`  ⚠️  ${relativePath}: ${changes} line(s) with sensitive data`));
      }
    }
  }
  
  if (!silent) {
    console.log(chalk.blue(`\nFiles checked: ${files.length}`));
    
    if (filesModified > 0) {
      if (dryRun) {
        console.log(chalk.yellow(`⚠️  ${filesModified} file(s) contain sensitive data (${totalChanges} line(s))`));
        console.log(chalk.yellow(`Run without --check to sanitize`));
      } else {
        console.log(chalk.green(`✓ Sanitized ${filesModified} file(s) (${totalChanges} line(s))`));
      }
    } else {
      console.log(chalk.green('✓ No sensitive data found'));
    }
  }
  
  return { filesChecked: files.length, filesModified, totalChanges };
}

/**
 * Check if sessions contain sensitive data
 * @param {object} options - Options
 * @returns {Promise<boolean>} True if sensitive data found
 */
export async function checkSensitiveData(options) {
  const result = await sanitize({ ...options, dryRun: true });
  return result.filesModified > 0;
}
