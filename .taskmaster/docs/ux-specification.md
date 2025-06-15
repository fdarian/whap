# WhatsApp CLI Redesign - UX Specification

## Overview
This document outlines the complete user experience design for the WhatsApp CLI redesign, transforming it from a grid-based interface to a Claude Code-style terminal interface.

## Design Principles
- **Simplicity**: Single input box at bottom, conversation history flows upward
- **Natural Flow**: Newest messages appear at bottom (like regular terminal/chat)
- **Progressive Disclosure**: Context-aware prompts guide users through setup
- **Minimal UI**: No unnecessary borders or visual clutter
- **Slash Commands**: Replace keyboard shortcuts with discoverable commands

---

## Interface Layout

### Primary Interface (Chat Mode)
```
                                                                     
  15:32:12 System                                                    
    WhatsApp CLI started. Type /help for available commands.       
                                                                  
  15:32:15 System                                                
    What's your phone number? (Indonesian format, e.g. 6281234...)
                                                                 
  15:32:18 You                                                  
    6281234567890                                              
                                                              
  15:32:19 System                                            
    Great! What's your bot's phone number ID?               
                                                           
  15:32:22 You                                            
    6281234567891                                        
                                                        
  15:32:23 System                                      
    ✓ Connected! You can now start sending messages.  
                                                     
  15:32:30 You                                      
    Hello bot                                      
                                                  
  15:32:31 Bot                                   
    Hi there! How can I help you today?         
                                               
  🤖 Bot is typing...                         

╭─────────────────────────────────────────────────────────────────────╮
│ > Type your message...                                                          │
╰─────────────────────────────────────────────────────────────────────╯
                                                                  6281...→6281... ●
```

### Slash Command Palette
```

  [Previous conversation history continues above...]

╭─────────────────────────────────────────────────────────────────────╮
│ > Type your message...                                                          │
╰─────────────────────────────────────────────────────────────────────╯
                                                                  6281...→6281... ●
  /help     Show available commands                                   
  /new      Start new conversation                                    
  /refresh  Reload conversation history                               
  /file     Upload file to bot                                        

```

### File Upload Flow
```

  [Previous conversation continues...]

  15:35:12 You                                                       
    /file                                                            

╭─────────────────────────────────────────────────────────────────────╮
│ > File Path: Enter file path...                                                 │
╰─────────────────────────────────────────────────────────────────────╯
                                                                  6281...→6281... ●
```

---

## User Workflow Specifications

### 1. Initial Setup Flow (Progressive Prompts)
**No separate onboarding component** - all interactions happen in main conversation:

1. **App Launch**
   ```
   System: WhatsApp CLI started. Type /help for available commands.
   System: Let's get you set up. What's your phone number? (Indonesian format, e.g. 6281234567890)
   ```

2. **Phone Number Collection**
   - User types phone number
   - System validates format (Indonesian: 62xxxxxxxxxx)
   - On success: "Great! What's your bot's phone number ID?"
   - On error: "Invalid format. Please use Indonesian format (62xxxxxxxxxx)"

3. **Bot Phone Number Collection**
   - User types bot phone number
   - System validates and attempts connection
   - On success: "✓ Connected! You can now start sending messages."
   - On error: Display connection error and retry prompt

4. **Ready State**
   - Input prompt changes to "Type your message..."
   - Status indicator shows connection: "6281234567890 → 6281234567891 ●"
   - All slash commands become available

### 2. Message Flow
**All messages append to bottom of conversation history:**

1. **Sending Messages**
   - User types message and presses Enter
   - Message immediately appears: "15:32:30 You\n  Hello bot"
   - Status briefly shows "Sending..." then "✓ Sent"
   - Bot response appears when received: "15:32:31 Bot\n  Hi there!"

2. **Typing Indicators**
   - When bot is typing: "🤖 Bot is typing..." appears at bottom
   - Disappears when bot message is received

