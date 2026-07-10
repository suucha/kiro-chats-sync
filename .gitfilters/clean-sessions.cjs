#!/usr/bin/env node

/**
 * Git clean filter for Kiro chat sessions
 * Removes sensitive data before committing to Git
 * 
 * Usage in .git/config:
 * [filter "kiro-sessions"]
 *   clean = node .gitfilters/clean-sessions.js
 *   smudge = cat
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Get project root (where .git directory is)
const projectRoot = process.env.GIT_WORK_TREE || process.cwd();

// Pattern definitions for sensitive data
const patterns = {
  // API Keys
  apiKeys: [
    // OpenAI
    /sk-[a-zA-Z0-9]{48}/g,
    /sk-proj-[a-zA-Z0-9_-]{48,}/g,
    /sk-proj-[a-zA-Z0-9_-]{20,}/g,
    // Google
    /AIza[0-9A-Za-z-_]{35}/g,
    /ya29\.[0-9A-Za-z\-_]+/g,
    // GitHub
    /ghp_[a-zA-Z0-9]{36}/g,
    /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g,
    /gho_[a-zA-Z0-9]{36}/g,
    // GitLab
    /glpat-[a-zA-Z0-9_-]{20}/g,
    // Slack
    /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
    /xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
    // Anthropic (for Kiro/Claude)
    /sk-ant-[a-zA-Z0-9_-]{20,}/g,
    // Generic patterns
    /key-[a-zA-Z0-9]{32}/g,
    /[a-f0-9]{64}/g,  // SHA256
    /[a-f0-9]{40}/g,  // SHA1
  ],
  
  // Passwords and tokens in JSON
  credentials: [
    /"(apiKey|api_key|primaryApiKey|authorization|token|bearer|password|passwd)"\s*:\s*"[^"]+"/gi,
    /"ANTHROPIC_AUTH_TOKEN"\s*:\s*"[^"]+"/gi,
  ],
  
  // Bearer tokens
  bearerTokens: [
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    /Basic\s+[A-Za-z0-9+/]+=*/g,
  ],
  
  // JWT tokens
  jwt: [
    /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  ],
  
  // Connection strings
  connectionStrings: [
    /(?:mongodb|mysql|postgresql|postgres|redis):\/\/[^\s"'\n]+/gi,
  ],
  
  // Private keys
  privateKeys: [
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  ],
  
  // Email addresses
  emails: [
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
  ],
  
  // IP addresses (but preserve version numbers)
  ips: [
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  ],
};

/**
 * Sanitize a single value (string, object, array, etc.)
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
 */
function sanitizeString(str, projectRoot) {
  let result = str;
  
  // Skip if already sanitized
  if (result.includes('[REDACTED') || result.includes('<PROJECT_ROOT>') || result.includes('~')) {
    return result;
  }
  
  // 1. API keys
  patterns.apiKeys.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_API_KEY]');
  });
  
  // 2. Credentials in JSON
  patterns.credentials.forEach(pattern => {
    result = result.replace(pattern, (match) => {
      const keyMatch = match.match(/"([^"]+)"/);
      if (keyMatch) {
        return `"${keyMatch[1]}": "[REDACTED]"`;
      }
      return match;
    });
  });
  
  // 3. Bearer tokens
  patterns.bearerTokens.forEach(pattern => {
    result = result.replace(pattern, (match) => {
      const prefix = match.split(/\s/)[0];
      return `${prefix} [REDACTED]`;
    });
  });
  
  // 4. JWT tokens
  patterns.jwt.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_JWT_TOKEN]');
  });
  
  // 5. Connection strings
  patterns.connectionStrings.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_CONNECTION_STRING]');
  });
  
  // 6. Private keys
  patterns.privateKeys.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_PRIVATE_KEY]');
  });
  
  // 7. Emails
  patterns.emails.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED_EMAIL]');
  });
  
  // 8. IPs (but not version numbers)
  patterns.ips.forEach(pattern => {
    result = result.replace(pattern, (match) => {
      if (/^\d+\.\d+\.\d+$/.test(match) && !match.match(/^(?:10|172|192)\./)) {
        return match;
      }
      return '[REDACTED_IP]';
    });
  });
  
  // 9. Paths
  result = sanitizePaths(result, projectRoot);
  
  return result;
}

/**
 * Sanitize paths in a string
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
 * Main cleaning function
 */
function cleanContent(data) {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(data);
    const sanitized = sanitizeValue(parsed, projectRoot);
    return JSON.stringify(sanitized, null, 2);
  } catch (e) {
    // If not valid JSON, fall back to line-by-line sanitization
    // This handles .jsonl files (one JSON per line)
    const lines = data.split('\n');
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

// Read from stdin
let data = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  data += chunk;
});

process.stdin.on('end', () => {
  try {
    const cleaned = cleanContent(data);
    process.stdout.write(cleaned);
  } catch (error) {
    // On error, output original content to avoid breaking git
    console.error('Error in clean filter:', error.message);
    process.stdout.write(data);
  }
});
