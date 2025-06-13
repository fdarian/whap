# WhatsApp Template Testing System

This document provides comprehensive information about using the WhatsApp Template Testing System in Whap.

## Overview

The WhatsApp Template Testing System allows developers to create, validate, and test WhatsApp message templates locally without using real WhatsApp Business API endpoints, phone numbers, or incurring API costs.

## Getting Started

### Quick Setup

1. **Start the mock server and CLI**:
   ```bash
   # Terminal 1: Start mock server
   pnpm run start:server
   
   # Terminal 2: Start CLI interface  
   pnpm run start:cli
   ```

2. **Create your first template** in the `templates/` directory
3. **Test immediately** - templates auto-load with hot-reload

## Creating Templates

### Template File Structure

Create JSON files in the `templates/` directory at your project root. Templates are automatically loaded and validated when the server starts.

### Basic Template Example

```json
// templates/welcome.json
{
  "name": "welcome_message",
  "category": "UTILITY",
  "language": "en_US",
  "components": [
    {
      "type": "BODY",
      "text": "Welcome {{1}}! Your account has been created successfully.",
      "example": {
        "body_text": [["John Doe"]]
      }
    }
  ]
}
```

### Order Confirmation Template

```json
// templates/order_confirmation.json
{
  "name": "order_confirmation",
  "category": "UTILITY", 
  "language": "en_US",
  "components": [
    {
      "type": "BODY",
      "text": "Hi {{1}}! Your order {{2}} has been confirmed and will be delivered to {{3}} by {{4}}.",
      "example": {
        "body_text": [["John"], ["#12345"], ["123 Main St"], ["2pm today"]]
      }
    }
  ]
}
```

### Complex Template with Header and Buttons

```json
// templates/order_update.json
{
  "name": "order_update",
  "category": "UTILITY",
  "language": "en_US",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT", 
      "text": "Order Update"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, your order {{2}} is ready for pickup!",
      "example": {
        "body_text": [["Sarah"], ["#12345"]]
      }
    },
    {
      "type": "FOOTER",
      "text": "Thank you for your business!"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "Confirm Pickup"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Reschedule"
        }
      ]
    }
  ]
}
```

### Template with Media Header

```json
// templates/promo_image.json
{
  "name": "promotional_offer",
  "category": "MARKETING",
  "language": "en_US",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": {
        "header_handle": ["https://example.com/promo-image.jpg"]
      }
    },
    {
      "type": "BODY",
      "text": "🎉 Special offer for {{1}}! Get {{2}}% off your next purchase. Use code: {{3}}",
      "example": {
        "body_text": [["valued customers"], ["20"], ["SAVE20"]]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Shop Now",
          "url": "https://example.com/shop?code={{1}}",
          "example": ["SAVE20"]
        }
      ]
    }
  ]
}
```

## Named Parameters Support

The WhatsApp Template Testing System supports both **numbered parameters** ({{1}}, {{2}}) and **named parameters** ({{name}}, {{email}}) for enhanced readability and maintainability.

### Named Parameter Template Example

```json
// templates/new_booking.json
{
  "name": "new_booking",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Hi {{artist_name}}, you have a new booking request for {{event_name}} on {{event_date}} at {{event_location}} from {{booker_name}}. Let me know if you'd like to know more about the event."
    }
  ],
  "variables": {
    "artist_name": {
      "description": "Artist name",
      "example": "John Smith"
    },
    "event_name": {
      "description": "Event name", 
      "example": "Wedding Reception"
    },
    "event_date": {
      "description": "Event date",
      "example": "December 15, 2024"
    },
    "event_location": {
      "description": "Event location",
      "example": "Grand Ballroom Hotel"
    },
    "booker_name": {
      "description": "Booker name",
      "example": "Sarah Johnson"
    }
  }
}
```

### Mixed Parameter Template Example

