# Automation Tests

## Overview

These test specifications describe the key user flows and behaviors to verify for the Automation section. Adapt these to your testing framework.

## Test Categories

### 1. Page Load & Display

**Test: Automation page renders with all elements**
- Verify page header shows "Automation" title
- Verify subtitle explains the feature
- Verify info banner is displayed
- Verify tips section is visible

**Test: Info banner content**
- Shows "How it works" heading
- Explains AI receipt parsing
- Mentions manual review for unparsed items

### 2. Channel Cards - Connected State

**Test: Connected WhatsApp channel displays**
- Shows WhatsApp icon in emerald background
- Shows "Connected" status badge
- Shows green status indicator dot
- Shows pause/resume toggle in "on" position
- Shows masked phone number
- Shows transactions logged count
- Shows last activity time
- Shows connected date in footer

**Test: Connected Email channel displays**
- Shows email icon
- Shows "Connected" status badge
- Shows forwarding address
- Shows copy button
- Shows transactions logged count
- Shows last activity time

### 3. Channel Cards - Paused State

**Test: Paused channel displays**
- Shows "Paused" status badge in amber
- Shows amber status indicator dot
- Toggle shows "off" position
- Shows warning banner about paused state
- Shows paused date in warning

### 4. Toggle Behavior

**Test: Pause toggle works**
- Clicking toggle on connected channel calls onPause
- Visual feedback shows toggle switching
- Status updates to "Paused"

**Test: Resume toggle works**
- Clicking toggle on paused channel calls onResume
- Visual feedback shows toggle switching
- Status updates to "Connected"

### 5. Copy Functionality

**Test: Copy email address**
- Clicking copy button copies address to clipboard
- Button text changes to "Copied!"
- onCopyAddress callback is called
- Button reverts after 2 seconds

**Test: Copy WhatsApp number**
- Copy button in setup flow copies raw number
- Visual feedback shown

### 6. Disconnect Flow

**Test: Disconnect button shows confirmation**
- Clicking "Disconnect" shows confirmation prompt
- Shows "Disconnect this channel?" text
- Shows Cancel and Disconnect buttons

**Test: Cancel disconnect**
- Clicking Cancel closes confirmation
- Returns to normal view
- Channel remains connected

**Test: Confirm disconnect**
- Clicking Disconnect calls onDisconnect
- Confirmation closes

### 7. Setup Flow - WhatsApp

**Test: Initial state**
- Shows setup card with dashed border
- Shows WhatsApp icon
- Shows description text
- Shows "Connect WhatsApp" button

**Test: Start setup flow**
- Clicking Connect button calls onStartWhatsApp
- Shows setup instructions
- Shows bot phone number
- Shows copy button for number

**Test: Verification code input**
- When pendingVerification exists
- Shows code input field
- Input accepts only numbers
- Input limited to verification code length
- Verify button enabled when complete

**Test: Submit verification**
- Clicking Verify calls onSubmitVerificationCode
- Passes entered code

**Test: Cancel setup**
- Cancel button visible
- Clicking calls onCancelWhatsAppSetup
- Returns to initial state
- Clears verification code

### 8. Setup Flow - Email

**Test: Initial state**
- Shows setup card with dashed border
- Shows email icon
- Shows description text
- Shows "Connect Email" button

**Test: Start setup flow**
- Clicking Connect shows setup instructions
- Shows generated forwarding address
- Shows copy button
- Shows Done button

**Test: Complete setup**
- Clicking Done closes setup flow
- Address remains visible in UI

### 9. Setup Instructions

**Test: WhatsApp instructions display**
- Shows numbered list
- Each step has number in circle
- Instructions match config

**Test: Email instructions display**
- Shows numbered list
- Each step has number in circle
- Instructions match config

### 10. Tips Section

**Test: Tips display correctly**
- Shows 4 tip cards
- Each has icon, title, description
- Topics: Clear photos, Digital receipts, Auto-categorization, Real-time logging

### 11. Relative Time Formatting

**Test: Time formatting**
- Minutes ago shows "Xm ago"
- Hours ago shows "Xh ago"
- Days ago shows "Xd ago"
- Older shows formatted date

### 12. Responsive Layout

**Test: Mobile layout**
- Channel cards stack vertically
- Tips cards stack appropriately
- Setup flows are readable

**Test: Dark mode**
- All elements visible
- Status colors maintain contrast
- Icons are visible

## Sample Test Code

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { AutomationSettings } from './components/AutomationSettings'
import sampleData from './sample-data.json'

describe('AutomationSettings', () => {
  const defaultProps = {
    config: sampleData.config,
    channels: sampleData.channels,
    pendingVerification: null,
  }

  it('renders automation page with channels', () => {
    render(<AutomationSettings {...defaultProps} />)
    expect(screen.getByText('Automation')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('Email Forwarding')).toBeInTheDocument()
  })

  it('shows connected status for active channels', () => {
    render(<AutomationSettings {...defaultProps} />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('shows paused status with warning', () => {
    render(<AutomationSettings {...defaultProps} />)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('calls onPauseChannel when toggle clicked', () => {
    const onPauseChannel = jest.fn()
    render(<AutomationSettings {...defaultProps} onPauseChannel={onPauseChannel} />)
    // Find and click the connected channel's toggle
    // Verify onPauseChannel was called with channel ID
  })

  it('copies email address to clipboard', async () => {
    const onCopyEmailAddress = jest.fn()
    render(<AutomationSettings {...defaultProps} onCopyEmailAddress={onCopyEmailAddress} />)
    fireEvent.click(screen.getByText('Copy'))
    expect(onCopyEmailAddress).toHaveBeenCalled()
  })

  it('shows verification input during WhatsApp setup', () => {
    render(
      <AutomationSettings
        {...defaultProps}
        channels={[]}
        pendingVerification={sampleData.pendingVerification}
      />
    )
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
  })

  it('shows disconnect confirmation when clicked', () => {
    render(<AutomationSettings {...defaultProps} />)
    fireEvent.click(screen.getByText('Disconnect'))
    expect(screen.getByText('Disconnect this channel?')).toBeInTheDocument()
  })
})
```
