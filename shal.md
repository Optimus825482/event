# Shadcn Alert Dialog

          URL: /ui/alert-dialog
          React alert dialog for confirmation modals and destructive actions. Built with TypeScript and Tailwind CSS for Next.js applications with focus management.
          title: Alert modal issues?

Join our Discord community for help from other developers.

Ever watched a user accidentally delete months of work with a single click? Yeah, that sick feeling in your stomach is exactly why alert dialogs exist. This shadcn/ui alert dialog component stops users in their tracks before they do something they can't undo in your Next.js application.

Standard confirmation dialog with cancel and continue options:

Built on Radix UI AlertDialog with focus trapping, keyboard navigation, and full accessibility support. Works perfectly with TypeScript and styled with Tailwind CSS classes.

Here's the thing—alert dialogs aren't just annoying popups. They're psychological speed bumps that save your users (and your reputation) from disasters.

Think about it: your brain operates on autopilot most of the time. You click, tap, and swipe without thinking. Alert dialogs snap users out of autopilot mode by forcing them to read, process, and make a deliberate choice.

The magic happens in those few seconds of interruption. Users suddenly realize what they're about to do, and most importantly, they get a clear way out. That's not just good UX—that's respecting your users' intent and protecting their data.

This React component handles all the tricky parts: focus management, keyboard navigation, and accessibility. No wrestling with JavaScript event handling or screen reader compatibility.

Confirmation for dangerous actions like deletion using Button variants:

Keep the dialog open during async operations with loading states and disabled buttons:

Each pattern serves different use cases in your React applications. Whether you're building with Next.js or vanilla JavaScript, these alert dialog patterns handle the complex state management and accessibility requirements.

This free open source alert dialog component includes everything you need:

Focus trapping - Keyboard focus stays within the dialog until dismissed

TypeScript native - Built with TypeScript, works perfectly in JavaScript projects

Accessibility first - Full screen reader support and ARIA compliance

Tailwind CSS styling - Easy customization with utility classes

Radix UI foundation - Battle-tested primitives for modal behavior

Keyboard navigation - Space, Enter, Escape, and Tab all work as expected

The root component that manages dialog state and focus.

Prop

Type

Default

Description

defaultOpen

boolean

false

Initial open state for uncontrolled usage

open

boolean

-

Controlled open state

onOpenChange

(open: boolean) => void

-

Callback when open state changes

children

React.ReactNode

-

Dialog components (trigger, content)

The button that opens the dialog.

Prop

Type

Default

Description

asChild

boolean

false

Render as child component using Radix UI Slot

className

string

-

Additional CSS classes for styling

children

React.ReactNode

-

Trigger content (usually a button)

The modal container with focus management and animations.

Prop

Type

Default

Description

className

string

-

Additional CSS classes for styling

onOpenAutoFocus

(event: Event) => void

-

Custom focus behavior when opening

onCloseAutoFocus

(event: Event) => void

-

Custom focus behavior when closing

onEscapeKeyDown

(event: KeyboardEvent) => void

-

Handle Escape key presses

children

React.ReactNode

-

Dialog content (header, footer)

Container for title and description with proper spacing.

Prop

Type

Default

Description

className

string

-

Additional CSS classes for styling

children

React.ReactNode

-

Header content (title, description)

The dialog title announced to screen readers.

Prop

Type

Default

Description

className

string

-

Additional CSS classes for styling

children

React.ReactNode

-

Title text content

Additional context about the action and its consequences.

Prop

Type

Default

Description

className

string

-

Additional CSS classes for styling

children

React.ReactNode

-

Description content

Container for action buttons with proper alignment.

Prop

Type

Default

Description

className

string

-

Additional CSS classes for styling

children

React.ReactNode

-

Action buttons (cancel, confirm)

The cancel button that dismisses the dialog without action.

Prop

Type

Default

Description

asChild

boolean

false

Render as child component using Radix UI Slot

className

string

-

Additional CSS classes for styling

children

React.ReactNode

-

Button text content

The confirm button that performs the action and closes the dialog.

Prop

Type

Default

Description

asChild

boolean

false

Render as child component using Radix UI Slot

