# Task 8: Test TUI Command Functionality

## Overview
Thoroughly test the new `tui` command implementation to ensure all interactive functionality works correctly and identically to the original TUI implementation.

## Testing Strategy

### 1. Basic TUI Startup
Test that the TUI starts correctly with default and custom configurations.

### 2. User Interface Elements
Verify that all UI components render and function properly.

### 3. Server Connectivity
Test connection to the mock server and API interactions.

### 4. Interactive Features
Test user input, message sending, and real-time updates.

### 5. Terminal Compatibility
Test across different terminal environments and configurations.

## Implementation Steps

### Step 1: Basic TUI Startup Tests

1. **Default startup**:
   ```bash
   pnpm whap tui
   ```
   Expected output:
   ```
   🚀 Starting WhatsApp Test CLI...
   Starting interactive interface...
   ✅ Interactive interface started successfully
   Press Ctrl+C to exit
   [TUI interface appears]
   ```

2. **Custom server URL**:
   ```bash
   pnpm whap tui --server http://localhost:8080
   ```
   Expected: TUI connects to custom server

3. **Help command**:
   ```bash
   pnpm whap tui --help
   ```
   Expected: Shows command help with server option

4. **Environment variable test**:
   ```bash
   WHAP_SERVER_URL=http://localhost:9000 pnpm whap tui
   ```

### Step 2: Terminal Compatibility Tests

1. **Standard terminal (bash/zsh)**:
   ```bash
   TERM=xterm-256color pnpm whap tui
   ```

2. **Limited color terminal**:
   ```bash
   TERM=xterm pnpm whap tui
   ```

3. **No color terminal**:
   ```bash
   TERM=dumb pnpm whap tui
   ```

4. **Warp terminal**:
   ```bash
   # If using Warp terminal
   pnpm whap tui
   # Verify FORCE_COLOR=1 is set automatically
   ```

5. **CI/Non-interactive environment**:
   ```bash
   # Test behavior in non-TTY environment
   echo "test" | pnpm whap tui
   ```

### Step 3: User Interface Verification

#### Visual Elements Checklist
- [ ] Main chat interface loads
- [ ] Message composer is visible
- [ ] Status bar displays correctly
- [ ] Conversation view renders properly
- [ ] Layout is responsive to terminal size

#### Navigation Tests
1. **Tab navigation**: Verify tab key moves between UI elements
2. **Enter key**: Test message sending
3. **Escape key**: Test cancellation/exit
4. **Arrow keys**: Test navigation within components
5. **Ctrl+C**: Test graceful exit

### Step 4: Server Connectivity Tests

#### Prerequisites
Start the mock server:
```bash
# In another terminal
pnpm whap server
```

#### Connection Tests
1. **Successful connection**:
   ```bash
   pnpm whap tui
   ```
   Expected: TUI connects to server successfully

2. **Server unavailable**:
   ```bash
   # Stop the server, then try TUI
   pnpm whap tui
   ```
   Expected: Graceful error handling

3. **Custom server connection**:
   ```bash
   pnpm whap tui --server http://localhost:3010
   ```

4. **Invalid server URL**:
   ```bash
   pnpm whap tui --server invalid-url
   ```
   Expected: Proper error message

### Step 5: Interactive Functionality Tests

#### Message Sending
1. **Text message sending**:
   - Type a message
   - Press Enter
   - Verify message appears in conversation
   - Check server receives the message

2. **Template message sending**:
   - Select template option
   - Choose a template
   - Verify template message is sent

3. **Message history**:
   - Send multiple messages
   - Verify message history is maintained
   - Check conversation scrolling

#### Real-time Updates
1. **WebSocket connectivity**:
   - Verify WebSocket connection is established
   - Test real-time message updates

2. **Server events**:
   - Trigger server events (via API or another client)
   - Verify TUI receives and displays updates

#### Error Handling
1. **Network interruption**:
   - Disconnect network during operation
   - Verify graceful degradation

2. **Invalid input**:
   - Enter invalid phone numbers
   - Enter malformed messages
   - Verify proper error feedback

### Step 6: Advanced Feature Tests

#### Configuration Management
1. **Settings persistence**: Test if settings are saved between sessions
2. **Phone number validation**: Test phone number input validation
3. **Template management**: Test template selection and usage

#### Performance Tests
1. **Large message history**: Test with many messages
2. **Rapid input**: Test fast typing and message sending
3. **Memory usage**: Monitor memory consumption during extended use

### Step 7: Integration Tests