```json
// templates/mixed_parameters.json
{
  "name": "order_status_mixed",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Dear {{customer_name}}, your order {{1}} is ready. Contact us at {{support_email}} or call {{2}}.",
      "example": {
        "body_text": [["#12345"], ["555-0123"]]
      }
    }
  ],
  "variables": {
    "customer_name": {
      "description": "Customer's full name",
      "example": "John Doe"
    },
    "support_email": {
      "description": "Support email address",
      "example": "support@company.com"
    }
  }
}
```

### API Request Format for Named Parameters

When sending template messages with named parameters via API:

```bash
curl -X POST http://localhost:3010/v22.0/123456789/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "template", 
    "template": {
      "name": "new_booking",
      "language": { "code": "en" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { 
              "type": "text", 
              "parameter_name": "artist_name",
              "text": "John Smith" 
            },
            { 
              "type": "text", 
              "parameter_name": "event_name",
              "text": "Wedding Reception" 
            },
            { 
              "type": "text", 
              "parameter_name": "event_date", 
              "text": "December 15, 2024" 
            },
            { 
              "type": "text", 
              "parameter_name": "event_location",
              "text": "Grand Ballroom Hotel" 
            },
            { 
              "type": "text", 
              "parameter_name": "booker_name",
              "text": "Sarah Johnson" 
            }
          ]
        }
      ]
    }
  }'
```

### Mixed Parameters API Request

For templates with both named and numbered parameters:

```bash
curl -X POST http://localhost:3010/v22.0/123456789/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "template",
    "template": {
      "name": "order_status_mixed",
      "language": { "code": "en_US" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { 
              "type": "text", 
              "parameter_name": "customer_name",
              "text": "John Doe" 
            },
            { 
              "type": "text", 
              "parameter_name": "1",
              "text": "#12345" 
            },
            { 
              "type": "text", 
              "parameter_name": "support_email",
              "text": "support@company.com" 
            },
            { 
              "type": "text", 
              "parameter_name": "2",
              "text": "555-0123" 
            }
          ]
        }
      ]
    }
  }'
```

### Parameter Naming Guidelines

#### Valid Parameter Names
- **Alphanumeric**: `{{user_name}}`, `{{order123}}`
- **Underscores**: `{{first_name}}`, `{{customer_id}}`
- **Hyphens**: `{{company-name}}`, `{{user-email}}`
- **Dots**: `{{user.id}}`, `{{order.status}}`
- **Case sensitive**: `{{Name}}` and `{{name}}` are different

#### Best Practices
- **Use descriptive names**: `{{customer_name}}` instead of `{{name}}`
- **Be consistent**: Use the same naming convention across templates
- **Include variable descriptions**: Help other developers understand purpose
- **Provide meaningful examples**: Show realistic sample values

### Backward Compatibility

Named parameters are fully backward compatible with numbered parameters:

- **Existing numbered templates** continue to work unchanged
- **Mixed usage** is supported within the same template
- **API format** remains consistent - use `parameter_name` field for both types
- **CLI interface** automatically detects parameter type and prompts accordingly

## Template Components Reference

### Supported Components

#### Header Component
```json
{
  "type": "HEADER",
  "format": "TEXT|IMAGE|DOCUMENT|VIDEO",
  "text": "Header text (for TEXT format)",
  "example": {
    "header_handle": ["media_url"] // for media formats
  }
}
```

**Limits:**
- **TEXT**: 60 characters maximum
- **IMAGE**: 5MB maximum file size
- **DOCUMENT**: 100MB maximum, 5 pages for PDF
- **VIDEO**: 16MB maximum file size

#### Body Component

##### With Numbered Parameters
```json
{
  "type": "BODY",
  "text": "Body text with variables {{1}}, {{2}}, etc.",
  "example": {
    "body_text": [["var1_value"], ["var2_value"]]
  }
}
```

##### With Named Parameters
```json
{
  "type": "BODY",
  "text": "Hello {{customer_name}}, your order {{order_id}} has been confirmed."
}
```

