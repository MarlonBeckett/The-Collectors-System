# Chat UX Improvements - Implementation Guide

This document describes the new chat UX improvements implemented across all four phases.

## Overview

The chat system has been enhanced to provide a more natural, question-minimized shopping experience with structured product recommendations and better action flows.

## Phase 1: System Prompt Enhancements

### Key Changes
- **Question Minimization Strategy**: AI now makes educated guesses based on vehicle context instead of asking every time
- **Automatic Product Search**: When users mention products/parts, AI automatically searches without asking permission
- **Better Flow Control**: Products shown inline with prices; actions only offered when explicitly requested
- **Structured Examples**: Added real-world example flows to guide AI behavior

### New Instruction: Question Minimization
```
Example: "I need a battery for my 2023 Harley"
→ Search for Harley batteries directly (don't ask "what type?")

Example: "Battery" on unknown vehicle
→ Ask "What vehicle?" (can't guess without context)
```

### New Product Search Flow
1. **Detect** product intent from keywords (buy, get, install, fix, need, etc.)
2. **Search** automatically via Google for current products with pricing
3. **Format** as `[Product Name](url) - $XX.XX - description`
4. **Ask** only if clarification is truly needed
5. **Offer Actions** only after purchase confirmation

---

## Phase 2: Product Syntax & Rendering

### New Product Metadata Syntax
Introduced `[PRODUCT: name | url | price | category]` for structured tracking:

```
[PRODUCT: Castrol EDGE 10W-40 | https://amazon.com/... | $13.99 | motor-oil]
```

This allows:
- UI to identify and track products mentioned
- Future expansion for product logging and history
- One-click purchase action generation

### Enhanced Link Rendering
The ChatMessage component now recognizes and displays product prices prominently:

```
[Product Name](url) - $XX.XX
        ↓
Product Name (as link) + Price (in lighter text)
```

Example rendering:
```
Castrol EDGE 10W-40 - $13.99  ← name is link, price shown inline
```

### Benefits
- Prices are highlighted without disrupting sentence flow
- Users can quickly scan product options and pricing
- Natural inline presentation matches recommendation text

---

## Phase 3: Action Integration

### Log Purchase Action Improvements
- Actions only appear AFTER user confirms purchase
- System prompt explicitly prevents premature action offers
- Action includes pre-filled data:
  - Product name
  - Brand
  - Price
  - Product link

### Example Flow
```
User: "I'm getting the Castrol oil"
AI:   "Great! I'll log it for you."
      [ACTION:log_purchase:TW200:productName=Castrol EDGE 10W-40,...]

→ User clicks action
→ Purchase recorded with all details
```

### Compact Action Buttons
Enhanced ActionButton component supports:
- Standard buttons (with full label)
- Compact buttons (icon only, for inline use)
- Success/error feedback states

---

## Phase 4: Testing & Real-World Scenarios

### Test Scenarios

#### Scenario 1: Direct Product Request ✓
```
User: "What oil should I use for my TW200?"

Expected AI Behavior:
1. Identify vehicle context (TW200 = small Honda)
2. Automatically search for TW200 oils
3. Show 3-5 options with prices and links
4. Provide brief context why each is good
5. Do NOT ask "what type of oil?" - already answered by context
```

#### Scenario 2: Maintenance Suggestion ✓
```
User: "My bike has been sitting all winter, running rough"

Expected AI Behavior:
1. Suggest likely causes (stale fuel, oxidized oil, etc.)
2. Recommend preventive products (fuel treatment, etc.)
3. Mention approximate prices
4. Ask "Want me to find specific products?" instead of searching unprompted
```

#### Scenario 3: Purchase Confirmation ✓
```
User: "I'll go with the Castrol. Just ordered it."

Expected AI Behavior:
1. Offer to log the purchase via ACTION button
2. Pre-fill all details from the product mentioned
3. Show action: [ACTION:log_purchase:...]
4. User clicks to confirm
5. Record saved with product info
```

#### Scenario 4: Comparison Request ✓
```
User: "Mobil 1 vs Castrol vs Shell - which is best for my Rebel?"

Expected AI Behavior:
1. Make recommendation (e.g., "Castrol for reliability")
2. Show actual products with pricing
3. Include direct links to where they're available
4. Do NOT ask "which option?" - explain the difference instead
5. Let user decide without choice buttons
```

---

## How It Works: Behind the Scenes

### Parsing Pipeline
1. **Product Parsing** - Extract `[PRODUCT: ...]` syntax
2. **Choice Parsing** - Extract `[CHOICE: ...]` syntax
3. **Action Parsing** - Extract `[ACTION: ...]` syntax
4. **Link Rendering** - Convert `[text](url) - $price` to styled elements