#### End-to-End Workflow
1. **Complete conversation flow**:
   ```bash
   # Terminal 1: Start server
   pnpm whap server
   
   # Terminal 2: Start TUI
   pnpm whap tui
   
   # Terminal 3: Send webhook (simulate incoming message)
   curl -X POST http://localhost:3010/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "object": "whatsapp_business_account",
       "entry": [{
         "id": "ENTRY_ID",
         "changes": [{
           "value": {
             "messaging_product": "whatsapp",
             "metadata": {
               "display_phone_number": "1234567890",
               "phone_number_id": "PHONE_NUMBER_ID"
             },
             "messages": [{
               "from": "1234567890",
               "id": "MESSAGE_ID",
               "timestamp": "1234567890",
               "text": {
                 "body": "Hello from webhook"
               },
               "type": "text"
             }]
           },
           "field": "messages"
         }]
       }]
     }'
   ```
   Expected: Message appears in TUI in real-time

## Validation Checklist

### Startup and Configuration
- [ ] TUI starts with default server URL
- [ ] Custom server URL argument works
- [ ] Help command displays correctly
- [ ] Environment variables are respected
- [ ] Startup messages are clear and informative

### Terminal Compatibility
- [ ] Works in standard terminals (bash, zsh)
- [ ] Handles limited color support gracefully
- [ ] Works in Warp terminal with optimizations
- [ ] Provides helpful errors in unsupported environments
- [ ] Unicode support detection works

### User Interface
- [ ] Main interface renders correctly
- [ ] All UI components are visible and functional
- [ ] Layout adapts to terminal size changes
- [ ] Navigation between components works
- [ ] Text input and editing functions properly

### Server Communication
- [ ] Successfully connects to running server
- [ ] Handles server unavailability gracefully
- [ ] Custom server URLs work correctly
- [ ] WebSocket connection is established
- [ ] Real-time updates are received

### Interactive Features
- [ ] Message composition and sending works
- [ ] Template selection and sending works
- [ ] Message history is maintained
- [ ] Conversation scrolling works
- [ ] Phone number input validation works

### Error Handling
- [ ] Network errors are handled gracefully
- [ ] Invalid input shows helpful messages
- [ ] Graceful shutdown with Ctrl+C
- [ ] Memory leaks are avoided during extended use

## Test Scenarios

### Scenario 1: First-time User Experience
```bash
# Clean environment test
rm -rf ~/.whap-config  # If config exists
pnpm whap tui
# Verify onboarding/setup experience
```

### Scenario 2: Multi-terminal Session
```bash
# Terminal 1: Server
pnpm whap server

# Terminal 2: TUI instance 1
pnpm whap tui

# Terminal 3: TUI instance 2
pnpm whap tui

# Verify both TUI instances work independently
```

### Scenario 3: Production-like Environment
```bash
# Build and test compiled version
pnpm run build
node dist/index.js tui
```

## Automated Testing Script

Create a test script for basic validation:

```bash
#!/bin/bash
# test-tui.sh

echo "🧪 Testing WhatsApp TUI..."

# Start server in background
pnpm whap server &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test TUI help
echo "Testing TUI help..."
timeout 5 pnpm whap tui --help

# Test TUI startup (non-interactive)
echo "Testing TUI startup..."
echo -e "\n" | timeout 10 pnpm whap tui || echo "⚠️  TUI test completed"

# Test with custom server
echo "Testing custom server..."
echo -e "\n" | timeout 10 pnpm whap tui --server http://localhost:3010 || echo "⚠️  Custom server test completed"

# Cleanup
echo "Stopping server..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null

echo "✅ TUI tests completed"
```

## Manual Testing Guide

### Visual Inspection Checklist
1. **Layout**:
   - [ ] Header displays application name/version
   - [ ] Message area is clearly defined
   - [ ] Input area is at the bottom
   - [ ] Status information is visible

2. **Colors and Styling**:
   - [ ] Colors are appropriate and readable
   - [ ] Highlighting works for selected elements
   - [ ] Message differentiation is clear

3. **Responsiveness**:
   - [ ] Interface adapts to terminal resize
   - [ ] Text wrapping works correctly
   - [ ] Scrolling behaves properly

### Interaction Testing
1. **Type test messages** and verify they appear correctly
2. **Test tab completion** if implemented
3. **Test command shortcuts** if available
4. **Verify error messages** are user-friendly

## Notes

- Test both development (tsx) and production (compiled) versions
- Compare behavior with original TUI implementation
- Test on different terminal sizes (narrow, wide, tall, short)
- Verify accessibility features if implemented
- Document any differences in behavior

## Dependencies

- Running mock server for connectivity tests
- Different terminal environments for compatibility tests
- Network simulation tools for error testing (optional)

## Next Steps

After completion, proceed to [Task 9: Verify help command and error handling](./task_9.md)

## Completion Notes
<!-- Fill out this section when the task is completed -->

**Completion Date:** [Date]

**Implementation Summary:**
[Brief summary of what was implemented]

**Challenges Encountered:**
- [Challenge 1]
- [Challenge 2]

**Lessons Learned:**
- [Lesson 1]
- [Lesson 2]

**Follow-up Items:**
- [ ] [Any follow-up task 1]
- [ ] [Any follow-up task 2]