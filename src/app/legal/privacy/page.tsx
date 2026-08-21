import { LegalPage } from "@/components/LegalPage";
import {
  AVAILABLE_IN,
  COMPANY,
  PROCESSORS,
  SUPERVISORY_AUTHORITY,
} from "@/lib/company";
import { MINIMUM_AGE, PRIVACY_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" version={PRIVACY_VERSION}>
      <p>
        This explains what Upside Arena collects about you, why, who else sees
        it, how long we keep it, and what you can tell us to do about it. We
        collect as little as the game needs. We do not sell your data and we do
        not run ads.
      </p>

      <h2>1. Who is responsible for your data</h2>
      <p>
        {COMPANY.legalName}, a private limited company in {COMPANY.country}{" "}
        (registry code {COMPANY.registryCode}), registered office{" "}
        {COMPANY.address}, VAT ID {COMPANY.vatId}, is the controller of your
        data. That means we decide what is collected and why, and we are the
        ones you can hold to this policy. It is the same company behind{" "}
        {COMPANY.siblingProduct}, though the two products keep separate
        accounts and separate databases.
      </p>
      <p>
        For anything about your data, email{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.
      </p>
      <p>
        We are based in the European Union, so European data protection law
        applies to everything we do with your data, wherever you live. If you
        live in California, section 11 sets out the extra rights you have.
      </p>

      <h2>2. What we collect</h2>
      <p>
        Almost all of it comes from you, or from your use of the game. We do not
        buy data about you from anyone.
      </p>
      <ul>
        <li>
          <strong>Your account.</strong> Your email address. If you sign in with
          Google, also the name and profile picture Google gives us. We never
          see your Google password.
        </li>
        <li>
          <strong>Your profile.</strong> The name and player tag you choose, and
          the date you confirmed you are {MINIMUM_AGE} or older.
        </li>
        <li>
          <strong>Your game history.</strong> Your trades, your scores, your
          leagues, your streak and your standing.
        </li>
        <li>
          <strong>What you agreed to.</strong> Which version of these documents
          you accepted, and when.
        </li>
        <li>
          <strong>Technical records.</strong> When you use Arena our hosting
          provider records your IP address, your browser and the pages you
          asked for. This happens for every website and we use it to keep the
          service working and to spot abuse.
        </li>
        <li>
          <strong>How the app is used, only if you allow it.</strong> Which
          screens are opened, which buttons are pressed, how quickly pages
          load. Never what you searched for, what you bought, what your league
          is called or how much you have. We ask you first, and Arena works
          exactly the same if you say no.
        </li>
        <li>
          <strong>Which days you opened Arena.</strong> The date, and nothing
          about what you did. We use it to count how many people come back,
          which is the one number that tells us whether the game is any good.
        </li>
        <li>
          <strong>What you have bought, if you buy anything.</strong> Which
          subscription or coin bundle, when, and whether it is still running. We
          never see or store your card number: our payment provider handles the
          card and tells us only that a payment succeeded.
        </li>
        <li>
          <strong>Weeks you choose to share.</strong> When you press share on a
          finished week, we save a copy of that result: your name, the title you
          were wearing, how the week went, where you finished in a league, your
          streak, and the daily figures behind it. That copy is what the link
          shows. It is frozen, so it never reveals anything that happens
          afterwards, and you can take it down whenever you like.
        </li>
        <li>
          <strong>What your portfolio was worth each day.</strong> Recorded once
          per trading day for everyone playing, so a shared week can show its
          shape rather than a single number.
        </li>
        <li>
          <strong>Notifications, only if you turn them on.</strong> If you allow
          notifications in your browser, we store the address your browser&rsquo;s
          push service gives us, the keys needed to encrypt a message to it, a
          description of the browser, and the time zone your device reports so
          nothing arrives in the middle of your night. We also keep a record of
          what we sent you and when, which is what stops the same thing being
          sent twice and keeps us to our own daily limit.
        </li>
      </ul>
      <p>
        We do not collect anything about your health, your beliefs, your
        politics, your ethnicity or anything else the law treats as sensitive.
        Please do not put that kind of information into a name, a league name or
        a message.
      </p>

      <h2>3. Why we use it, and what allows us to</h2>
      <p>
        The law says we need a reason for each thing we do with your data. Ours
        are:
      </p>
      <ul>
        <li>
          <strong>To give you an account and run the game.</strong> We need this
          to do what you asked us to do, which is let you play. Without it there
          is no account and no game.
        </li>
        <li>
          <strong>To show you to the other players in your league.</strong> Same
          reason. A league you joined cannot work without showing who is in it.
        </li>
        <li>
          <strong>To keep the game fair and to stop abuse.</strong> We have a
          legitimate interest in Arena not being ruined by bots, cheating or
          multiple accounts. We have weighed that against your privacy and kept
          it to the minimum that works.
        </li>
        <li>
          <strong>To keep the service secure and working.</strong> Also a
          legitimate interest, and one you benefit from directly.
        </li>
        <li>
          <strong>To answer you when you contact us.</strong> A legitimate
          interest in being able to help you.
        </li>
        <li>
          <strong>To measure how the app is used.</strong> Only with your
          consent, which you can take back at any time.
        </li>
        <li>
          <strong>To count how many people play and come back.</strong> We have
          a legitimate interest in knowing whether Arena works, and we do it by
          counting our own records rather than by sending anything about you to
          anyone. Nothing produced this way names a person, describes a person,
          or could be traced back to one: it is totals, such as how many
          accounts exist and how many people opened the app yesterday.
        </li>
        <li>
          <strong>To take a payment and give you what you paid for.</strong> We
          need this to do what you asked us to do. We also have to keep records
          of what was sold, because tax and accounting law requires it, which is
          a legal obligation rather than a choice.
        </li>
        <li>
          <strong>To let you share a week.</strong> We do this to do what you
          asked us to do, which is make that one week postable. Nothing is
          shared until you press the button, and taking it down ends it.
        </li>
        <li>
          <strong>To send you notifications.</strong> Only with your consent,
          which you can take back at any time from your profile page or in your
          browser&rsquo;s own settings. Every email we send carries a link that
          turns them off. We only send things that describe something that has
          actually happened in your game, never marketing.
        </li>
        <li>
          <strong>To record that you agreed to our terms, and to meet other
          legal duties.</strong> We have to be able to show this.
        </li>
      </ul>
      <p>
        If you object to anything we do on the basis of a legitimate interest,
        tell us and we will stop unless we have a strong reason not to.
      </p>

      <h2>4. Cookies and similar technology</h2>
      <p>We use two kinds, and only two:</p>
      <ul>
        <li>
          <strong>Sign-in cookies, always on.</strong> These keep you signed in
          and keep your session secure. Arena cannot work without them, so we do
          not ask permission for these.
        </li>
        <li>
          <strong>Measurement, only if you allow it.</strong> Page views and
          load times. We ask before any of it runs, and nothing is recorded
          until you say yes.
        </li>
      </ul>
      <p>
        You can change your mind whenever you like from the banner or from your
        profile page. We do not use advertising cookies and we do not let anyone
        track you across other websites.
      </p>

      <h2>5. Who else sees your data</h2>
      <ul>
        <li>
          <strong>Other players.</strong> Your name, player tag, picture and
          scores are visible to people in a league you have joined. Your email
          address is never shown to another player.
        </li>
        <li>
          <strong>Anyone you send a share link to.</strong> A shared week is a
          public web address: whoever holds the link can open it, without an
          account, and can pass it on. It shows that one week and offers no way
          to reach anything else about you. We ask search engines not to list
          these pages, though we cannot force them to obey. Taking a card down
          makes its link stop working.
        </li>
        <li>
          <strong>Companies that run parts of the service for us.</strong> They
          may only use your data to do that work, under a written contract, and
          never for their own purposes. Today they are:
          <ul>
            {PROCESSORS.map((processor) => (
              <li key={processor.name}>
                <strong>{processor.name}</strong>. {processor.role} Stored in{" "}
                {processor.where}.
              </li>
            ))}
          </ul>
          We keep this list current. Anyone we add later will be named here
          first.
        </li>
        <li>
          <strong>Anyone the law requires.</strong> If we are legally obliged to
          hand something over, or need to in order to establish or defend a
          legal claim. We will tell you unless we are not allowed to.
        </li>
        <li>
          <strong>A buyer,</strong> if our business is sold. They would have to
          keep to this policy, and we would tell you first.
        </li>
      </ul>
      <p>
        <strong>We do not sell your data, and we never have.</strong>
      </p>

      <h2>6. Sending data outside Europe</h2>
      <p>
        Some of the companies above may store or handle data outside the
        European Economic Area, including in the United States. When that
        happens we rely on the protections European law provides for this, which
        are the European Commission&rsquo;s standard contractual clauses, or a
        decision by the Commission that the country protects data adequately.
        Ask us and we will tell you which applies and send you a copy.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>
          <strong>Your account, profile and game history.</strong> For as long
          as your account is open.
        </li>
        <li>
          <strong>When you close your account.</strong> All of it is erased
          straight away, including your profile, your game history and the
          record of what you agreed to. This cannot be undone.
        </li>
        <li>
          <strong>Technical records.</strong> Kept briefly by our hosting
          provider, normally around thirty days, then deleted automatically.
        </li>
        <li>
          <strong>Emails you send us.</strong> Kept while we deal with your
          question and for a reasonable time after, in case you come back to us.
        </li>
        <li>
          <strong>Backups.</strong> We keep an encrypted backup copy outside the
          main database, so the app can be rebuilt if our database provider had
          a serious failure. It is one combined file covering every account, not
          a file for each person, so a single account cannot be edited out of
          it. Each day&rsquo;s copy is deleted automatically 30 days after it
          was made. Deleting your account removes your data from the live
          service straight away, but it can sit in that day&rsquo;s backup until
          the backup&rsquo;s own 30 days are up, the same as everyone
          else&rsquo;s.
        </li>
      </ul>

      <h2>8. Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>
          <strong>Show you what we hold.</strong> You can download all of it
          yourself, right now, from your profile page.
        </li>
        <li>
          <strong>Correct something that is wrong.</strong> Most of it you can
          edit yourself on your profile page.
        </li>
        <li>
          <strong>Delete your account and its data.</strong> You can do this
          yourself from your profile page. It happens immediately.
        </li>
        <li>
          <strong>Give you your data in a portable form,</strong> so you can
          take it elsewhere. The download from your profile page is exactly
          this.
        </li>
        <li>
          <strong>Stop or limit something we are doing with it,</strong>{" "}
          including anything based on a legitimate interest.
        </li>
        <li>
          <strong>Take back your consent</strong> to measurement, at any time.
          That does not undo anything that happened lawfully before you changed
          your mind.
        </li>
      </ul>
      <p>
        Email{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a> for
        anything you cannot do yourself. We will reply within one month. If your
        request is complicated we may need longer, and we will tell you why. It
        is free, we will never make you give a reason, and we will never treat
        you worse for asking.
      </p>
      <p>
        We may need to check it is really you before we act, so that someone
        else cannot use these rights against you.
      </p>

      <h2>9. Complaining</h2>
      <p>
        If you think we have handled your data badly, please tell us first and
        give us a chance to fix it. You can also complain to a data protection
        authority at any time, without asking us.
      </p>
      <p>
        Ours is the {SUPERVISORY_AUTHORITY.englishName} (
        {SUPERVISORY_AUTHORITY.name}),{" "}
        <a href={SUPERVISORY_AUTHORITY.url} rel="noreferrer noopener" target="_blank">
          {SUPERVISORY_AUTHORITY.url}
        </a>
        ,{" "}
        <a href={`mailto:${SUPERVISORY_AUTHORITY.email}`}>
          {SUPERVISORY_AUTHORITY.email}
        </a>
        . If you live elsewhere in Europe you can go to the authority in your own
        country instead.
      </p>

      <h2>10. Decisions made automatically</h2>
      <p>
        The game scores your portfolio and ranks your league automatically, which
        is the whole point of it. None of that has any legal effect on you or
        affects you in any comparable way, it is a game. We do not profile you
        for advertising, and no automated decision we make can deny you a
        service, a job or credit.
      </p>

      <h2>11. If you live in California</h2>
      <p>
        California law gives you some extra rights and requires us to say some
        things plainly.
      </p>
      <ul>
        <li>
          The categories of personal information we collect are: identifiers
          such as your email address and an account number, your account name
          and picture, internet activity such as pages viewed, and rough
          location inferred from your IP address. Section 2 lists exactly what is
          in each.
        </li>
        <li>
          We collect it for the purposes in section 3 and we keep it for the
          periods in section 7.
        </li>
        <li>
          <strong>
            We do not sell your personal information and we do not share it for
            cross-context behavioural advertising.
          </strong>{" "}
          We have not in the past twelve months. We do not sell the personal
          information of anyone under sixteen, because nobody under sixteen may
          hold an account.
        </li>
        <li>
          You can ask us to tell you what we have collected, to delete it, or to
          correct it. Sections 7 and 8 explain how, and the buttons on your
          profile page do all three.
        </li>
        <li>
          You may use an authorised agent to make a request. We will ask for
          proof that you gave them permission.
        </li>
        <li>
          We will never deny you service, charge you a different price or give
          you a worse experience for using any of these rights.
        </li>
      </ul>

      <h2>12. Children</h2>
      <p>
        Under 13 is never allowed. Arena is for people {MINIMUM_AGE} and older,
        the same rule {COMPANY.siblingProduct} uses. We use {MINIMUM_AGE}{" "}
        because some countries in Europe set that as the age you can agree to
        this kind of service by yourself.
      </p>
      <p>
        We do not knowingly collect anything from anyone younger. If you believe
        a child has given us their information, email us and we will delete it
        and close the account.
      </p>

      <h2>13. How we protect your data</h2>
      <p>
        Connections to Arena are encrypted. Your data is separated at the
        database level so one account cannot reach another&rsquo;s, access to
        production systems is limited to people who need it, and we do not store
        passwords at all because we sign you in with a link or with Google.
      </p>
      <p>
        No service can promise perfect security. If something goes wrong in a way
        that puts you at real risk, we will tell you and the relevant authority
        as quickly as the law requires.
      </p>

      <h2>14. Where Arena is offered</h2>
      <p>
        Arena is currently offered to people in {AVAILABLE_IN.join(" and ")}. We
        apply this policy to everyone who uses it, wherever they are.
      </p>

      <h2>15. Changes to this policy</h2>
      <p>
        Every version is dated. If we change something that matters to you, we
        will tell you in the app or by email before it takes effect, and where
        the law requires it we will ask you again.
      </p>

      <h2>16. How to reach us</h2>
      <p>
        {COMPANY.legalName}, {COMPANY.address}, {COMPANY.country}.
      </p>
      <p>
        Product help:{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
        Questions, data requests or concerns:{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.
        See also our <a href="/legal/terms">terms</a>.
      </p>
    </LegalPage>
  );
}
