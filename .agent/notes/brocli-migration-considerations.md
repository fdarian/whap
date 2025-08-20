# Brocli Migration Considerations

## Overview
This document outlines important considerations, potential challenges, and technical details for migrating the WhatsApp CLI from dual entry points to a unified Brocli-based command structure.

## Technical Architecture Changes

### Current Architecture
```
src/
├── index.tsx          # TUI entry point (React + Ink)
├── server/
│   └── server.ts      # Server entry point (Hono)
└── components/        # Shared components
```

### Target Architecture
```
src/
├── index.ts           # Main CLI entry (Brocli)
├── commands/
│   ├── server.ts      # Server command
│   └── tui.ts         # TUI command
├── tui/
│   └── index.tsx      # TUI implementation
└── server/            # Server implementation (unchanged)
```

## Key Technical Challenges

### 1. ES Modules and Import Paths
**Challenge**: The project uses ES modules with explicit `.ts`/`.tsx` extensions
**Solution**: All import statements must be updated carefully when moving files
**Risk**: TypeScript compilation errors if imports are incorrect

### 2. Signal Handling Coordination
**Challenge**: Both main CLI and commands need proper signal handling
**Solution**: Coordinate signal handlers to avoid conflicts
**Risk**: Zombie processes or improper cleanup

### 3. Environment Variable Management
**Challenge**: Multiple layers of configuration (CLI args, env vars, defaults)
**Solution**: Clear precedence order: CLI args > env vars > defaults
**Risk**: Confusion about which configuration takes effect

### 4. React/Ink Integration with Brocli
**Challenge**: Ensuring React rendering works correctly within Brocli command
**Solution**: Proper async handling and cleanup in command handlers
**Risk**: Memory leaks or React warnings

## Implementation Strategies

### Minimal Change Approach
- Wrap existing functionality without rewriting core logic
- Preserve all existing behavior and APIs
- Maintain backward compatibility where possible

### Error Handling Strategy
- Comprehensive error messages with helpful guidance
- Graceful degradation for missing dependencies
- Clear distinction between user errors and system errors

### Testing Strategy
- Test both development (tsx) and production (compiled) versions
- Verify functionality parity with original implementation
- Test edge cases and error scenarios thoroughly

## Potential Risks and Mitigations

### Risk: Import Path Issues
**Mitigation**: 
- Use absolute paths where possible
- Test compilation after each file move
- Maintain a checklist of import updates needed

### Risk: Signal Handler Conflicts
**Mitigation**:
- Document signal handling strategy clearly
- Test interruption scenarios thoroughly
- Ensure clean shutdown in all cases

### Risk: Breaking Changes
**Mitigation**:
- Preserve existing script names in package.json
- Maintain identical functionality for all features
- Test with real user scenarios

### Risk: Performance Regression
**Mitigation**:
- Benchmark startup times before and after
- Monitor memory usage during development
- Profile command execution paths

## Configuration Management

### Command Line Arguments
- Server: `--port` for port selection
- TUI: `--server` for server URL
- Global: `--help`, `--version`

### Environment Variables
- `PORT`: Server port (fallback)
- `WHAP_SERVER_URL`: TUI server URL (fallback)
- `NODE_ENV`: Environment detection
- `FORCE_COLOR`: Color support override

### Precedence Order
1. Command line arguments (highest priority)
2. Environment variables
3. Default values (lowest priority)

## Development Workflow Changes

### Before (Current)
```bash
# Two separate commands
pnpm run start:server
pnpm run start:cli
```

### After (Target)
```bash
# Unified CLI with commands
pnpm whap server
pnpm whap tui
```

### Development Scripts
```bash
# Development (with tsx)
pnpm run dev:server    # tsx src/index.ts server
pnpm run dev:tui       # tsx src/index.ts tui

# Production (compiled)
node dist/index.js server
node dist/index.js tui
```

## Package Distribution Considerations

### Bin Field Configuration
```json
{
  "bin": {
    "whap": "./dist/index.js"
  }
}
```

### Global Installation
After implementation, users can install globally:
```bash
npm install -g whap
whap server --port 3010
whap tui --server http://localhost:3010
```

### Package Scripts Update
- Maintain backward compatibility for existing scripts
- Add new unified scripts
- Clear documentation for script usage

## TypeScript Compilation Requirements

### tsconfig.json Considerations
- Ensure `outDir` points to `dist/`
- Maintain ES module target
- Include proper module resolution
- Handle React JSX compilation

### Build Process
- Clean build directory before compilation
- Ensure shebang is preserved in output
- Verify all imports resolve correctly
- Test compiled output functionality

## User Experience Improvements

### Help System
- Auto-generated help from Brocli
- Command-specific help with examples
- Clear error messages with guidance

### Error Handling
- Graceful failure modes
- Helpful error messages
- Recovery suggestions

### Startup Feedback
- Clear progress indicators
- Success confirmations
- Helpful status information

## Testing Checklist

### Functional Testing
- [ ] Server starts correctly with all options
- [ ] TUI starts correctly with all options
- [ ] Help commands work properly
- [ ] Error handling is comprehensive

### Integration Testing
- [ ] Server + TUI integration works
- [ ] WebSocket connectivity maintained
- [ ] API endpoints function correctly
- [ ] Real-time updates work

### Regression Testing
- [ ] All existing functionality preserved
- [ ] Performance is comparable
- [ ] Memory usage is reasonable
- [ ] No new error conditions introduced

## Migration Timeline Considerations

### Phase 1: Foundation (Tasks 1-3)
- Install dependencies
- Restructure files
- Create basic CLI framework

### Phase 2: Implementation (Tasks 4-6)
- Implement commands
- Update package configuration
- Basic functionality testing

### Phase 3: Validation (Tasks 7-9)
- Comprehensive testing
- Error handling validation
- User experience verification

## Post-Migration Maintenance

### Documentation Updates
- Update README with new command structure
- Document new CLI options
- Provide migration guide if needed

### Monitoring Considerations
- Watch for user issues with new CLI
- Monitor performance metrics
- Collect feedback on user experience

### Future Enhancements
- Additional commands can be easily added
- Command-specific configuration options
- Enhanced help and documentation system

## Rollback Strategy

If issues are discovered:
1. **Immediate rollback**: Revert package.json scripts to old structure
2. **Partial rollback**: Keep new structure but maintain old entry points
3. **Gradual migration**: Support both old and new patterns temporarily

## Success Metrics

### Technical Success
- Zero regressions in functionality
- Maintained or improved performance
- Clean TypeScript compilation
- Comprehensive test coverage

### User Experience Success
- Improved discoverability of features
- Better error messages and guidance
- Simplified mental model for users
- Clear documentation and help

---
*Document created: 2025-08-20*
*Last updated: 2025-08-20*