className

string

-

Additional CSS classes for styling

children

React.ReactNode

-

Button text content

Key

Action

Space/Enter

Opens dialog (when trigger focused)

Escape

Closes dialog and returns focus to trigger

Tab

Moves focus to next focusable element

Shift + Tab

Moves focus to previous focusable element

Feature

Description

Focus trapping

Focus stays within dialog until closed

Focus restoration

Returns focus to trigger after closing

ARIA attributes

Proper roles, labels, and descriptions

Screen reader support

Title and description announced when opened

Keyboard navigation

Full keyboard accessibility

Use alert dialogs sparingly. This free shadcn/ui component works best for truly destructive or irreversible actions. For simple confirmations, consider inline validation or Toast notifications instead.

Button hierarchy matters. Use Button variants to make dangerous actions visually distinct—destructive red buttons for deletion, default styling for safe actions.

Form integration works smoothly. You can trigger alert dialogs from Form validation or Input field changes. Just remember that the dialog will interrupt the form flow.

Test keyboard navigation thoroughly. This open source component handles Tab, Enter, and Escape automatically, but custom trigger buttons need testing.

Consider mobile experience. Alert dialogs work on touch devices, but make sure your button targets are large enough (44px minimum) and text is readable.

Alert dialogs work great with Form validation workflows and Button actions throughout your React applications. Use them alongside Dialog components for different types of user interactions—alerts for confirmations, dialogs for complex input.

Use alert dialogs for destructive or irreversible actions where users need to confirm they understand the consequences. Use regular dialogs for complex forms, settings panels, or informational content. Alert dialogs interrupt the flow intentionally—regular dialogs are more conversational.

Perfect use case! Show a loading state on the confirm button while your API call runs. The shadcn/ui alert dialog stays open during async operations, so users can't accidentally trigger multiple actions. Check out the async example above.

Make the consequences crystal clear in the description. Use specific language like "This will permanently delete your account and all data" instead of vague warnings. Make the destructive button red, keep cancel as the default focus, and consider requiring users to type a confirmation word for really dangerous actions.

Absolutely! The shadcn/ui alert dialog uses Tailwind CSS classes throughout. Override the default styles by passing custom className props to any component. The animations use CSS transitions, so you can modify timing and easing in your CSS. Built to be styled, not fought.

Works great with Form components! Trigger the alert dialog from form submit handlers or Input validation. The dialog won't interfere with form state, but remember that users can still dismiss it without completing the action.

Alert dialogs work on mobile, but be extra careful about button sizes (44px minimum) and text readability. Mobile users often tap quickly, so the interruption is even more important. Test on actual devices—simulator touch isn't the same as real finger taps.

This Next.js compatible component handles most accessibility automatically, but test with real screen readers like VoiceOver or NVDA. Check that focus moves correctly, titles are announced, and keyboard navigation works. The TypeScript types help catch common accessibility mistakes at compile time.

# Shadcn Dialog

          URL: /ui/dialog
          React dialog component for modal windows with focus trapping and keyboard navigation. Built with TypeScript and Tailwind CSS for Next.js using Radix UI.
          title: Modal behavior issues?

Join our Discord community for help from other developers.

Ever built a form where users accidentally clicked outside and lost all their data? Or watched someone frantically click "Delete" without reading the confirmation? Yeah, modals without proper focus management are UX disasters waiting to happen. This shadcn/ui dialog brings real modal behavior to your React apps.

Modals that actually trap focus and prevent mistakes:

Built on Radix UI's Dialog primitive with smooth animations and proper accessibility. Styled with Tailwind CSS so it matches your design system instead of looking like a Bootstrap modal from 2015.

Here's the thing—dialogs aren't just popup divs. They're focus management tools that force users to make decisions. Done wrong, they're annoying interruptions. Done right, they prevent costly mistakes and guide users through critical workflows.

Think about how GitHub handles repository deletion or how Stripe confirms payment changes. You can't accidentally click through. The dialog demands attention, gets confirmation, then gets out of the way. No accidental deletions, no lost form data.

