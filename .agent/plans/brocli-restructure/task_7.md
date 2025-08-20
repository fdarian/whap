# Task 7: Test Server Command Functionality

## Overview
Thoroughly test the new `server` command implementation to ensure all functionality works correctly and identically to the original server implementation.

## Testing Strategy

### 1. Basic Server Startup
Test that the server starts correctly with default and custom configurations.

### 2. API Endpoint Functionality
Verify that all WhatsApp mock API endpoints work as expected.

### 3. WebSocket Connectivity
Test WebSocket connections and real-time functionality.

### 4. Template System
Verify template loading, hot-reload, and management features.

### 5. Error Handling
Test error scenarios and graceful shutdown behavior.

## Implementation Steps

### Step 1: Basic Server Startup Tests

1. **Default port startup**:
   ```bash
   pnpm whap server
   ```
   Expected output:
   ```
   🚀 Starting WhatsApp Mock Server...
   ✅ Template store initialized
   🚀 Server is running on port 3010
   🔌 WebSocket server is running on ws://localhost:3010/ws
   🏥 Health check: http://localhost:3010/health
   Press Ctrl+C to stop the server
   ```

2. **Custom port startup**:
   ```bash
   pnpm whap server --port 8080
   ```
   Expected: Server starts on port 8080

3. **Environment variable override**:
   ```bash
   PORT=9000 pnpm whap server
   ```
   Expected: Server starts on port 9000

4. **Help command**:
   ```bash
   pnpm whap server --help
   ```
   Expected: Shows command help with port option

### Step 2: Health Check and Basic API Tests

1. **Health check endpoint**:
   ```bash
   curl http://localhost:3010/health
   ```
   Expected response:
   ```json
   {
     "ok": true,
     "message": "Server is healthy",
     "templates": { /* template stats */ }
   }
   ```

2. **Debug endpoints** (development mode):
   ```bash
   curl http://localhost:3010/debug/templates
   curl -X POST http://localhost:3010/debug/reload-templates
   ```

3. **404 handling**:
   ```bash
   curl http://localhost:3010/nonexistent
   ```
   Expected: 404 response with proper error format

### Step 3: WhatsApp API Endpoint Tests

1. **Messages endpoint**:
   ```bash
   curl -X POST http://localhost:3010/v22.0/PHONE_NUMBER_ID/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "messaging_product": "whatsapp",
       "to": "1234567890",
       "type": "text",
       "text": {
         "body": "Hello World"
       }
     }'
   ```

2. **Templates endpoint**:
   ```bash
   curl http://localhost:3010/v22.0/BUSINESS_ACCOUNT_ID/message_templates
   ```

3. **Status endpoint**:
   ```bash
   curl http://localhost:3010/status
   ```

4. **Webhook endpoint**:
   ```bash
   curl -X POST http://localhost:3010/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "object": "whatsapp_business_account",
       "entry": []
     }'
   ```

### Step 4: WebSocket Connectivity Tests

1. **WebSocket connection test**:
   ```bash
   # Using websocat if available, or a simple Node.js script
   npm install -g websocat
   websocat ws://localhost:3010/ws
   ```

2. **WebSocket message flow**:
   - Connect to WebSocket
   - Send a message via API
   - Verify real-time updates are received

### Step 5: Template System Tests

1. **Template loading verification**:
   - Check that templates directory is scanned
   - Verify template parsing and validation
   - Test template hot-reload functionality

2. **Template file operations**:
   ```bash
   # Add a new template file
   echo '{"name": "test_template", "language": "en", "components": []}' > templates/test.json
   
   # Verify hot-reload picks it up
   curl http://localhost:3010/debug/templates
   
   # Remove the test file
   rm templates/test.json
   ```

### Step 6: Error Handling and Edge Cases

1. **Port already in use**:
   ```bash
   # Start server on port 3010
   pnpm whap server &
   
   # Try to start another on same port
   pnpm whap server
   ```
   Expected: Graceful error message

