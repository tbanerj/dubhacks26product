// Your three team emails
const EMAILS = ['ryanpanda78@gmail.com', 'thanika@outlook.com', 'trinavbanerjee@gmail.com']
const EFFECTIVE_DATE = 'October 17, 2026'

// Shows the emails as clickable links: "a, b, or c"
function ContactEmails() {
  return (
    <>
      {EMAILS.map((email, i) => (
        <span key={email}>
          {i > 0 && (i === EMAILS.length - 1 ? ', or ' : ', ')}
          <a href={'mailto:' + email}>{email}</a>
        </span>
      ))}
    </>
  )
}

export default function Privacy() {
  return (
    <article className="container legal">
      <span className="pill">Legal</span>
      <h1>Privacy policy</h1>
      <p className="legal-date">Effective {EFFECTIVE_DATE}</p>

      <div className="legal-summary">
        <h2>The short version</h2>
        <ul>
          <li>We collect only what MeltMode needs to work.</li>
          <li>We don't sell your information or show you ads.</li>
          <li>The app uses your location only while it's open.</li>
          <li>If you play by text, we never see your GPS location or contacts.</li>
          <li>Other players never see your exact location.</li>
        </ul>
      </div>

      <h2>Who we are</h2>
      <p>
        MeltMode is a real-world quest game made by a small student team. In this policy, "we" means
        the MeltMode team. You can reach any of us at <ContactEmails />.
      </p>

      <h2>This website</h2>
      <p>
        You can browse this website without creating an account. We don't use advertising or tracking
        cookies. The company that hosts this website may keep standard server logs, such as IP addresses
        and the pages you visit, to keep the site running and secure.
      </p>

      <h2>Playing by text (iMessage)</h2>
      <p>
        You can play MeltMode over iMessage without the app. Your messages, photos and our replies travel
        through Apple's iMessage and Photon (Spectrum Cloud), the messaging service we use. We don't run our
        own inbox, so those companies carry your messages and may keep them under their own privacy
        policies.
      </p>

      <h3 className="legal-sub">What we store</h3>
      <ul>
        <li>
          <strong>Who you are in the chat.</strong> Your iMessage handle (the phone number or email Apple
          uses for the conversation), an internal player ID, the time you first texted us, and whether you've
          opted out. We don't store your real name. Everyone is saved as "adventurer."
        </li>
        <li>
          <strong>Your game progress.</strong> The step you're on, the quests you choose, your XP, level and
          collectibles, reminder and cancellation times, and any place name you type (for example "Capitol
          Hill"). A place name is just the words you typed, not a GPS location.
        </li>
        <li>
          <strong>Message records.</strong> Message IDs, so the same message is never processed twice, and
          copies of the messages we send you until they're delivered. We don't save a full transcript of
          your chat.
        </li>
        <li>
          <strong>Linking codes.</strong> If you text LINK to connect the app, we store only a scrambled
          (hashed) version of the code. Nothing is linked unless you confirm it in the app.
        </li>
        <li>
          <strong>Testers.</strong> If you're registered as a tester, your phone number or email is also
          saved in our Photon account.
        </li>
      </ul>

      <h3 className="legal-sub">Photos you send by text</h3>
      <ul>
        <li>We only keep a photo if you send it for a quest you've accepted. Other photos aren't saved.</li>
        <li>Before saving, we remove hidden information from the file, such as EXIF data.</li>
        <li>
          The photo is checked on our own server. It is not sent to any outside image-checking service.
        </li>
        <li>
          The photo file is deleted after 24 hours. We keep a digital fingerprint (hash) of it and whether
          it passed.
        </li>
        <li>HEIC photos aren't accepted, and only one photo per message is saved.</li>
      </ul>

      <h3 className="legal-sub">What we don't collect by text</h3>
      <p>
        Your GPS location, IP address, contacts, camera roll, payment information, or the locations of
        other players.
      </p>

      <h3 className="legal-sub">Stopping and server logs</h3>
      <p>
        Text STOP at any time to stop reminders. Stopping doesn't delete your progress, place names or a
        photo still inside its 24-hour window. To have those deleted, email us. Our server keeps technical
        logs with message IDs and the number of attachments, but not your message text, photos or handle.
        We ignore group chats, but a group chat's ID, which can contain a phone number, may appear in these
        logs.
      </p>

      <h2>The MeltMode app</h2>
      <ul>
        <li>
          <strong>Location.</strong> With your permission, the app uses your location only while it's open,
          to show quests near you. You can turn location access off at any time in your phone's settings.
        </li>
        <li>
          <strong>Photos.</strong> The app asks for a photo only when a quest needs one, and you choose which
          photo to send. To check that your photo matches the quest, we send it to Gemini, an AI service
          made by Google.
          {/* CONFIRM: how long app photos are kept after they're checked */}
        </li>
        <li>
          <strong>Your profile.</strong> We store the basic information the game needs to work, such as your
          display name, progress, XP and collectibles, on our servers so your progress is saved.
        </li>
        <li>
          <strong>Parties.</strong> When you join a party, its members can see your display name, ready
          status and party chat messages. They never see your exact location.
        </li>
      </ul>

      <h2>Services we use</h2>
      <ul>
        <li><strong>Apple iMessage</strong> and <strong>Photon (Spectrum Cloud)</strong> deliver text play.</li>
        <li><strong>Gemini (Google)</strong> checks photos sent in the app.</li>
        <li><strong>Our hosting provider</strong> runs this website and keeps standard server logs.</li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>Sell or rent your personal information.</li>
        <li>Show you ads based on your data.</li>
        <li>Share your exact location with other players.</li>
      </ul>

      <h2>Age requirement</h2>
      <p>You must be 18 or older to use MeltMode.</p>

      <h2>Your choices</h2>
      {/* CONFIRM: how app players delete their data (a button in the app? by email?) */}
      <p>
        You can turn off location and photo access in your phone's settings at any time. You can delete
        your MeltMode data at any time. To ask what information we have about you, or for help deleting
        it, email us at <ContactEmails />.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we'll update the date at the top of this page. If the changes are
        important, we'll let you know in the app.
      </p>
    </article>
  )
}