This free shadcn dialog handles the complex parts—focus trapping, scroll locking, keyboard navigation, screen reader announcements—while you focus on the content. Whether you're building confirmation flows, login forms, or settings panels in your Next.js applications, dialogs that respect user attention make everything feel more professional in your JavaScript projects.

The classic "Are you sure?" for destructive actions:

Keep users focused during data entry:

Social sharing with copy-to-clipboard:

Long content that scrolls internally:

Brand-specific styling and positioning:

Right-click actions that trigger dialogs:

This free open source dialog component includes everything you need:

TypeScript-first - Full type safety with proper event types and state management

Radix UI powered - Battle-tested accessibility and focus management

Focus trapping - Users can't tab outside or click away accidentally

Tailwind CSS styled - Customize with utilities, not fighting component CSS

Keyboard navigable - Tab, Shift+Tab, Escape work as expected

Screen reader friendly - Proper ARIA roles and announcements

Smooth animations - Professional fade and scale transitions

Portal rendering - Avoids z-index issues by rendering in document body

Component

Purpose

Key Props

Dialog

Root container

open, defaultOpen, onOpenChange, modal

DialogTrigger

Button that opens

asChild for custom triggers

DialogContent

Modal container

onEscapeKeyDown, onPointerDownOutside

DialogHeader

Groups title/description

Semantic wrapper

DialogFooter

Groups action buttons

Semantic wrapper

DialogTitle

Accessible heading

Required for screen readers

DialogDescription

Accessible description

Optional context

Pattern

Props

Use Case

Uncontrolled

defaultOpen

Simple toggle dialogs

Controlled

open, onOpenChange

Complex state management

Modal

modal={true}

Focus trapping (default)

Non-modal

modal={false}

Tooltips, popovers

Key

Action

Space/Enter

Open dialog (on trigger)

Tab

Move focus forward

Shift + Tab

Move focus backward

Escape

Close dialog

Write clear action labels. This free shadcn/ui dialog works perfectly, but users need to understand what clicking buttons does. "Delete Account" beats "OK". "Save Changes" beats "Submit". Your React component shows the dialog—you provide the clarity that prevents mistakes.

Give multiple escape routes. Users panic when they feel trapped. Include the X button, Cancel button, Escape key, and click-outside-to-close. This TypeScript component supports all these patterns—use them all in your Next.js applications.

Focus the right element. When the dialog opens, focus should land on the first interactive element or the most likely action. This open source shadcn component manages focus—you decide where it goes based on user intent.

Handle loading states. Show spinners or disable buttons during async operations. Users will click "Save" multiple times if nothing happens. Your JavaScript dialog should give immediate feedback, even if the operation takes time.

Keep dialogs focused. One dialog, one purpose. Don't cram account settings, profile editing, and password changes into one modal. This Tailwind CSS component handles any content, but focused dialogs convert better than kitchen sink modals.

Dialogs naturally work with Form components for data collection and validation in your React applications. Use Button components for consistent action styling across all your dialogs.

For complex workflows, combine dialogs with Tabs components to organize multi-step processes. Alert components work well inside dialogs for showing validation errors or important notices. This open source pattern keeps your modals consistent and accessible.

When building confirmation flows, pair dialogs with AlertDialog components for critical actions that need extra attention. ScrollArea components handle long content like terms of service elegantly. Your JavaScript application can compose these components while maintaining consistent behavior.

For loading states, use dialogs with Skeleton components or Spinner patterns to show progress. The dialog provides the container—other shadcn components handle specific UI states.

Use Dialog for forms, settings, and complex interactions. Use AlertDialog for confirmations and warnings that need immediate attention. The shadcn dialog is for general modals—AlertDialog is specifically for critical decisions.

Yes, the component uses proper ARIA roles, manages focus correctly, and announces content to screen readers. But accessibility depends on your content—always include DialogTitle and use clear, descriptive text that makes sense when read aloud.

Dialogs are responsive and work on touch devices. On small screens, they typically take full width with padding. Consider using Sheet components instead for mobile-first experiences—they slide in from edges and feel more native on phones.

Technically yes, but it's usually bad UX. Users lose track of context with nested modals. Consider using a single dialog with steps, or close the first dialog before opening the second. The free shadcn component supports nesting, but think twice before using it.

