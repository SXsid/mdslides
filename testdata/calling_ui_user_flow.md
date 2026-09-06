# Calling Feature: UI & User Flow

This document outlines the end-to-end user experience for the calling feature, including how users discover, set up, and interact with the system.

---

## 1. Discovery & Nudges

Before a user can make a call, they must discover and enable the feature.

-   **Step 1: The Nudge**: When a user visits the **Call Logs** or **Dashboard**, the system checks their subscription status. If VOIP is not enabled, a **Calling Analytics Nudge** (visual banner/card) appears.
-   **Step 2: Nudge Interaction**: The nudge provides a direct path to the enablement flow, allowing users to initiate the setup process.
-   **Step 3: Intent**: The user clicks "Request Number" or a similar CTA on the nudge.

---

## 2. Setup & Activation

The setup process involves both automated requests and manual verification.

-   **Step 4: Request Modal**: The `RequestVoipModal` opens. The user selects their country preference (e.g., India +91), quantity, and provides a contact number for verification.
-   **Step 5: Process Initiation**: When the user clicks "Enable Calling" and fills the VOIP modal, the backend sends a webhook to the Zintlr team.
    -   **Notification**: If a team member requests access, an automated email is sent to the **Manager** notifying them that a member has requested the calling feature.
-   **Step 6: Provisioning Phase 1**: The Zintlr CS/Sales team contacts the client via email to finalize KYC and payment.
-   **Step 7: Manager Assignment**: Once KYC is finalized and numbers are available, the **Manager** can access the **Calling Setup** page.
    -   The Manager assigns the available numbers to specific team members.
    -   The frontend fires an API call; the backend stores this mapping and creates the user profile within the TeleCMI system.
-   **Step 8: Provisioning Phase 2 (Manual Config)**:
    -   After the Manager assigns numbers, they initially appear in an "unassigned" status while setup is finalized.
    -   The Zintlr/CS team receives a webhook notification of the assignment.
    -   The team manually configures the virtual numbers and settings in the TeleCMI dashboard.
    -   A backend script runs to update the final status once the assignment is fully active.
-   **Step 9: Ready to Use**: Once the script confirms activation, the Manager and their team can begin making calls.

---

## 3. The Calling Experience

The core interface for making and managing active calls.

-   **Step 10: Initiation**: User clicks a "Call" icon next to a prospect's phone number.
    -   **Location Constraint**: The calling feature is specifically available in the **Lookup**, **Unlocks**, and **Lookup List** sections. It is **not** active on "IDs" or other unrelated modules.
-   **Step 11: First-Call Consent**: If it's the very first call, a modal asks for recording consent and microphone permissions.
-   **Step 12: Active Call (Dialer PIP)**:
    -   A floating window (PIP) appears.
    -   **Browser Limitation**: Please note that **Picture-in-Picture (PiP) mode only works on Google Chrome**.
    -   **States**: Dialing -> Connected -> [Optional: Hold/Mute] -> Ended.
    -   **Features**: Users can view **AI Insights** or take **Notes**.
    -   **Constraint**: Note-taking and Workspace/Insights features **only work if a `personId` is present** (i.e., the caller is a recognized profile).
-   **Step 13: Post-Call Summary**: As soon as the call hangs up, a summary modal appears. The user can:
    -   Add **Notes** and **Stages**.
    -   **Tag** the call (e.g., "Interested").
    -   **Add to Lists** for better contact management.
    -   **Listen to Call Recordings**: The summary provides access to the recording for review.
    -   Sync data to their CRM.

---

## 4. Incoming Calls & Notifications

Zintlr ensures that users never miss a business opportunity, even when they aren't actively looking at the dashboard.

-   **Step 14: Call Notifications**:
    -   **Browser Notifications**: If the user is on another tab or has the browser minimized, a **Push Notification (FCM)** appears on their OS (Mac/Windows) with the caller's identity.
    -   **Visual Alert**: The Dialer PIP automatically expands to show an **Incoming Call** overlay.
-   **Step 15: Interaction**:
    -   The user can **Accept** the call immediately.
    -   They can **Reject** the call, or **Silence** it to continue their current work.
    -   If a user is already on an active call, they see a **"Waiting Call"** notification within the dialer with an option to **"End & Answer"** or **"Silence."**

---

## 5. Call Logs & Analytics

Post-call activity tracking and performance monitoring.

-   **Step 16: Accessing Logs**: Users can visit the **Call Logs** page to see a comprehensive table of all business communications.
-   **Step 17: Interaction with Logs**:
    -   **Table View**: Displays **Recipient Name/Photo**, **Call Duration**, **Direction** (Incoming/Outgoing), and **Date/Time**.
    -   **Playback**: Each log entry allows the user to listen to the call recording directly from the table or by clicking on a row to open the detailed summary.
    -   **Analytics Dashboard**: Provides a high-level overview of calling performance, including total calls made, total duration, and success metrics.
-   **Step 18: Retrospective Edits**: Users can revisit any call log at any time to update notes, tags, or contact lists, ensuring their CRM data remains accurate.