**Limits:**
- **Text**: 1,024 characters maximum
- **Variables**: Up to 10 variables per component
- **Numbered**: Use {{1}} to {{10}} format
- **Named**: Use descriptive names like {{customer_name}}, {{order_id}}
- **Example**: Provide example values for numbered parameters only

#### Footer Component
```json
{
  "type": "FOOTER",
  "text": "Footer text"
}
```

**Limits:**
- **Text**: 60 characters maximum
- **No variables allowed**

#### Buttons Component
```json
{
  "type": "BUTTONS",
  "buttons": [
    {
      "type": "QUICK_REPLY",
      "text": "Button text"
    },
    {
      "type": "URL", 
      "text": "Visit Website",
      "url": "https://example.com/path?param={{1}}",
      "example": ["value"]
    },
    {
      "type": "PHONE_NUMBER",
      "text": "Call Us",
      "phone_number": "+1234567890"
    }
  ]
}
```

**Button Types:**
- **QUICK_REPLY**: Up to 3 buttons, 20 characters each
- **URL**: Up to 2 buttons, can include 1 variable
- **PHONE_NUMBER**: Up to 2 buttons

### Template Categories

#### UTILITY
For transactional and operational messages:
- Order confirmations
- Shipping updates  
- Account notifications
- Appointment reminders

#### MARKETING  
For promotional content:
- Special offers
- Product announcements
- Event invitations
- Newsletter content

#### AUTHENTICATION
For security-related messages:
- 2FA verification codes
- Password reset links
- Login alerts
- Security notifications

#### SERVICE
For customer support:
- Support ticket updates
- FAQ responses
- Service notifications
- Feedback requests

## Testing Templates via CLI

### Interactive Testing Workflow

1. **Start the CLI** with `pnpm run start:cli`
2. **Select template mode** when composing a message
3. **Choose a template** from the available list
4. **Enter variable values** when prompted
5. **Review the rendered message** in conversation history
6. **Check webhook events** for delivery status

### CLI Template Selection

When you choose to send a template message in the CLI:

#### Numbered Parameters Template
```
📋 Available Templates:
1. welcome_message (UTILITY)
2. order_confirmation (UTILITY)  
3. order_update (UTILITY)
4. promotional_offer (MARKETING)

Select template (1-4): 2

📝 Template: order_confirmation
Variables needed: {{1}}, {{2}}, {{3}}, {{4}}

Enter value for {{1}} (Customer name): John Smith
Enter value for {{2}} (Order ID): #ORD-12345
Enter value for {{3}} (Delivery address): 123 Main St, Anytown
Enter value for {{4}} (Delivery time): 2-4 PM today

✅ Template message sent!
```

#### Named Parameters Template
```
📋 Available Templates:
1. welcome_message (UTILITY)
2. new_booking (UTILITY)
3. order_update (UTILITY)
4. promotional_offer (MARKETING)

Select template (1-4): 2

📝 Template: new_booking
Variables needed: {{artist_name}}, {{event_name}}, {{event_date}}, {{event_location}}, {{booker_name}}

Enter value for {{artist_name}} (Artist name): John Smith
Enter value for {{event_name}} (Event name): Wedding Reception  
Enter value for {{event_date}} (Event date): December 15, 2024
Enter value for {{event_location}} (Event location): Grand Ballroom Hotel
Enter value for {{booker_name}} (Booker name): Sarah Johnson

✅ Template message sent!
```

#### Mixed Parameters Template
```
📋 Available Templates:
1. welcome_message (UTILITY)
2. order_status_mixed (UTILITY)
3. order_update (UTILITY)

Select template (1-3): 2

📝 Template: order_status_mixed
Variables needed: {{customer_name}}, {{1}}, {{support_email}}, {{2}}

Enter value for {{customer_name}} (Customer's full name): John Doe
Enter value for {{1}}: #12345
Enter value for {{support_email}} (Support email address): support@company.com
Enter value for {{2}}: 555-0123

✅ Template message sent!
```