Use controlled components and save form state in parent component. Show a confirmation dialog if users try to close with unsaved changes. The TypeScript component provides the container—you manage the form state in your Next.js application.

For scrollable content, add max-h-[80vh] overflow-y-auto to the content area. Keep headers and footers fixed. The open source component handles the container—you control the scrolling behavior with Tailwind utilities.

Yes, the component uses Tailwind CSS animation classes. Override them with your own animations or adjust timing and easing. The default animations are smooth and professional, but you can match your brand's motion design.

The overlay/backdrop can be styled with Tailwind classes or removed entirely. Use className on DialogOverlay to customize appearance. Some use cases like tooltips might not need a backdrop—use modal={false} for those patterns.

# Shadcn Hover Card

          URL: /ui/hover-card
          React hover card component for contextual popups and user profile previews. Built with TypeScript and Tailwind CSS for Next.js applications using Radix UI.
          title: Hover card flickering?

Join our Discord community for help from other developers.

Ever built a dashboard where users had to click through multiple links just to see basic info about a user or product? Or watched someone open ten new tabs because they were afraid clicking would lose their place? Yeah, that's exactly why hover cards exist. This shadcn/ui hover card brings contextual previews to your React applications.

Rich information previews without losing context:

Built on Radix UI primitives with smart positioning and full keyboard navigation. Styled with Tailwind CSS so it matches your design system instead of looking like a generic browser tooltip.

Here's the thing—users hate losing their context. When someone's reading a article and sees an author byline, they want to know who wrote it. But clicking through to a profile page breaks their flow. They bookmark it for later, forget about it, or just skip it entirely.

Think about how LinkedIn shows mini-profiles when you hover over names, or how GitHub previews pull request details on hover. You get the information you need without interrupting your workflow. That's the power of contextual information.

This free shadcn hover card handles the complex parts—timing delays, smart positioning, keyboard accessibility, focus management—while you focus on showing the right information at the right moment. Whether you're building admin panels, social platforms, or content sites in your Next.js applications, hover cards that provide instant context keep users engaged in your JavaScript projects.

Show author info, follower counts, and bio:

Preview links and articles before clicking:

Show pricing, ratings, and key details:

Display system health and performance metrics:

Show contact info and role details:

This free open source hover card component includes everything you need:

TypeScript-first - Full type safety with hover events and state management

Radix UI powered - Battle-tested accessibility and positioning logic

Smart timing - Configurable delays prevent accidental triggers

Tailwind CSS styled - Customize with utilities, not fighting component CSS

Keyboard accessible - Focus management and Escape key support

Mobile responsive - Adapts to touch devices with appropriate fallbacks

Collision detection - Automatically repositions to stay within viewport

Portal rendering - Renders in document body to avoid z-index issues

Component

Purpose

Key Props

HoverCard

Root container

open, onOpenChange, openDelay, closeDelay

HoverCardTrigger

Element that triggers

asChild for custom elements

HoverCardContent

Popup content

side, align, sideOffset

Setting

Default

Purpose

openDelay

700ms

Prevent accidental triggers

closeDelay

300ms

Allow mouse travel to content

side

bottom

Preferred popup direction

align

center

Alignment relative to trigger

State

Trigger

Behavior

Hover

Mouse enter trigger

Shows after openDelay

Focus

Keyboard focus

Shows immediately

Leave

Mouse/focus leave

Hides after closeDelay

Escape

Escape key

Hides immediately

Time delays appropriately. This free shadcn/ui hover card defaults to 700ms open delay—that's perfect for most cases. Too fast feels jumpy, too slow feels broken. This TypeScript component lets you adjust timing, but test with real users before changing the defaults in your Next.js applications.

Design for mobile carefully. Hover doesn't exist on touch devices. Consider showing the same information in a different way—maybe a tap gesture or a details section. This open source shadcn component handles the detection, but you need to design the fallback experience.

Keep content scannable. Users scan hover cards quickly. Use clear headings, bullet points, and visual hierarchy. This JavaScript component provides the container—you provide content that helps users make decisions fast in your React applications.

