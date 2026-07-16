/**
 * Build a changelist description from an agent's task intent, prefixing it so
 * p4pilot-created changelists are recognizable. Never double-prefixes.
 */
export function buildChangelistDescription(intent: string, prefix = "[p4pilot] "): string {
  const trimmed = intent.trim();
  if (trimmed.length === 0) return prefix.trimEnd();
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
}