### Data Flow
```
User Message
    ↓
[API Route: /api/chat]
    ├─ Fetch user's vehicles + context
    ├─ Call Google Gemini with Search grounding
    ├─ Parse AI response (products, choices, actions)
    ├─ Extract vehicle preference facts
    ├─ Store in database
    ↓
AI Response + Metadata
    ↓
[ChatMessage Component]
    ├─ Render text with product links + prices
    ├─ Show choice buttons (only if CHOICE syntax)
    ├─ Show action buttons (only if ACTION syntax)
    ↓
User Interaction
    ├─ Click choice → Send as new message
    ├─ Click action → Call /api/chat/action
    └─ Click product link → External purchase
```

---

## File Changes Summary

### Backend
- **src/app/api/chat/route.ts**
  - Enhanced system prompt with question minimization
  - Added product search flow explanation
  - New example scenarios
  - Product syntax parsing function
  - Better communication rules

### Frontend Components
- **src/components/chat/ChatMessage.tsx**
  - Enhanced link rendering to show prices inline
  - Product link styling improvements
  - Better visual hierarchy for recommendations

- **src/components/chat/ChoiceButtons.tsx**
  - Added support for action triggers (future expansion)
  - Improved accessibility

- **src/components/chat/ActionButton.tsx**
  - Added compact mode (icon-only buttons)
  - Better support for product-specific actions
  - Pre-filled data from product context

---

## Testing Checklist

- [ ] Product recommendations include working links
- [ ] Prices display correctly in all formats ($X.XX, $XX.XX, etc.)
- [ ] AI doesn't ask "what type?" when vehicle context is clear
- [ ] AI searches for products when user implies interest
- [ ] "Log purchase" action only appears after purchase confirmation
- [ ] Action buttons show success state after execution
- [ ] Product links open in new tabs
- [ ] Choice buttons properly send follow-up messages
- [ ] Mobile layout shows product links correctly
- [ ] Prices are visible and clear

---

## Future Enhancements

1. **Product History Tracking** - Store which products were shown vs. purchased
2. **Price Alerts** - Notify users when prices drop on recommended products
3. **Product Cards** - Visual product cards with images (if available)
4. **Smart Recommendations** - Learn brand preferences over time
5. **Bulk Product Actions** - "Log all of these as purchases" for multiple items
6. **Product Comparison** - Side-by-side comparison of top options

---

## Configuration Notes

### Environment Variables
No new environment variables needed. System uses existing:
- `GEMINI_API_KEY` - For Google Gemini API with Search grounding
- Supabase credentials - For storing chat history

### Database Tables Used
- `chat_messages` - Stores conversation with metadata
- `vehicle_facts` - Stores learned preferences
- `vehicle_purchases` - Stores logged purchases (including price & link)
- `motorcycles` - Vehicle context for recommendations

---

## Monitoring & Debugging

### Check if AI is Following New Flow
Look for these patterns in responses:
1. ✓ Products have `[Product Name](url) - $XX.XX` format
2. ✓ Questions are minimized (fewer "which X?" prompts)
3. ✓ Actions appear only after confirmation
4. ✓ Vehicle context is used in recommendations

### Common Issues & Fixes

**Issue**: AI not searching for products
- **Fix**: System prompt has "AUTO-SEARCH" emphasized - may need retraining

**Issue**: Prices not showing
- **Fix**: Ensure AI includes `- $XX.XX` in product format

**Issue**: "Log purchase" appearing too early
- **Fix**: System prompt explicitly prevents this - check AI response parsing

---

## Examples from Real Conversations

### Good Example ✓
```
User: "What battery for the TW200?"

AI: For your TW200, a small sealed battery works best. Here are current options:
- [Yuasa YB9-B](https://amazon.com/...) - $49.99 - proven reliable
- [Shorai LFX](https://amazon.com/...) - $99.99 - lightweight
- [EBL YB9-B](https://amazon.com/...) - $39.99 - budget option

Which one fits your needs?
```

### Less Good Example ✗
```
User: "What battery for the TW200?"

AI: What type of battery are you looking for?
[CHOICE: What type? | Lithium | Lead-Acid | AGM]
```
← This asks when the system already knows what vehicle type it is

---

## Questions?

For issues or questions about the chat improvements:
1. Check the example flows in this document
2. Review the system prompt in `/src/app/api/chat/route.ts`
3. Test with scenarios listed in Phase 4
