import * as path from 'path';

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

export function normalizeRequirePath(requirePath: string): string {
  // Convert Lua dot notation into slash-based paths while preserving leading ./ or ../ segments.
  const segments = requirePath.split('/');
  let pastLeadingDots = false;

  return segments
    .map((segment) => {
      // Preserve all leading . and .. segments
      if (!pastLeadingDots && (segment === '.' || segment === '..')) {
        return segment;
      }
      // Once we hit a non-dot segment, start converting dots to slashes
      pastLeadingDots = true;
      return segment.replace(/\./g, '/');
    })
    .join('/');
}

export function moduleNameFromPath(absPath: string, rootDir: string): string {
  const relative = toPosix(path.relative(rootDir, absPath));
  const withoutExt = relative.endsWith('.lua') ? relative.slice(0, -4) : relative;
  if (withoutExt.endsWith('/init')) {
    return withoutExt.slice(0, -5);
  }
  return withoutExt;
}
