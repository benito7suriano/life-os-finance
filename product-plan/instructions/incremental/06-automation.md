# Milestone 6: Automation

> **Provide alongside:** `product-overview.md`
> **Prerequisites:** Milestone 1 (Foundation) complete

## Goal

Implement the Automation section - set up WhatsApp bot and email forwarding to automatically log transactions from receipts and messages.

## Overview

The Automation section enables hands-free transaction logging. Users can connect two channels: a WhatsApp bot (for sending receipt photos via chat) and email forwarding (for forwarding digital receipts). Connected channels automatically parse receipts using AI and create transactions. Users can pause, resume, or disconnect channels at any time.

**Key Functionality:**
- Connect WhatsApp by adding bot number and verifying with code
- Connect email by copying unique forwarding address and setting up auto-forward
- View connection status for each channel (connected, paused, disconnected)
- See transaction count and last activity for connected channels
- Pause a channel to temporarily stop processing
- Resume a paused channel
- Disconnect a channel entirely

## Recommended Approach: Test-Driven Development

Before implementing this section, **write tests first** based on the test specifications provided.

See `product-plan/sections/automation/tests.md` for detailed test-writing instructions including:
- WhatsApp setup flow tests (connect, verify, success, failure)
- Email setup flow tests
- Channel status management tests
- Empty state tests

**TDD Workflow:**
1. Read `tests.md` and write failing tests for the key user flows
2. Implement the feature to make tests pass
3. Refactor while keeping tests green

## What to Implement

### Components

Copy the section components from `product-plan/sections/automation/components/`:

- `AutomationSettings.tsx` - Main container showing both channel cards
- `ChannelCard.tsx` - Connected channel display with stats and controls
- `SetupCard.tsx` - Setup flow for disconnected channels

### Data Layer

The components expect these data shapes:

```typescript
interface AutomationProps {
  config: AutomationConfig       // Bot number, email domain, instructions
  channels: AutomationChannel[]  // WhatsApp and email channel records
  pendingVerification: PendingVerification | null  // For WhatsApp setup
  // ... callbacks
}

interface AutomationChannel {
  id: string
  type: 'whatsapp' | 'email'
  status: 'connected' | 'paused' | 'disconnected'
  connectedAt: string | null
  lastActivityAt: string | null
  transactionsLogged: number
  whatsappDetails?: { linkedPhoneNumber, linkedPhoneNumberMasked }
  emailDetails?: { forwardingAddress }
}
```

### Backend Requirements

This section requires significant backend infrastructure:

**WhatsApp Integration:**
- WhatsApp Business API or third-party service integration
- Verification code generation and validation
- Message/image receipt webhook handler
- AI receipt parsing service
- Transaction creation from parsed data

**Email Integration:**
- Unique forwarding address generation per user
- Email receipt webhook (via services like Mailgun, SendGrid)
- Attachment/image extraction
- AI receipt parsing service
- Transaction creation from parsed data

**Note:** The UI components handle the user-facing setup flows. The actual receipt parsing and transaction creation happen on the backend and are not covered by the provided components.

### Callbacks

Wire up these user actions:

| Callback | Description |
|----------|-------------|
| `onStartWhatsAppSetup` | Initiates WhatsApp connection flow |
| `onSubmitVerificationCode` | Submits code for WhatsApp verification |
| `onCancelWhatsAppSetup` | Cancels in-progress WhatsApp setup |
| `onCopyEmailAddress` | Copies forwarding address to clipboard |
| `onPauseChannel` | Pauses a connected channel |
| `onResumeChannel` | Resumes a paused channel |
| `onDisconnectChannel` | Disconnects a channel |

### WhatsApp Setup Flow

1. User clicks "Connect WhatsApp" button
2. Card expands to show setup instructions:
   - "Add this number as a contact: +1 (555) 123-4567"
   - "Send any message to this number"
   - "Enter the verification code you receive"
3. User sees bot phone number with copy button
4. User adds bot and sends message
5. Bot sends verification code to user's WhatsApp
6. User enters 6-digit code in app
7. On success: Card transforms to connected state showing phone number
8. On failure: Error message, user can retry

### Email Setup Flow

1. User clicks "Connect Email" button
2. Card expands to show:
   - Unique forwarding address (e.g., user-abc123@inbox.ledger.app)
   - Copy button
   - Instructions for setting up email forwarding
3. User copies address and sets up forwarding in their email provider
4. Card shows as connected once first email is received

### Channel States

**Connected:**
- Green status badge
- Toggle switch in ON position
- Shows transaction count and last activity
- Disconnect button in footer

**Paused:**
- Amber status badge
- Toggle switch in OFF position
- Warning message about paused processing
- Disconnect button in footer

**Disconnected:**
- Setup flow shown instead of connected card
- "Connect [Channel]" button

### Empty States

- **No channels connected:** Both cards show setup flows
- **Channel disconnected:** Individual card shows setup flow

## Files to Reference

- `product-plan/sections/automation/README.md` - Feature overview
- `product-plan/sections/automation/tests.md` - Test-writing instructions
- `product-plan/sections/automation/components/` - React components
- `product-plan/sections/automation/types.ts` - TypeScript interfaces
- `product-plan/sections/automation/sample-data.json` - Test data

## Expected User Flows

### Flow 1: Connect WhatsApp

1. User clicks "Connect WhatsApp" button
2. User sees bot phone number and instructions
3. User adds bot as contact and sends message
4. User receives verification code on WhatsApp
5. User enters code in the app
6. **Outcome:** Card shows "Connected" with masked phone number

### Flow 2: Connect Email

1. User clicks "Connect Email" button
2. User sees unique forwarding address
3. User clicks "Copy" button
4. User sets up auto-forward in their email provider
5. **Outcome:** Card shows as connected once first email arrives

### Flow 3: Pause a Channel

1. User clicks the toggle switch on a connected channel
2. Toggle moves to OFF position
3. Status changes to "Paused"
4. **Outcome:** Incoming receipts are ignored until resumed

### Flow 4: Disconnect a Channel

1. User clicks "Disconnect" in channel card footer
2. Confirmation prompt appears
3. User confirms
4. **Outcome:** Card reverts to setup flow state

## Done When

- [ ] Tests written for key user flows
- [ ] All tests pass
- [ ] Both channel cards render (WhatsApp and Email)
- [ ] WhatsApp setup flow works (show instructions, enter code)
- [ ] Verification code input validates correctly
- [ ] Email setup shows unique address with copy button
- [ ] Connected channels show transaction count and last activity
- [ ] Pause/resume toggle works
- [ ] Disconnect with confirmation works
- [ ] Status badges show correct state (connected/paused/disconnected)
- [ ] Empty states display properly
- [ ] Responsive layout
- [ ] Dark mode supported
