# Automation Section

## Overview

The Automation section allows users to set up and configure automatic transaction logging via WhatsApp bot and email forwarding. Users connect their channels, manage connection status, and can pause or disconnect at any time.

## Components

### AutomationSettings
Main container component displaying:
- Page header with "Automation" title
- Info banner explaining how automation works
- Channel cards for WhatsApp and Email
- Tips section for best results

### ChannelCard
Connected channel card showing:
- Channel type icon (WhatsApp/Email)
- Connection status (Connected/Paused/Disconnected)
- Pause/Resume toggle
- WhatsApp: linked phone number, transactions logged, last activity
- Email: forwarding address with copy button
- Disconnect option with confirmation

### SetupCard
Setup flow card for connecting new channels:
- WhatsApp: bot phone number, setup instructions, verification code input
- Email: generated forwarding address, setup instructions
- Connect button to start setup flow

## Usage

```tsx
import { AutomationSettings } from './components'
import sampleData from './sample-data.json'

function AutomationPage() {
  return (
    <AutomationSettings
      config={sampleData.config}
      channels={sampleData.channels}
      pendingVerification={sampleData.pendingVerification}
      onStartWhatsAppSetup={() => console.log('Start WhatsApp setup')}
      onSubmitVerificationCode={(code) => console.log('Verify', code)}
      onCancelWhatsAppSetup={() => console.log('Cancel setup')}
      onCopyEmailAddress={(address) => console.log('Copy', address)}
      onPauseChannel={(id) => console.log('Pause', id)}
      onResumeChannel={(id) => console.log('Resume', id)}
      onDisconnectChannel={(id) => console.log('Disconnect', id)}
    />
  )
}
```

## Channel Types

1. **WhatsApp** - Send receipts via chat message, parsed by AI
2. **Email** - Forward receipts to unique address, processed automatically

## Channel States

- **Connected** - Active and processing messages
- **Paused** - Temporarily stopped, messages ignored
- **Disconnected** - Channel not linked, needs setup

## Data Requirements

See `types.ts` for complete TypeScript interfaces and `sample-data.json` for example data structure.