Don't overwhelm with actions. One or two action buttons maximum. Follow buttons, copy links, view profiles—focus on what users actually want to do. The Tailwind CSS styled component supports any content, but restraint creates better user experiences.

Position predictably. Cards that pop up from random directions feel chaotic. Pick a default position and stick with it. This component handles collision detection—you provide consistent expectations.

Hover cards naturally work with Avatar components for user profile previews in your React applications. Use Button components inside cards for actions like following or viewing full profiles.

For content previews, combine hover cards with Badge components to show status indicators or Card components for structured layouts. This open source pattern keeps your hover content consistent with your main interface.

When building navigation systems, pair hover cards with NavigationMenu components for rich menu previews. Separator components help organize complex hover card content into logical sections.

For loading states, use hover cards with Skeleton components while fetching user data or profile information. Your JavaScript application can show immediate feedback while loading the full content.

Use hover cards for rich content like profiles, previews, or detailed information. Use tooltips for simple explanatory text. The shadcn hover card supports complex layouts—tooltips are for brief clarifications.

Hover doesn't exist on touch devices. The component detects touch and won't show cards automatically. Consider alternative patterns like tap-to-expand or inline details. The free shadcn component handles detection—you design the mobile experience.

Yes, use openDelay and closeDelay props. 700ms open delay prevents accidental triggers. 300ms close delay allows users to move their mouse to the card content. The TypeScript component lets you adjust these based on your content needs.

The component tries your preferred side first, then flips to avoid viewport edges. It also slides along the edge to stay visible. The open source component handles collision detection automatically—you just specify preferences.

Yes, cards open when triggers receive focus and close when focus leaves. Escape key closes cards immediately. The component manages focus correctly, but your content should have proper heading structure and tab order.

Hover cards are lightweight and use efficient positioning. For content-heavy cards, consider lazy loading images or data. The React component itself is optimized—performance issues usually come from heavy content or too many simultaneous cards.

Technically yes, but it's usually bad UX. Users lose track of what triggered what. Consider a single card with internal navigation instead. The shadcn component supports nesting—your design should avoid confusing interactions.

Yes, use asChild prop to make any element a trigger. Names, avatars, links, buttons—anything clickable works. The component handles hover and focus events regardless of the element type you choose for your Next.js interface.

# Shadcn Sonner

          URL: /ui/sonner
          React toast for non-blocking notifications and user feedback with smooth animations. Built with TypeScript and Tailwind CSS for Next.js.
          title: Toast notifications broken?

Join our Discord community for help from other developers.

You know those little notifications that pop up to tell you something worked? Or when you need to undo an action? Ever notice how the best apps make these feel polished instead of jarring interruptions? This shadcn/ui sonner makes toast notifications feel thoughtful and professional in your React applications.

Clean, simple toast messages:

Just import and call toast() anywhere in your app. This free open source component handles positioning, animations, and accessibility so your notifications enhance user experience instead of disrupting workflow. Styled with Tailwind CSS to match your design system instead of generic browser alerts.

Here's the thing—most notification systems are terrible because they interrupt users at the worst possible moments. Think about those modal alerts that stop everything you're doing just to say "Success!" or browser notifications that cover important interface elements. Good toast notifications appear when they're relevant and disappear gracefully.

Sonner lets users keep working while showing contextual feedback. Need to confirm a file upload? Show progress and success without blocking the interface. Made a mistake? Offer instant undo actions right in the notification. Users get the feedback they need without losing focus or momentum.

This free shadcn sonner handles the complex parts—smart positioning, smooth animations, keyboard accessibility, mobile gestures—while you focus on providing meaningful feedback at the right moments. Whether you're building form confirmations, progress indicators, or undo systems in your Next.js applications, notifications that enhance workflow keep users productive in your JavaScript projects.

Different message types with appropriate styling:

Automatic progress feedback for async operations:

Rich notifications with icons and custom JSX:

Let users reverse actions immediately:

Important notifications that stay until dismissed:

This free open source toast component includes everything you need:

TypeScript-first - Full type safety with notification events and state management

Emil Kowalski created - Built by the creator of the original Sonner library

