import { resolve, relative } from 'node:path';

/**
 * Asserts that a candidate path is contained within a specified root directory.
 * This prevents path traversal attacks by ensuring that resolved paths do not
 * escape the intended boundary.
 *
 * @param root - The absolute path to the root directory.
 * @param candidate - The relative or absolute path to check.
 * @throws Error if the candidate path is outside the root directory.
 */
export function assertPathWithinRoot(root: string, candidate: string): string {
  const absoluteRoot = resolve(root);
  // Resolve candidate relative to root if it's not absolute
  const absoluteCandidate = resolve(absoluteRoot, candidate);
  const relativePath = relative(absoluteRoot, absoluteCandidate);

  const isOutside = relativePath.startsWith('..') || relativePath.startsWith('/');

  if (isOutside) {
    throw new Error(`Security Violation: Path ${candidate} is outside of allowed root ${root}`);
  }

  return absoluteCandidate;
}
