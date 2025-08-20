# Task 2: Move TUI Entry Point and Update Imports

## Overview
Restructure the project by moving the current TUI entry point from `src/index.tsx` to `src/tui/index.tsx` and updating any imports that reference the old location.

## Implementation Steps

1. **Create TUI directory**
   ```bash
   mkdir -p src/tui
   ```

2. **Move the TUI entry point**
   ```bash
   mv src/index.tsx src/tui/index.tsx
   ```

3. **Update imports in the moved file**
   Edit `src/tui/index.tsx` to update relative imports:
   - `./components/WhatsAppTestCLI.tsx` → `../components/WhatsAppTestCLI.tsx`
   - `./utils/terminal.ts` → `../utils/terminal.ts`

4. **Search for any references to the old location**
   Check for files that might import or reference `src/index.tsx`:
   ```bash
   grep -r "index.tsx" src/ --exclude-dir=node_modules
   grep -r "src/index" . --exclude-dir=node_modules
   ```

5. **Update package.json scripts (if needed)**
   Check if any scripts reference the old path and update them temporarily:
   - `start:cli` script should point to new location: `tsx src/tui/index.tsx`

## File Changes

### src/tui/index.tsx (moved from src/index.tsx)
```typescript
#!/usr/bin/env node
import { render } from 'ink'
import { WhatsAppTestCLI } from '../components/WhatsAppTestCLI.tsx'
import { getTerminalInfo } from '../utils/terminal.ts'
import 'dotenv/config'

// ... rest of the file remains the same
```

### package.json (temporary update)
```json
{
  "scripts": {
    "start:cli": "tsx src/tui/index.tsx",
    // ... other scripts remain the same
  }
}
```

## Technical Requirements

- Maintain the shebang line `#!/usr/bin/env node` at the top of the moved file
- Keep all existing functionality exactly the same
- Ensure all imports use explicit `.tsx`/`.ts` extensions
- Preserve all signal handlers and cleanup logic
- Maintain dotenv configuration import

## Validation Steps

1. **File structure check**:
   ```bash
   ls -la src/tui/index.tsx  # Should exist
   ls -la src/index.tsx      # Should not exist
   ```

2. **Import verification**:
   ```bash
   # Verify the TUI still starts correctly
   pnpm run start:cli
   ```

3. **TypeScript compilation**:
   ```bash
   # Ensure no compilation errors
   npx tsc --noEmit
   ```

## Expected Directory Structure After Changes

```
src/
├── tui/
│   └── index.tsx          # Moved from src/index.tsx
├── components/
├── server/
└── utils/
```

## Notes

- This is a preparatory step for the main Brocli integration
- The temporary script update will be replaced in Task 6 when we update package.json for the new CLI structure
- All existing functionality should work identically after this move
- The shebang is important for executable behavior

## Dependencies

- None (this is just file restructuring)

## Next Steps

After completion, proceed to [Task 3: Create main CLI entry point with Brocli](./task_3.md)

## Completion Notes

**Completion Date:** 2025-08-20

**Implementation Summary:**
Successfully moved TUI entry point from `src/index.tsx` to `src/tui/index.tsx`. Updated all relative imports in the moved file and updated package.json scripts. Also updated relevant documentation files to reflect the new location.

**Challenges Encountered:**
- None - straightforward file restructuring

**Lessons Learned:**
- Documentation files (CLAUDE.md, .cursor/rules/) also needed updating to reflect new file locations
- The TUI works perfectly from its new location

**Follow-up Items:**
- [x] Task completed successfully