Non-blocking interface - Users continue working while notifications provide feedback

Tailwind CSS styled - Customize with utilities, not fighting notification positioning

Promise integration - Automatic loading, success, and error states for async operations

Mobile optimized - Swipe to dismiss with touch-friendly interactions

Accessibility ready - Screen reader announcements and keyboard navigation

Smart positioning - Never covers critical interface elements or user content

Function

Purpose

Use Case

toast(message)

Basic notification

Simple confirmations and feedback

toast.success(message)

Success notification

Completed actions, saved changes

toast.error(message)

Error notification

Failed operations, validation errors

toast.loading(message)

Loading notification

In-progress operations

toast.promise(promise, options)

Promise handling

Automatic async operation feedback

Option

Type

Purpose

description

string

Additional context below main message

duration

number

Auto-dismiss timing (4000ms default)

action

object

Primary button with label and onClick

icon

ReactNode

Custom icon for notification

position

string

Override default toast position

Component

Purpose

Key Props

<Toaster />

Container for all toasts

position, theme, visibleToasts

Be specific with notification messages instead of generic feedback. This free shadcn/ui sonner component shows whatever text you provide—"File uploaded successfully" tells users more than "Success!" This TypeScript component handles the display—you provide messages that actually inform users about what happened in your Next.js applications.

Use promise integration for async operations and loading states. When users submit forms or upload files, they need progress feedback. This open source shadcn sonner automatically handles loading, success, and error states—provide clear messaging for each stage of the operation.

Enable undo actions for destructive operations immediately. Deleted something important? Let users reverse it right in the notification before it disappears. This JavaScript component supports action buttons—use them to provide safety nets for user mistakes and accidental actions.

Don't overwhelm users with notification spam. Too many toasts create noise that users learn to ignore. The Tailwind CSS styled component limits visible notifications automatically—be selective about what deserves user attention and when notifications actually help.

Position notifications thoughtfully based on your interface layout. Bottom-right works for most apps, but consider your user's workflow and screen real estate. This component supports any position—choose placement that complements your interface instead of fighting for attention.

Sonner naturally works with Form components for validation feedback and submission confirmations in your React applications. Use Button components to trigger toast notifications for user actions and confirmations.

For complex workflows, combine sonner with Dialog components—use toasts for quick feedback, dialogs for complex confirmations. This open source pattern provides appropriate feedback levels for different interaction types.

When building data interfaces, pair sonner with DataTable components for bulk operation feedback or Progress components for file upload status. Alert components work alongside toasts for persistent warnings versus temporary notifications.

For user account features, use sonner with Avatar components for profile update confirmations or Badge components for status change notifications. Your JavaScript application can compose these shadcn components while maintaining consistent feedback patterns across different user interactions.

Use sonner for temporary feedback that doesn't require user action—confirmations, progress updates, success messages. Use alerts for persistent information that needs user attention—errors, warnings, important status. The shadcn sonner disappears automatically—alerts stay until addressed.

Add the Toaster component to your root layout, then import and use toast() functions anywhere in your app. The free shadcn component handles global state and positioning automatically while providing notifications throughout your application.

Use toast.promise() with your async functions to automatically show loading, success, and error states. The TypeScript component handles state transitions automatically—you provide the promise and messaging for each state.

Sonner includes swipe-to-dismiss gestures and touch-optimized interactions. Notifications position appropriately for mobile screens and include proper touch targets. The open source component adapts to mobile automatically while maintaining accessibility.

Yes, the component announces notifications to screen readers and supports keyboard navigation. However, don't rely solely on toasts for critical information—they're temporary and may be missed. Always provide alternative ways to access important feedback.

Yes, use the position prop on the Toaster component for global positioning, or the position option on individual toasts. The shadcn component supports all screen edges and corners—choose based on your interface layout and user workflow.

Use Tailwind CSS classes through className props for colors and styling. The React component provides smooth animations automatically while letting you customize visual appearance to match your design system and brand identity.

Use the action option to add undo buttons to notifications. Store the necessary data to reverse the action, then provide a clear undo mechanism within the toast duration. The JavaScript component handles the UI—your application logic handles the actual undo operation.