### Variable Input Features

- **Validation**: Required variables must be provided
- **Examples**: Shows example values from template definition
- **Navigation**: Use arrow keys to navigate between inputs
- **Preview**: See rendered template before sending
- **History**: Previous variable values remembered during session

## API Integration

### Sending Template Messages

Send template messages via HTTP API:

```bash
curl -X POST http://localhost:3010/v22.0/123456789/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890", 
    "type": "template",
    "template": {
      "name": "welcome_message",
      "language": { "code": "en_US" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "John Doe" }
          ]
        }
      ]
    }
  }'
```

### Template Management API

#### List Templates
```bash
GET /v22.0/{phone-id}/message_templates
```

Response:
```json
{
  "data": [
    {
      "name": "welcome_message",
      "components": [...],
      "language": "en_US",
      "status": "APPROVED",
      "category": "UTILITY",
      "id": "1234567890"
    }
  ],
  "paging": {
    "cursors": {
      "before": "...",
      "after": "..."
    }
  }
}
```

#### Create Template
```bash
POST /v22.0/{phone-id}/message_templates
Content-Type: application/json

{
  "name": "new_template",
  "language": "en_US", 
  "category": "UTILITY",
  "components": [...]
}
```

#### Delete Template
```bash
DELETE /v22.0/{phone-id}/message_templates/{template-id}
```

### Webhook Events

The mock server simulates WhatsApp webhook events for template messages:

#### Template Status Update
```json
{
  "entry": [{
    "id": "PHONE_NUMBER_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "1234567890",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "template_status_update": {
          "template_id": "1234567890",
          "template_name": "welcome_message", 
          "status": "APPROVED",
          "category": "UTILITY",
          "language": "en_US",
          "reason": "Template approved successfully"
        }
      },
      "field": "template_status_update"
    }]
  }]
}
```

