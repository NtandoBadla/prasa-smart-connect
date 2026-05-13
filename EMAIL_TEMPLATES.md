# EmailJS Templates for PRASA Lost & Found

## Template Setup Instructions

### 1. Lost Item Confirmation Template
- **Template ID:** `template_lost_confirm`
- **Use Case:** Sent when user reports a lost item
- **Variables:** contact_ref, item, station, date, submitted_date

### 2. Item Found Notification Template  
- **Template ID:** `template_item_found`
- **Use Case:** Sent when admin marks item as found
- **Variables:** contact_ref, item, station, date, found_date

## Environment Variables Required

```env
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_TEMPLATE_ID=template_lost_confirm
EMAILJS_FOUND_TEMPLATE_ID=template_item_found
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key
```

## Template HTML Code

See the HTML templates in the previous response - copy and paste them into your EmailJS dashboard when creating the templates.

## Testing

1. Create both templates in EmailJS
2. Update your .env file with the template IDs
3. Test by reporting a lost item
4. Test by marking an item as found in admin dashboard

The system will automatically use the appropriate template based on the action being performed.