3. **Message Format**
   ```
   HH:mm:ss [You|Bot|System]
     [Message content with 2-space indentation]
   ```

### 3. Slash Command Workflow

**Command Discovery:**
- User types "/" - command palette appears below input
- Arrow keys navigate, Enter selects, Esc cancels
- Commands appear with descriptions in muted colors

**Available Commands:**
- `/help` - Show all commands and usage
- `/new` - Clear conversation, start fresh
- `/refresh` - Reload conversation history from server
- `/file` - Upload file with progressive prompts

**Command Execution:**
- All commands append to conversation history
- System responses guide user through multi-step processes
- No modal dialogs or separate interfaces

### 4. File Upload Workflow
1. User types `/file`
2. System responds: "Please provide the file path:"
3. Input placeholder changes to "Enter file path..."
4. User enters path, system validates
5. System responds with file info and upload progress
6. Success/error messages appear in conversation

---

## Technical Implementation Requirements

### Message Rendering
- **No "newest first" sorting** - messages append chronologically
- **No max message limits** - full history visible with scrolling
- **Proper text wrapping** - messages wrap within terminal width
- **Consistent timestamp format** - HH:mm:ss for today, MM/dd HH:mm for older

### Input Box Behavior
- **Single bordered element** - only input area has border
- **Dynamic placeholder text** - changes based on context
- **Focus management** - always focused unless in command palette
- **Enter key handling** - submit message or command

### Conversation Area
- **No borders** - clean, borderless scrolling area
- **Natural scrolling** - new messages push content up
- **Terminal-compatible** - works across different terminal sizes
- **Typing indicators** - real-time WebSocket updates

### Status Indicator
- **Bottom right position** - below input, right-aligned
- **Compact format** - "phoneNumber → botPhoneId ●"
- **Color-coded dot** - green (connected), red (error), yellow (connecting)
- **Minimal text** - abbreviated phone numbers if needed

### Command Palette
- **Trigger on "/"** - appears immediately when user types slash
- **Borderless design** - muted colors, clean layout
- **Keyboard navigation** - arrow keys, Enter, Esc
- **Auto-hide** - disappears when command selected or cancelled

---

## State Management

### Application States
1. **Setup State** - collecting phone numbers
2. **Connected State** - ready for messaging
3. **Command State** - slash command palette active
4. **File Upload State** - progressive file upload prompts

### Context-Aware Prompts
- Input placeholder changes based on current state
- System messages guide user through each step
- All interactions preserved in conversation history

### Error Handling
- Connection errors appear as system messages
- Validation errors provide clear guidance
- Retry mechanisms built into conversation flow

---

## Accessibility & Usability

### Terminal Compatibility
- Works in various terminal sizes (minimum 80x24)
- Graceful text wrapping and content overflow
- Compatible with screen readers

### Keyboard Navigation
- Tab/Shift+Tab for focus management
- Arrow keys for command palette navigation
- Enter for submission, Esc for cancellation

### Visual Hierarchy
- Color coding: System (gray), You (cyan), Bot (green)
- Indentation for message content
- Consistent spacing and alignment

### Progressive Disclosure
- Commands discoverable through /help
- Context-sensitive help text
- Clear progression through setup steps

---

## Error States & Edge Cases

### Connection Issues
- Server unavailable: "Cannot connect to mock server. Please start the server first."
- Network timeout: "Connection timeout. Type /refresh to retry."
- Authentication failure: "Invalid phone number configuration."

### Input Validation
- Empty messages: No submission, no error message
- Invalid file paths: "File not found. Please check the path and try again."
- Malformed phone numbers: "Invalid format. Use Indonesian format (62xxxxxxxxxx)"

### Terminal Resize
- Content reflows gracefully
- Input box remains at bottom
- Message history adjusts to new width

---

This specification serves as the single source of truth for all implementation tasks. Each component change should reference back to these requirements to ensure consistency with the overall Claude Code-style design vision.