#### Template Message Delivery
```json
{
  "entry": [{
    "id": "PHONE_NUMBER_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "1234567890",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "statuses": [{
          "id": "MESSAGE_ID",
          "status": "delivered",
          "timestamp": "1234567890",
          "recipient_id": "1234567890",
          "conversation": {
            "id": "CONVERSATION_ID",
            "category": "utility",
            "is_billable": true,
            "pricing_model": "CBP"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

## Development Workflow

### Hot-Reload Development

Templates support hot-reload for rapid development:

1. **Modify template file** while server is running
2. **Changes auto-detected** by file watcher
3. **Template re-validated** and reloaded
4. **Available immediately** in CLI and API
5. **No server restart required**

### Template Validation

Templates are validated against WhatsApp Business API schema:

- **Structure validation**: Required fields and component structure
- **Content validation**: Character limits and format requirements  
- **Variable validation**: 
  - **Numbered**: Proper variable sequencing ({{1}}, {{2}}, etc.)
  - **Named**: Valid parameter names and proper format
  - **Mixed**: Both types can coexist in the same template
- **Example validation**: Example values provided for numbered variables
- **Variables section**: Optional metadata for named parameters with descriptions and examples

### Error Handling

Common validation errors and solutions:

#### Missing Required Fields
```
❌ Template validation failed: Missing required field 'name'
✅ Add "name" field to template JSON
```

#### Invalid Variable Sequence  
```
❌ Template validation failed: Variable sequence error - found {{3}} without {{2}}
✅ Use sequential variables: {{1}}, {{2}}, {{3}}
```

#### Character Limit Exceeded
```
❌ Template validation failed: Body text exceeds 1024 character limit
✅ Reduce body text to under 1024 characters
```

#### Missing Example Values
```
❌ Template validation failed: Missing example values for variables
✅ Add "example" field with sample values for all variables
```

## Mock vs Real API Behavior

### Key Differences

| Feature | Mock Server | Real WhatsApp API |
|---------|-------------|-------------------|
| **Template Approval** | Instant "approval" for all templates | 2-24 hour human review process |
| **Rate Limiting** | No rate limits | Strict limits based on phone number quality rating |
| **Webhook Timing** | Immediate webhook simulation | Real-time delivery based on actual message processing |
| **Template Validation** | JSON schema validation only | Full WhatsApp compliance review including content policy |
| **Template Categories** | All categories accepted | Marketing templates require additional approval |
| **Variable Limits** | Schema validation only | Content and formatting restrictions apply |

### What's Simulated

- ✅ Template structure validation
- ✅ WhatsApp API response formats  
- ✅ Webhook event payloads
- ✅ Template management endpoints
- ✅ Message delivery status events

### What's Not Simulated  

- ❌ Real message delivery to phone numbers
- ❌ WhatsApp content policy enforcement
- ❌ Rate limiting and quality ratings
- ❌ Media file hosting and processing
- ❌ Real-time message encryption

## Best Practices

### Template Design

1. **Keep it simple**: Clear, concise messaging
2. **Use variables wisely**: Personalize without overcomplicating  
3. **Test thoroughly**: Try different variable combinations
4. **Follow limits**: Respect character and component limits
5. **Provide good examples**: Help other developers understand usage

### Development Workflow

1. **Start simple**: Begin with basic templates, add complexity gradually
2. **Use hot-reload**: Take advantage of instant template updates
3. **Test edge cases**: Try empty values, long strings, special characters
4. **Validate early**: Check templates before integrating with application code
5. **Document variables**: Comment what each variable represents

### Performance Tips

1. **Minimize template files**: Keep only templates you're actively testing
2. **Use meaningful names**: Easy to identify templates in CLI
3. **Group related templates**: Organize by feature or user journey
4. **Cache variable values**: CLI remembers recent inputs during session

## Troubleshooting

### Common Issues

#### Templates Not Loading
- **Check file location**: Templates must be in `templates/` directory
- **Verify JSON syntax**: Use JSON validator to check file format
- **Check server logs**: Look for validation error messages
- **Restart server**: Force reload if hot-reload isn't working

#### Variable Substitution Errors
- **Sequential numbering**: Variables must be {{1}}, {{2}}, {{3}}, etc.
- **Provide all values**: Don't skip required variables
- **Check parameter types**: Ensure correct parameter structure in API calls

#### CLI Not Showing Templates
- **Server connection**: Ensure server is running on port 3010
- **Template validation**: Check that templates passed validation
- **Refresh CLI**: Restart CLI if templates don't appear

#### Webhook Events Not Received
- **Configure webhook URL**: Set up webhook endpoint in your application
- **Check server logs**: Verify webhook events are being generated
- **Network connectivity**: Ensure your webhook endpoint is accessible

### Getting Help

- **Check server logs**: Detailed validation and error information
- **Use debug endpoints**: `GET /debug/templates` for template status
- **Template health check**: `GET /health` shows system status
- **File validation**: Validate JSON syntax before testing

## Advanced Usage

### Custom Template Categories

While WhatsApp defines standard categories, you can use any category for testing:

```json
{
  "name": "custom_template",
  "category": "CUSTOM_CATEGORY", 
  "language": "en_US",
  "components": [...]
}
```

### Multi-language Templates

Create separate template files for different languages:

```
templates/
├── welcome_en.json     # English version
├── welcome_es.json     # Spanish version  
└── welcome_fr.json     # French version
```

### Template Versioning

Use descriptive names for template versions:

```
templates/
├── welcome_v1.json
├── welcome_v2.json
└── welcome_latest.json
```

### Batch Template Testing

Test multiple templates programmatically:

```bash
# Test all templates via API
for template in $(ls templates/*.json); do
  name=$(basename $template .json)
  curl -X POST http://localhost:3010/v22.0/123456789/messages \
    -H "Content-Type: application/json" \
    -d "{ \"type\": \"template\", \"template\": { \"name\": \"$name\" } }"
done
``` 