2. **Invalid port number**:
   ```bash
   pnpm whap server --port invalid
   ```
   Expected: Proper error handling

3. **Missing templates directory**:
   ```bash
   # Temporarily rename templates directory
   mv templates templates_backup
   pnpm whap server
   mv templates_backup templates
   ```

4. **Graceful shutdown**:
   ```bash
   pnpm whap server &
   # Send SIGINT
   kill -INT $!
   ```
   Expected: Clean shutdown with proper messages

### Step 7: Performance and Load Testing

1. **Concurrent requests**:
   ```bash
   # Use ab (Apache Bench) if available
   ab -n 100 -c 10 http://localhost:3010/health
   ```

2. **WebSocket concurrent connections**:
   - Test multiple WebSocket connections
   - Verify proper connection management

## Validation Checklist

### Basic Functionality
- [ ] Server starts on default port (3010)
- [ ] Server starts on custom port via `--port` argument
- [ ] Server respects `PORT` environment variable
- [ ] Help command displays correctly
- [ ] Server logs startup messages properly

### API Endpoints
- [ ] Health check endpoint responds correctly
- [ ] WhatsApp messages API endpoint works
- [ ] Templates API endpoint works
- [ ] Webhook endpoint accepts POST requests
- [ ] Status endpoint responds correctly
- [ ] Debug endpoints work (development mode)
- [ ] 404 handler returns proper error format

### WebSocket Functionality
- [ ] WebSocket endpoint accepts connections
- [ ] WebSocket connections are properly managed
- [ ] Real-time updates work correctly
- [ ] WebSocket disconnections are handled gracefully

### Template System
- [ ] Templates are loaded on startup
- [ ] Template hot-reload functionality works
- [ ] Template validation works correctly
- [ ] Template statistics are accurate

### Error Handling
- [ ] Port conflicts are handled gracefully
- [ ] Invalid arguments show helpful errors
- [ ] Missing dependencies are reported clearly
- [ ] Graceful shutdown works with SIGINT/SIGTERM

### Performance
- [ ] Server handles concurrent requests
- [ ] Memory usage is reasonable
- [ ] No memory leaks during extended operation
- [ ] WebSocket connections scale appropriately

## Test Scripts

Create a test script for automated validation:

```bash
#!/bin/bash
# test-server.sh

echo "🧪 Testing WhatsApp Mock Server..."

# Start server in background
pnpm whap server &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test health check
echo "Testing health check..."
curl -f http://localhost:3010/health || echo "❌ Health check failed"

# Test 404 handling
echo "Testing 404 handling..."
curl -f http://localhost:3010/nonexistent && echo "❌ 404 handling failed"

# Test WebSocket (if websocat available)
if command -v websocat &> /dev/null; then
  echo "Testing WebSocket..."
  timeout 2 websocat ws://localhost:3010/ws < /dev/null || echo "⚠️  WebSocket test inconclusive"
fi

# Cleanup
echo "Stopping server..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null

echo "✅ Server tests completed"
```

## Documentation of Results

Create a test results document:

```markdown
# Server Command Test Results

## Test Date: [Date]
## Tester: [Name]

### Basic Functionality
- ✅ Default port startup: PASS
- ✅ Custom port argument: PASS
- ✅ Environment variable: PASS
- ✅ Help command: PASS

### API Endpoints
- ✅ Health check: PASS
- ✅ Messages API: PASS
- ✅ Templates API: PASS
- ✅ Webhook: PASS

### Issues Found
- [Any issues discovered]

### Performance Notes
- [Memory usage observations]
- [Response time observations]
```

## Notes

- Test both development (tsx) and production (compiled) versions
- Compare behavior with original server implementation
- Document any differences or regressions
- Test on different operating systems if possible
- Verify logging output matches expectations

## Dependencies

- `curl` for HTTP testing
- `websocat` for WebSocket testing (optional)
- `ab` (Apache Bench) for load testing (optional)

## Next Steps

After completion, proceed to [Task 8: Test TUI command functionality](./task_8.md)

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