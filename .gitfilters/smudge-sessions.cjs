#!/usr/bin/env node

/**
 * Git smudge filter for Kiro chat sessions
 * 
 * Currently just passes through content unchanged.
 * In the future, could potentially restore some sanitized content
 * from environment variables or secure storage.
 * 
 * Usage in .git/config:
 * [filter "kiro-sessions"]
 *   clean = node .gitfilters/clean-sessions.js
 *   smudge = node .gitfilters/smudge-sessions.js
 */

// For now, just pass through content unchanged
// (same as using "smudge = cat")
let data = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  data += chunk;
});

process.stdin.on('end', () => {
  process.stdout.write(data);
});
